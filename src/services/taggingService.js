const API_BASE = '/api/tagging';

export const taggingService = {
  analyze: async (noteId, type) => {
    const params = type ? `?type=${type}` : '';
    const res = await fetch(`${API_BASE}/analyze/${noteId}${params}`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to analyze note');
    return res.json();
  },

  getSuggestions: async (noteId, status) => {
    const params = status ? `?status=${status}` : '';
    const res = await fetch(`${API_BASE}/suggestions/${noteId}${params}`);
    if (!res.ok) throw new Error('Failed to get suggestions');
    return res.json();
  },

  apply: async (accepted = [], rejected = []) => {
    const res = await fetch(`${API_BASE}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accepted, rejected }),
    });
    if (!res.ok) throw new Error('Failed to apply suggestions');
    return res.json();
  },

  getQueue: async (book, type) => {
    const params = new URLSearchParams();
    if (book) params.set('book', book);
    if (type) params.set('type', type);
    const qs = params.toString();
    const res = await fetch(`${API_BASE}/queue${qs ? '?' + qs : ''}`);
    if (!res.ok) throw new Error('Failed to get tagging queue');
    return res.json();
  },

  batch: async (mode = 'analyze', noteIds, minConfidence) => {
    const res = await fetch(`${API_BASE}/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, noteIds, minConfidence }),
    });
    if (!res.ok) throw new Error('Failed to run batch tagging');
    return res.json();
  },
};

export default taggingService;
