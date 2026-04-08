import type { Tool } from '@anthropic-ai/sdk/resources/messages.js';

/**
 * @description Tool definitions sent to Claude for agent Tool Use.
 * Each agent receives these 4 tools in every API call.
 */
export const agentTools: Tool[] = [
  {
    name: 'createFile',
    description:
      'Creates or overwrites a file in the project directory. The path must be relative to the project root (e.g. src/index.ts). Parent directories are created automatically.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path relative to the project root. Must not start with / or contain ../',
        },
        content: {
          type: 'string',
          description: 'Full content to write to the file.',
        },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'readFile',
    description:
      'Reads an existing file from the project directory. Returns the file content as a string.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path relative to the project root. Must not start with / or contain ../',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'listFiles',
    description:
      'Lists all files in a directory (or project root if path is empty). Returns an array of relative file paths.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Directory path relative to the project root. Pass empty string for root.',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'taskComplete',
    description:
      'Call this tool when you have finished all your tasks for this layer. Pass a brief summary of what was generated.',
    input_schema: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: 'Short summary of what was created or modified.',
        },
      },
      required: ['summary'],
    },
  },
];
