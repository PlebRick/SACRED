#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { registerQueryTools } from './tools/notes-query.js';
import { registerCrudTools } from './tools/notes-crud.js';
import { registerBulkTools } from './tools/notes-bulk.js';
import { registerSystematicTools } from './tools/systematic.js';
import { registerTopicTools } from './tools/topics.js';
import { registerInlineTagTools } from './tools/inline-tags.js';
import { registerBackupTools } from './tools/backup.js';
import { registerAiEnhancedTools } from './tools/ai-enhanced.js';
import { registerSessionTools } from './tools/sessions.js';
import { registerSeriesTools } from './tools/series.js';
import { registerResources } from './resources/notes.js';
import { logger } from './utils/logger.js';

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'sacred-bible-notes',
    version: '1.0.0',
  });

  registerQueryTools(server);
  registerCrudTools(server);
  registerBulkTools(server);
  registerSystematicTools(server);
  registerTopicTools(server);
  registerInlineTagTools(server);
  registerBackupTools(server);
  registerAiEnhancedTools(server);
  registerSessionTools(server);
  registerSeriesTools(server);
  registerResources(server);

  return server;
}

// --- Transport selection ---

const mode = process.env.MCP_TRANSPORT || (process.argv.includes('--http') ? 'http' : 'stdio');

async function startStdio() {
  logger.info('Starting SACRED MCP server (stdio)...');
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('SACRED MCP server connected and ready (stdio)');
}

function extractApiKey(req: IncomingMessage): string | undefined {
  // 1. X-API-Key header (curl, Claude Code --header)
  const xApiKey = req.headers['x-api-key'];
  if (typeof xApiKey === 'string') return xApiKey;

  // 2. Authorization: Bearer <key> (Claude.ai OAuth, Anthropic API authorization_token)
  const auth = req.headers['authorization'];
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice(7);

  // 3. URL query param ?key=<key> (Claude.ai connector URL embed)
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const queryKey = url.searchParams.get('key');
  if (queryKey) return queryKey;

  return undefined;
}

function checkAuth(req: IncomingMessage): boolean {
  const expectedKey = process.env.MCP_API_KEY;
  if (!expectedKey) {
    logger.error('MCP_API_KEY not set — refusing all requests');
    return false;
  }
  const provided = extractApiKey(req);
  if (!provided) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(expectedKey);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function startHttp() {
  const port = parseInt(process.env.MCP_PORT || '3002', 10);
  const apiKey = process.env.MCP_API_KEY;
  if (!apiKey) {
    logger.error('MCP_API_KEY env var is required for HTTP mode');
    process.exit(1);
  }

  const ALLOWED_ORIGIN = 'https://claude.ai';

  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
        'Access-Control-Max-Age': '86400',
      });
      res.end();
      return;
    }

    // CORS headers on all responses
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);

    // Request logging for diagnostics
    logger.info(`${req.method} ${req.url} [${req.headers['accept'] || 'no-accept'}] [auth: ${req.headers['authorization'] ? 'Bearer' : req.headers['x-api-key'] ? 'X-API-Key' : 'query/none'}]`);

    // Auth check (X-API-Key header, Authorization: Bearer, or ?key= query param)
    if (!checkAuth(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid or missing API key' }));
      return;
    }

    // Stateless mode: only POST is supported
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed (stateless mode — POST only)' }));
      return;
    }

    // Create fresh server + transport per request
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);

    let body = '';
    for await (const chunk of req) {
      body += chunk;
    }
    try {
      const parsed = JSON.parse(body);
      await transport.handleRequest(req, res, parsed);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON body' }));
    }

    // Clean up after response completes
    res.on('close', () => {
      transport.close();
      server.close();
    });
  });

  httpServer.listen(port, () => {
    logger.info(`SACRED MCP server listening on http://0.0.0.0:${port} (HTTP/stateless)`);
  });
}

// Start
const main = mode === 'http' ? startHttp : startStdio;

main().catch((error) => {
  logger.error('Failed to start MCP server:', error);
  process.exit(1);
});
