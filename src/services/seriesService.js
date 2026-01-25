// Series Service - API implementation
const API_BASE = '/api/series';

export const seriesService = {
  getAll: async () => {
    const res = await fetch(API_BASE);
    if (!res.ok) throw new Error('Failed to fetch series');
    return res.json();
  },

  getById: async (id) => {
    const res = await fetch(`${API_BASE}/${id}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('Failed to fetch series');
    return res.json();
  },

  create: async ({ name, description }) => {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description })
    });
    if (!res.ok) throw new Error('Failed to create series');
    return res.json();
  },

  update: async (id, { name, description }) => {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description })
    });
    if (!res.ok) throw new Error('Failed to update series');
    return res.json();
  },

  delete: async (id) => {
    const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete series');
  },

  addSermon: async (seriesId, noteId) => {
    const res = await fetch(`${API_BASE}/${seriesId}/sermons/${noteId}`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to add sermon to series');
    return res.json();
  },

  removeSermon: async (seriesId, noteId) => {
    const res = await fetch(`${API_BASE}/${seriesId}/sermons/${noteId}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to remove sermon from series');
    return res.json();
  }
};

export default seriesService;
