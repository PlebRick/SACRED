// Inline Tags Service - API implementation
const API_BASE = '/api/inline-tags';

export const inlineTagsService = {
  // ============== Tag Types ==============

  // Get all tag types
  getTypes: async () => {
    const res = await fetch(`${API_BASE}/types`);
    if (!res.ok) throw new Error('Failed to fetch inline tag types');
    return res.json();
  },

  // Create custom tag type
  createType: async (typeData) => {
    const res = await fetch(`${API_BASE}/types`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(typeData)
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to create tag type');
    }
    return res.json();
  },

  // Update tag type
  updateType: async (id, updates) => {
    const res = await fetch(`${API_BASE}/types/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to update tag type');
    }
    return res.json();
  },

  // Delete tag type (only non-default)
  deleteType: async (id) => {
    const res = await fetch(`${API_BASE}/types/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to delete tag type');
    }
  },

  // Seed default tag types
  seedTypes: async () => {
    const res = await fetch(`${API_BASE}/types/seed`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to seed tag types');
    return res.json();
  },

  // ============== Tag Instances ==============

  // Get all inline tags with optional filters
  getTags: async ({ tagType, book, search, limit, offset } = {}) => {
    const params = new URLSearchParams();
    if (tagType) params.append('tagType', tagType);
    if (book) params.append('book', book);
    if (search) params.append('search', search);
    if (limit) params.append('limit', limit);
    if (offset) params.append('offset', offset);

    const url = `${API_BASE}${params.toString() ? `?${params}` : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch inline tags');
    return res.json();
  },

  // Get counts grouped by tag type
  getCountsByType: async () => {
    const res = await fetch(`${API_BASE}/by-type`);
    if (!res.ok) throw new Error('Failed to fetch inline tag counts');
    return res.json();
  },

  // Full-text search tagged content
  search: async (query, limit = 50) => {
    const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    if (!res.ok) throw new Error('Failed to search inline tags');
    return res.json();
  }
};

export default inlineTagsService;
