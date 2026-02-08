#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID, timingSafeEqual } from 'node:crypto';
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

const server = new McpServer({
  name: 'sacred-bible-notes',
  version: '1.0.0',
});

// Register tools
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

// Register resources
registerResources(server);

// --- Transport selection ---

const mode = process.env.MCP_TRANSPORT || (process.argv.includes('--http') ? 'http' : 'stdio');

async function startStdio() {
  logger.info('Starting SACRED MCP server (stdio)...');
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('SACRED MCP server connected and ready (stdio)');
}

function checkApiKey(req: IncomingMessage): boolean {
  const expectedKey = process.env.MCP_API_KEY;
  if (!expectedKey) {
    logger.error('MCP_API_KEY not set — refusing all requests');
    return false;
  }
  const provided = req.headers['x-api-key'];
  if (typeof provided !== 'string') return false;

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

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  await server.connect(transport);

  const ALLOWED_ORIGIN = 'https://claude.ai';

  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Mcp-Session-Id',
        'Access-Control-Expose-Headers': 'Mcp-Session-Id',
        'Access-Control-Max-Age': '86400',
      });
      res.end();
      return;
    }

    // CORS headers on all responses
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');

    // Auth check
    if (!checkApiKey(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid or missing X-API-Key' }));
      return;
    }

    // Parse JSON body for POST
    if (req.method === 'POST') {
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
      return;
    }

    // GET (SSE stream) and DELETE (session close) — no body needed
    await transport.handleRequest(req, res);
  });

  httpServer.listen(port, () => {
    logger.info(`SACRED MCP server listening on http://0.0.0.0:${port} (HTTP/streamable)`);
  });
}

// Start
const main = mode === 'http' ? startHttp : startStdio;

main().catch((error) => {
  logger.error('Failed to start MCP server:', error);
  process.exit(1);
});
