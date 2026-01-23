#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerQueryTools } from './tools/notes-query.js';
import { registerCrudTools } from './tools/notes-crud.js';
import { registerBulkTools } from './tools/notes-bulk.js';
import { registerSystematicTools } from './tools/systematic.js';
import { registerTopicTools } from './tools/topics.js';
import { registerInlineTagTools } from './tools/inline-tags.js';
import { registerBackupTools } from './tools/backup.js';
import { registerAiEnhancedTools } from './tools/ai-enhanced.js';
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
// Register resources
registerResources(server);
// Start the server
async function main() {
    logger.info('Starting SACRED MCP server...');
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info('SACRED MCP server connected and ready');
}
main().catch((error) => {
    logger.error('Failed to start MCP server:', error);
    process.exit(1);
});
