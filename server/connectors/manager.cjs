// MCP Connector Manager
//
// SACRED acts as an MCP *client host*: users write or generate MCP servers
// (see docs/CONNECTORS.md), register them as "connectors", and SACRED
// connects over stdio or HTTP to expose their tools in the app and to the
// in-app AI assistant.
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');

const CONNECT_TIMEOUT_MS = 10000;
const CALL_TIMEOUT_MS = 60000;

// connectorId -> { client, transport, connectedAt, configVersion }
const activeClients = new Map();
// connectorId -> last error message (for status reporting)
const lastErrors = new Map();

const withTimeout = (promise, ms, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    )
  ]);

const parseJson = (text, fallback) => {
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
};

const buildTransport = (connector) => {
  if (connector.transport === 'http') {
    if (!connector.url) throw new Error('HTTP connector has no URL configured');
    return new StreamableHTTPClientTransport(new URL(connector.url));
  }
  if (!connector.command) throw new Error('stdio connector has no command configured');
  const args = parseJson(connector.args, []);
  const extraEnv = parseJson(connector.env, {});
  return new StdioClientTransport({
    command: connector.command,
    args,
    env: { ...process.env, ...extraEnv },
    stderr: 'ignore'
  });
};

// Connect (or reuse a cached connection) for a connector row from the DB.
// updated_at doubles as a config version: editing a connector drops the old client.
const getClient = async (connector) => {
  const cached = activeClients.get(connector.id);
  if (cached && cached.configVersion === connector.updated_at) {
    return cached.client;
  }
  if (cached) {
    await disconnect(connector.id);
  }

  const transport = buildTransport(connector);
  const client = new Client({ name: 'sacred', version: '0.4.0' });

  try {
    await withTimeout(client.connect(transport), CONNECT_TIMEOUT_MS, 'Connect');
    lastErrors.delete(connector.id);
  } catch (error) {
    lastErrors.set(connector.id, error.message);
    try { await transport.close(); } catch { /* already failed */ }
    throw error;
  }

  activeClients.set(connector.id, {
    client,
    transport,
    connectedAt: new Date().toISOString(),
    configVersion: connector.updated_at
  });
  return client;
};

const disconnect = async (connectorId) => {
  const entry = activeClients.get(connectorId);
  if (!entry) return;
  activeClients.delete(connectorId);
  try {
    await entry.client.close();
  } catch {
    // Client may already be dead; nothing to do
  }
};

const listTools = async (connector) => {
  const client = await getClient(connector);
  try {
    const result = await withTimeout(client.listTools(), CALL_TIMEOUT_MS, 'listTools');
    return (result.tools || []).map((t) => ({
      name: t.name,
      description: t.description || '',
      inputSchema: t.inputSchema || { type: 'object', properties: {} }
    }));
  } catch (error) {
    lastErrors.set(connector.id, error.message);
    await disconnect(connector.id);
    throw error;
  }
};

const callTool = async (connector, toolName, args) => {
  const client = await getClient(connector);
  try {
    const result = await withTimeout(
      client.callTool({ name: toolName, arguments: args || {} }),
      CALL_TIMEOUT_MS,
      `Tool ${toolName}`
    );
    lastErrors.delete(connector.id);
    return result;
  } catch (error) {
    lastErrors.set(connector.id, error.message);
    await disconnect(connector.id);
    throw error;
  }
};

const getStatus = (connectorId) => {
  if (activeClients.has(connectorId)) return { state: 'connected', error: null };
  if (lastErrors.has(connectorId)) return { state: 'error', error: lastErrors.get(connectorId) };
  return { state: 'idle', error: null };
};

const shutdownAll = async () => {
  await Promise.all([...activeClients.keys()].map((id) => disconnect(id)));
};

process.on('exit', () => {
  // Best effort: stdio transports kill their child process on close
  for (const entry of activeClients.values()) {
    try { entry.transport.close(); } catch { /* exiting anyway */ }
  }
});

module.exports = { getClient, disconnect, listTools, callTool, getStatus, shutdownAll };
