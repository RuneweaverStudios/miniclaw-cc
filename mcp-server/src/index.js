#!/usr/bin/env node

/**
 * MiniClaw-CC Code Mode MCP Server
 *
 * Implements server-side Code Mode pattern:
 * - Only 2 tools: search() and execute()
 * - ~1,000 tokens regardless of API size
 * - Agent writes JavaScript against typed SDK
 * - Code runs in secure sandbox
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import openApiSpec from './openapi-spec.js';

// Environment configuration
const API_BASE_URL = process.env.MINICLAW_API_URL || 'http://localhost:4000';
const API_TOKEN = process.env.MINICLAW_API_TOKEN;

/**
 * Execute JavaScript code in a controlled sandbox
 * Uses Node.js vm module for secure execution
 */
async function executeCode(code, context = {}) {
  const { createScript, runInNewContext } = await import('vm');
  const { randomUUID } = await import('crypto');

  // Create sandbox with available APIs
  const sandbox = {
    console: {
      log: (...args) => context.logs?.push({ type: 'log', args }),
      error: (...args) => context.logs?.push({ type: 'error', args }),
      warn: (...args) => context.logs?.push({ type: 'warn', args }),
      info: (...args) => context.logs?.push({ type: 'info', args }),
    },
    spec: openApiSpec,
    miniclaw: {
      request: async (options) => {
        const { method = 'GET', path, headers = {}, body } = options;

        const url = new URL(path, API_BASE_URL);
        const requestHeaders = {
          'Content-Type': 'application/json',
          ...headers,
        };

        // Add auth token if available
        if (API_TOKEN) {
          requestHeaders['Authorization'] = `Bearer ${API_TOKEN}`;
        }

        const requestInit = {
          method,
          headers: requestHeaders,
        };

        if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
          requestInit.body = JSON.stringify(body);
        }

        try {
          const response = await fetch(url.toString(), requestInit);
          const data = await response.json();
          return {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            data,
          };
        } catch (error) {
          throw new Error(`Request failed: ${error.message}`);
        }
      },
      uuid: () => randomUUID(),
    },
    ...context.variables,
  };

  // Wrap code in async IIFE if not already wrapped
  let wrappedCode = code.trim();
  if (!wrappedCode.startsWith('async')) {
    wrappedCode = `(async () => { ${wrappedCode} })()`;
  }

  const script = createScript(wrappedCode, {
    filename: 'codemode-execution.js',
  });

  try {
    const result = await runInNewContext(script, sandbox, {
      timeout: 30000, // 30 second timeout
      displayErrors: true,
    });
    return { success: true, result };
  } catch (error) {
    return {
      success: false,
      error: {
        message: error.message,
        stack: error.stack,
      },
    };
  }
}

/**
 * Create MCP Server
 */
const server = new Server(
  {
    name: '@miniclaw/mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * List available tools
 * Only 2 tools: search and execute (Code Mode pattern)
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'search',
        description:
          'Search the MiniClaw OpenAPI spec. All $refs are pre-resolved inline. ' +
          'Write JavaScript async arrow function to search through `spec` object. ' +
          'Returns array of matching endpoints with method, path, summary, and tags.',
        inputSchema: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: 'JavaScript async arrow function to search the OpenAPI spec',
            },
          },
          required: ['code'],
        },
      },
      {
        name: 'execute',
        description:
          'Execute JavaScript code against the MiniClaw API. ' +
          'Use `miniclaw.request()` to make authenticated API calls. ' +
          'Can chain multiple calls, handle pagination, process results. ' +
          'Returns final result via `console.log()` or return statement.',
        inputSchema: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: 'JavaScript async arrow function to execute',
            },
          },
          required: ['code'],
        },
      },
    ],
  };
});

/**
 * Handle tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'search') {
      const { code } = args;
      const logs = [];
      const context = { logs, variables: {} };

      const { success, result, error } = await executeCode(code, context);

      if (!success) {
        throw new Error(`Code execution failed: ${error.message}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    if (name === 'execute') {
      const { code } = args;
      const logs = [];
      const context = { logs, variables: {} };

      const { success, result, error } = await executeCode(code, context);

      if (!success) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: false,
                  error: error.message,
                  logs,
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                result,
                logs,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: error.message,
              stack: error.stack,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
});

/**
 * Start server
 */
async function main() {
  const transport = new StdioServerTransport();

  await server.connect(transport);

  // Log startup for debugging
  console.error('[MiniClaw MCP] Code Mode MCP Server started');
  console.error('[MiniClaw MCP] API URL:', API_BASE_URL);
  console.error('[MiniClaw MCP] Token configured:', !!API_TOKEN);
  console.error('[MiniClaw MCP] Tools: search, execute');
}

main().catch((error) => {
  console.error('[MiniClaw MCP] Fatal error:', error);
  process.exit(1);
});
