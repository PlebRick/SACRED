// Systematic Theology Service - API implementation
const API_BASE = '/api/systematic';

export const systematicService = {
  // Get all entries as tree structure
  getAll: async () => {
    const res = await fetch(API_BASE);
    if (!res.ok) throw new Error('Failed to fetch systematic theology');
    return res.json();
  },

  // Get all entries as flat list
  getFlat: async () => {
    const res = await fetch(`${API_BASE}/flat`);
    if (!res.ok) throw new Error('Failed to fetch systematic theology');
    return res.json();
  },

  // Get single entry by ID
  getById: async (id) => {
    const res = await fetch(`${API_BASE}/${id}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('Failed to fetch entry');
    return res.json();
  },

  // Get chapter with all sections
  getChapter: async (chapterNum) => {
    const res = await fetch(`${API_BASE}/chapter/${chapterNum}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('Failed to fetch chapter');
    return res.json();
  },

  // Get doctrines for a Bible passage
  getForPassage: async (book, chapter) => {
    const res = await fetch(`${API_BASE}/for-passage/${encodeURIComponent(book)}/${chapter}`);
    if (!res.ok) throw new Error('Failed to fetch doctrines for passage');
    return res.json();
  },

  // Get all tags
  getTags: async () => {
    const res = await fetch(`${API_BASE}/tags`);
    if (!res.ok) throw new Error('Failed to fetch tags');
    return res.json();
  },

  // Get chapters by tag
  getByTag: async (tagId) => {
    const res = await fetch(`${API_BASE}/by-tag/${encodeURIComponent(tagId)}`);
    if (!res.ok) throw new Error('Failed to fetch chapters by tag');
    return res.json();
  },

  // Search entries
  search: async (query, limit = 20) => {
    const params = new URLSearchParams({ q: query, limit: limit.toString() });
    const res = await fetch(`${API_BASE}/search?${params}`);
    if (!res.ok) throw new Error('Failed to search');
    return res.json();
  },

  // Get summary statistics
  getSummary: async () => {
    const res = await fetch(`${API_BASE}/summary`);
    if (!res.ok) throw new Error('Failed to fetch summary');
    return res.json();
  },

  // Add annotation to an entry
  addAnnotation: async (systematicId, annotationData) => {
    const res = await fetch(`${API_BASE}/${systematicId}/annotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(annotationData)
    });
    if (!res.ok) throw new Error('Failed to add annotation');
    return res.json();
  },

  // Get annotations for an entry
  getAnnotations: async (systematicId) => {
    const res = await fetch(`${API_BASE}/${systematicId}/annotations`);
    if (!res.ok) throw new Error('Failed to fetch annotations');
    return res.json();
  },

  // Delete annotation
  deleteAnnotation: async (annotationId) => {
    const res = await fetch(`${API_BASE}/annotations/${annotationId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete annotation');
  },

  // Get notes that reference this entry
  getReferencingNotes: async (systematicId) => {
    const res = await fetch(`${API_BASE}/${systematicId}/referencing-notes`);
    if (!res.ok) throw new Error('Failed to fetch referencing notes');
    return res.json();
  }
};

export default systematicService;
