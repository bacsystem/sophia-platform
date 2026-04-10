import type { Tool } from '@anthropic-ai/sdk/resources/messages.js';

/**
 * Reserved output filenames with a fixed JSON schema.
 * Agents MUST write these files using the specified structure.
 *
 * test-mapping.json — Written by the QA agent after all tests are created.
 * Schema:
 * {
 *   "mappings": [
 *     {
 *       "criteriaId": "HU-14.CA-01",   // from spec acceptance criteria
 *       "testFile": "src/__tests__/foo.test.ts" | null,
 *       "testName": "should validate input" | null,
 *       "type": "unit" | "integration" | null
 *     }
 *   ]
 * }
 * Every acceptance criterion extracted from the spec MUST have an entry.
 * Use null values when a criterion has no corresponding test.
 */
export const RESERVED_OUTPUT_SCHEMAS = {
  'test-mapping.json': {
    type: 'object',
    required: ['mappings'],
    properties: {
      mappings: {
        type: 'array',
        items: {
          type: 'object',
          required: ['criteriaId', 'testFile', 'testName', 'type'],
          properties: {
            criteriaId: { type: 'string', description: 'Acceptance criteria ID (e.g. HU-14.CA-01)' },
            testFile: { type: ['string', 'null'], description: 'Relative path to the test file, or null if not covered' },
            testName: { type: ['string', 'null'], description: 'Exact test name/description, or null if not covered' },
            type: { type: ['string', 'null'], enum: ['unit', 'integration', null], description: 'Test type' },
          },
        },
      },
    },
  },
} as const;

/**
 * @description Tool definitions sent to Claude for agent Tool Use.
 * Each agent receives these 4 tools in every API call.
 */
export const agentTools: Tool[] = [
  {
    name: 'createFile',
    description:
      'Creates or overwrites a file in the project directory. The path must be relative to the project root (e.g. src/index.ts). Parent directories are created automatically. When path is "test-mapping.json", you MUST follow the reserved schema documented in RESERVED_OUTPUT_SCHEMAS.',
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
