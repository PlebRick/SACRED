// Suggestions Service - AI enrichment suggestions for notes
const API_BASE = '/api/notes';

export const suggestionsService = {
  getForNote: async (noteId) => {
    const res = await fetch(`${API_BASE}/${noteId}/suggestions`);
    if (!res.ok) throw new Error('Failed to fetch suggestions');
    return res.json();
  },

  accept: async (suggestionId) => {
    const res = await fetch(`${API_BASE}/suggestions/${suggestionId}/accept`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to accept suggestion');
    return res.json();
  },

  dismiss: async (suggestionId) => {
    const res = await fetch(`${API_BASE}/suggestions/${suggestionId}/dismiss`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to dismiss suggestion');
    return res.json();
  }
};

export default suggestionsService;
