const express = require('express');
const router = express.Router();
const { randomUUID } = require('crypto');
const db = require('../db.cjs');
const manager = require('../connectors/manager.cjs');

const toApiFormat = (row) => ({
  id: row.id,
  name: row.name,
  description: row.description || '',
  transport: row.transport,
  command: row.command || '',
  args: row.args ? JSON.parse(row.args) : [],
  env: row.env ? JSON.parse(row.env) : {},
  url: row.url || '',
  enabled: !!row.enabled,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  status: manager.getStatus(row.id)
});

const getConnectorOr404 = (id, res) => {
  const row = db.prepare('SELECT * FROM connectors WHERE id = ?').get(id);
  if (!row) {
    res.status(404).json({ error: 'Connector not found' });
    return null;
  }
  return row;
};

// GET /api/connectors - list all connectors with live status
router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM connectors ORDER BY name').all();
    res.json(rows.map(toApiFormat));
  } catch (error) {
    console.error('Error listing connectors:', error);
    res.status(500).json({ error: 'Failed to list connectors' });
  }
});

// POST /api/connectors - register a connector
router.post('/', (req, res) => {
  try {
    const { name, description, transport = 'stdio', command, args, env, url, enabled = true } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (transport === 'stdio' && !command) {
      return res.status(400).json({ error: 'stdio connectors require a command' });
    }
    if (transport === 'http' && !url) {
      return res.status(400).json({ error: 'http connectors require a url' });
    }
    if (!['stdio', 'http'].includes(transport)) {
      return res.status(400).json({ error: "transport must be 'stdio' or 'http'" });
    }

    const now = new Date().toISOString();
    const id = randomUUID();
    db.prepare(`
      INSERT INTO connectors (id, name, description, transport, command, args, env, url, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      name.trim(),
      description || null,
      transport,
      command || null,
      args ? JSON.stringify(args) : null,
      env ? JSON.stringify(env) : null,
      url || null,
      enabled ? 1 : 0,
      now,
      now
    );

    const row = db.prepare('SELECT * FROM connectors WHERE id = ?').get(id);
    res.status(201).json(toApiFormat(row));
  } catch (error) {
    console.error('Error creating connector:', error);
    res.status(500).json({ error: 'Failed to create connector' });
  }
});

// PUT /api/connectors/:id - update a connector
router.put('/:id', async (req, res) => {
  try {
    const existing = getConnectorOr404(req.params.id, res);
    if (!existing) return;

    const { name, description, transport, command, args, env, url, enabled } = req.body;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE connectors
      SET name = ?, description = ?, transport = ?, command = ?, args = ?, env = ?, url = ?, enabled = ?, updated_at = ?
      WHERE id = ?
    `).run(
      name !== undefined ? name : existing.name,
      description !== undefined ? description : existing.description,
      transport !== undefined ? transport : existing.transport,
      command !== undefined ? command : existing.command,
      args !== undefined ? JSON.stringify(args) : existing.args,
      env !== undefined ? JSON.stringify(env) : existing.env,
      url !== undefined ? url : existing.url,
      enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
      now,
      req.params.id
    );

    // Config changed: drop any live connection so next use reconnects fresh
    await manager.disconnect(req.params.id);

    const row = db.prepare('SELECT * FROM connectors WHERE id = ?').get(req.params.id);
    res.json(toApiFormat(row));
  } catch (error) {
    console.error('Error updating connector:', error);
    res.status(500).json({ error: 'Failed to update connector' });
  }
});

// DELETE /api/connectors/:id
router.delete('/:id', async (req, res) => {
  try {
    const existing = getConnectorOr404(req.params.id, res);
    if (!existing) return;

    await manager.disconnect(req.params.id);
    db.prepare('DELETE FROM connectors WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting connector:', error);
    res.status(500).json({ error: 'Failed to delete connector' });
  }
});

// POST /api/connectors/:id/test - connect and list tools as a health check
router.post('/:id/test', async (req, res) => {
  try {
    const connector = getConnectorOr404(req.params.id, res);
    if (!connector) return;

    const tools = await manager.listTools(connector);
    res.json({ ok: true, toolCount: tools.length, tools: tools.map((t) => t.name) });
  } catch (error) {
    res.json({ ok: false, error: error.message });
  }
});

// GET /api/connectors/:id/tools - list a connector's tools
router.get('/:id/tools', async (req, res) => {
  try {
    const connector = getConnectorOr404(req.params.id, res);
    if (!connector) return;

    const tools = await manager.listTools(connector);
    res.json(tools);
  } catch (error) {
    console.error('Error listing connector tools:', error);
    res.status(502).json({ error: `Couldn't reach connector: ${error.message}` });
  }
});

// POST /api/connectors/:id/tools/:toolName - invoke a tool
router.post('/:id/tools/:toolName', async (req, res) => {
  try {
    const connector = getConnectorOr404(req.params.id, res);
    if (!connector) return;
    if (!connector.enabled) {
      return res.status(400).json({ error: 'Connector is disabled' });
    }

    const result = await manager.callTool(connector, req.params.toolName, req.body?.arguments || {});

    // Flatten MCP content blocks into displayable text alongside the raw result
    const text = (result.content || [])
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('\n');

    res.json({ ok: !result.isError, text, raw: result });
  } catch (error) {
    console.error('Error calling connector tool:', error);
    res.status(502).json({ error: `Tool call failed: ${error.message}` });
  }
});

module.exports = router;
