import type { MessageParam } from '@anthropic-ai/sdk/resources/messages.js';
import { getAnthropicClient } from '../lib/anthropic.js';
import { agentTools } from './tool-definitions.js';
import { executeTool } from './tool-executor.js';
import type { AgentEventType } from '../websocket/ws.emitter.js';
import { emitEvent, buildEvent } from '../websocket/ws.emitter.js';
import prisma from '../lib/prisma.js';
import { isShuttingDown } from '../lib/shutdown-state.js';

const MODEL = 'claude-opus-4-5';
const MAX_TOKENS = 8192;
const TOOL_USE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes per agent
const MAX_TURNS = 50; // safety limit
const MAX_RETRIES = 3; // exponential backoff retries for rate limit errors
const BACKOFF_BASE_MS = 1000; // 1s, 2s, 4s
const CLAUDE_CALL_TIMEOUT_MS = parseInt(process.env.CLAUDE_CALL_TIMEOUT_MS ?? '120000', 10);
const AGENT_MEMORY_WARN_MB = parseInt(process.env.AGENT_MEMORY_WARN_MB ?? '200', 10);
const AGENT_MEMORY_TRUNCATE_MB = parseInt(process.env.AGENT_MEMORY_TRUNCATE_MB ?? '500', 10);

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
  const baseHeap = process.memoryUsage().heapUsed;

  emit(projectId, 'agent:started', agentType, layer, `Layer ${layer} agent started`);

  while (turns < MAX_TURNS) {
    if (Date.now() > deadline) {
      throw new Error(`Agent timeout after ${TOOL_USE_TIMEOUT_MS / 1000}s`);
    }

    // Graceful shutdown — pause agent before next Claude call
    if (isShuttingDown()) {
      await prisma.agent.update({
        where: { id: agentId },
        data: { status: 'paused' },
      });
      emit(projectId, 'project:paused', agentType, layer, 'Agent paused due to shutdown signal');
      return { success: false, summary: 'paused', tokensInput: totalInput, tokensOutput: totalOutput, filesCreated };
    }

    turns++;

    const response = await callWithBackoff((signal) =>
      client.messages.create(
        {
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: systemPrompt,
          tools: agentTools,
          messages,
        },
        { signal },
      ),
    );

    totalInput += response.usage.input_tokens;
    totalOutput += response.usage.output_tokens;

    // Memory monitoring: check heap growth after each Claude response
    const heapDeltaMB = (process.memoryUsage().heapUsed - baseHeap) / (1024 * 1024);
    if (heapDeltaMB > AGENT_MEMORY_TRUNCATE_MB) {
      const truncateCount = Math.max(1, Math.floor(messages.length * 0.3));
      messages.splice(0, truncateCount);
      emit(projectId, 'agent:warning', agentType, layer, `Memory truncation: removed ${truncateCount} messages (heap +${heapDeltaMB.toFixed(0)}MB)`);
    } else if (heapDeltaMB > AGENT_MEMORY_WARN_MB) {
      emit(projectId, 'agent:warning', agentType, layer, `Memory warning: heap delta ${heapDeltaMB.toFixed(0)}MB`);
    }

    // Persist assistant message (fire-and-forget — non-fatal)
    void persistMessage(agentId, projectId, turns, 'assistant', response.content, response.usage.output_tokens);

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
        const result = await executeTool(name, input as Record<string, string>, projectDir, async (relPath, sizeBytes) => {
          await prisma.generatedFile.upsert({
            where: { uq_generated_files_project_path: { projectId, path: relPath } },
            create: { projectId, agentId, name: relPath.split('/').pop() ?? relPath, path: relPath, sizeBytes, layer },
            update: { agentId, sizeBytes },
          });
        });

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

    // Persist user tool-result message (fire-and-forget — non-fatal)
    void persistMessage(agentId, projectId, turns, 'user', toolResults, 0);

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
async function callWithBackoff<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CLAUDE_CALL_TIMEOUT_MS);
    try {
      return await fn(controller.signal);
    } catch (err) {
      const isRateLimit =
        (err instanceof Error && err.message.includes('rate_limit')) ||
        (typeof err === 'object' && err !== null && (err as { status?: number }).status === 429);
      const isAbort = err instanceof Error && err.name === 'AbortError';

      if ((isRateLimit || isAbort) && attempt < MAX_RETRIES) {
        const delay = BACKOFF_BASE_MS * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  // Unreachable — TypeScript needs this
  throw new Error('callWithBackoff: all retries exhausted');
}

/**
 * @description Persists a single conversation message to agent_messages table.
 * Fire-and-forget: failures are silently swallowed to never interrupt the agent.
 */
async function persistMessage(
  agentId: string,
  projectId: string,
  turn: number,
  role: 'user' | 'assistant',
  content: unknown,
  tokens: number,
): Promise<void> {
  try {
    await prisma.agentMessage.create({
      data: { agentId, projectId, turn, role, content: content as import('@prisma/client').Prisma.InputJsonValue, tokens },
    });
  } catch {
    // Non-fatal — message persistence must not interrupt the agent
  }
}

/**
 * @description Reconstructs the MessageParam conversation history from the agent_messages table.
 * Used on crash recovery to resume from the last persisted message instead of starting fresh.
 */
export async function reconstructMessages(agentId: string): Promise<MessageParam[]> {
  const rows = await prisma.agentMessage.findMany({
    where: { agentId },
    orderBy: { turn: 'asc' },
    select: { role: true, content: true, turn: true },
  });
  // Also sort client-side as a defensive measure
  rows.sort((a, b) => a.turn - b.turn);
  return rows.map((r) => ({ role: r.role as 'user' | 'assistant', content: r.content as MessageParam['content'] }));
}

