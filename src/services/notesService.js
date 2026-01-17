// Notes Service - API implementation
const API_BASE = '/api/notes';

export const notesService = {
  getAll: async () => {
    const res = await fetch(API_BASE);
    if (!res.ok) throw new Error('Failed to fetch notes');
    return res.json();
  },

  getById: async (id) => {
    const res = await fetch(`${API_BASE}/${id}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('Failed to fetch note');
    return res.json();
  },

  getByReference: async (book, chapter) => {
    const res = await fetch(`${API_BASE}/chapter/${encodeURIComponent(book)}/${chapter}`);
    if (!res.ok) throw new Error('Failed to fetch notes');
    return res.json();
  },

  create: async (noteData) => {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(noteData)
    });
    if (!res.ok) throw new Error('Failed to create note');
    return res.json();
  },

  update: async (id, updates) => {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update note');
    return res.json();
  },

  delete: async (id) => {
    const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete note');
  }
};

export default notesService;
