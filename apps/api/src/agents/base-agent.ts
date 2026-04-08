import type { MessageParam } from '@anthropic-ai/sdk/resources/messages.js';
import { getAnthropicClient } from '../lib/anthropic.js';
import { agentTools } from './tool-definitions.js';
import { executeTool } from './tool-executor.js';
import type { AgentEventType } from '../websocket/ws.emitter.js';
import { emitEvent, buildEvent } from '../websocket/ws.emitter.js';
import prisma from '../lib/prisma.js';

const MODEL = 'claude-opus-4-5';
const MAX_TOKENS = 8192;
const TOOL_USE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes per agent
const MAX_TURNS = 50; // safety limit
const MAX_RETRIES = 3; // exponential backoff retries for rate limit errors
const BACKOFF_BASE_MS = 1000; // 1s, 2s, 4s

export interface AgentRunConfig {
  agentId: string;
  projectId: string;
  agentType: string;
  layer: number;
  systemPrompt: string;
  taskPrompt: string;
  projectDir: string;
}

export interface AgentRunResult {
  success: boolean;
  summary: string;
  tokensInput: number;
  tokensOutput: number;
  filesCreated: string[];
}

/**
 * @description Executes the Tool Use loop for an agent.
 * Sends messages to Claude, executes tool calls, loops until taskComplete or end_turn.
 */
export async function runAgent(config: AgentRunConfig): Promise<AgentRunResult> {
  const { agentId, projectId, agentType, layer, systemPrompt, taskPrompt, projectDir } = config;
  const client = getAnthropicClient();

  const messages: MessageParam[] = [{ role: 'user', content: taskPrompt }];
  let totalInput = 0;
  let totalOutput = 0;
  const filesCreated: string[] = [];
  let summary = '';
  const deadline = Date.now() + TOOL_USE_TIMEOUT_MS;
  let turns = 0;

  emit(projectId, 'agent:started', agentType, layer, `Layer ${layer} agent started`);

  while (turns < MAX_TURNS) {
    if (Date.now() > deadline) {
      throw new Error(`Agent timeout after ${TOOL_USE_TIMEOUT_MS / 1000}s`);
    }

    turns++;

    const response = await callWithBackoff(() =>
      client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        tools: agentTools,
        messages,
      }),
    );

    totalInput += response.usage.input_tokens;
    totalOutput += response.usage.output_tokens;

    // Collect text content for logging
    const textContent = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');

    if (textContent) {
      await log(agentId, projectId, 'info', textContent.slice(0, 2000));
      emit(projectId, 'agent:progress', agentType, layer, textContent.slice(0, 200));
    }

    // Handle stop reason
    if (response.stop_reason === 'end_turn') {
      summary = summary || textContent || 'Agent completed';
      break;
    }

    // Process tool calls
    const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use');
    if (toolUseBlocks.length === 0) break;

    // Add assistant message to conversation
    messages.push({ role: 'assistant', content: response.content });

    // Execute all tool calls and collect results
    const toolResults: MessageParam['content'] = [];
    let done = false;

    for (const block of toolUseBlocks) {
      if (block.type !== 'tool_use') continue;
      const { id: toolUseId, name, input } = block;

      try {
        const result = await executeTool(name, input as Record<string, string>, projectDir);

        if (name === 'createFile' && (input as Record<string, string>).path) {
          filesCreated.push((input as Record<string, string>).path);
        }

        if (result.done) {
          done = true;
          summary = result.summary ?? textContent;
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUseId,
          content: result.result.text,
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        await log(agentId, projectId, 'error', `Tool ${name} failed: ${errMsg}`);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUseId,
          content: `Error: ${errMsg}`,
          is_error: true,
        });
      }
    }

    messages.push({ role: 'user', content: toolResults });

    if (done) break;
  }

  // Update agent DB record with final stats
  await prisma.agent.update({
    where: { id: agentId },
    data: {
      tokensInput: totalInput,
      tokensOutput: totalOutput,
      status: 'completed',
      progress: 100,
      completedAt: new Date(),
    },
  });

  emit(projectId, 'agent:completed', agentType, layer, summary.slice(0, 300));
  await log(agentId, projectId, 'complete', summary.slice(0, 2000));

  return { success: true, summary, tokensInput: totalInput, tokensOutput: totalOutput, filesCreated };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function log(
  agentId: string,
  projectId: string,
  type: string,
  message: string,
): Promise<void> {
  try {
    await prisma.agentLog.create({ data: { agentId, projectId, type, message } });
  } catch {
    // Non-fatal — logging failures must not interrupt the agent
  }
}

function emit(
  projectId: string,
  type: AgentEventType,
  agentType: string,
  layer: number,
  message: string,
): void {
  emitEvent(buildEvent(type, projectId, { agentType, layer, message }));
}

/**
 * @description Calls an async function with exponential backoff on rate limit (HTTP 429) errors.
 * Retries up to MAX_RETRIES times with delays of BACKOFF_BASE_MS * 2^attempt ms.
 */
async function callWithBackoff<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isRateLimit =
        (err instanceof Error && err.message.includes('rate_limit')) ||
        (typeof err === 'object' && err !== null && (err as { status?: number }).status === 429);

      if (isRateLimit && attempt < MAX_RETRIES) {
        const delay = BACKOFF_BASE_MS * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
  // Unreachable — TypeScript needs this
  throw new Error('callWithBackoff: all retries exhausted');
}
