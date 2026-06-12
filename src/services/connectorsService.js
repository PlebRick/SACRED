// Connectors Service - manage user MCP connectors
const API_BASE = '/api/connectors';

export const connectorsService = {
  list: async () => {
    const res = await fetch(API_BASE);
    if (!res.ok) throw new Error('Failed to fetch connectors');
    return res.json();
  },

  create: async (connector) => {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(connector)
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Failed to create connector');
    }
    return res.json();
  },

  update: async (id, updates) => {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update connector');
    return res.json();
  },

  remove: async (id) => {
    const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete connector');
  },

  test: async (id) => {
    const res = await fetch(`${API_BASE}/${id}/test`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to test connector');
    return res.json();
  },

  listTools: async (id) => {
    const res = await fetch(`${API_BASE}/${id}/tools`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Failed to list tools');
    }
    return res.json();
  },

  callTool: async (id, toolName, args) => {
    const res = await fetch(`${API_BASE}/${id}/tools/${encodeURIComponent(toolName)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ arguments: args })
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Tool call failed');
    }
    return res.json();
  }
};

export default connectorsService;
