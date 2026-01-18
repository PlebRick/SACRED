// Topics Service - API implementation
const API_BASE = '/api/topics';

export const topicsService = {
  // Get full topic tree with note counts
  getTree: async () => {
    const res = await fetch(API_BASE);
    if (!res.ok) throw new Error('Failed to fetch topics');
    return res.json();
  },

  // Get flat list of all topics (for dropdowns)
  getFlat: async () => {
    const res = await fetch(`${API_BASE}/flat`);
    if (!res.ok) throw new Error('Failed to fetch topics');
    return res.json();
  },

  // Get single topic by ID
  getById: async (id) => {
    const res = await fetch(`${API_BASE}/${id}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('Failed to fetch topic');
    return res.json();
  },

  // Get notes for a topic (including all descendants)
  getNotes: async (id) => {
    const res = await fetch(`${API_BASE}/${id}/notes`);
    if (!res.ok) throw new Error('Failed to fetch notes for topic');
    return res.json();
  },

  // Create new topic
  create: async (topicData) => {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(topicData)
    });
    if (!res.ok) throw new Error('Failed to create topic');
    return res.json();
  },

  // Update topic
  update: async (id, updates) => {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update topic');
    return res.json();
  },

  // Delete topic (cascades to children)
  delete: async (id) => {
    const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete topic');
  },

  // Seed default topics
  seed: async () => {
    const res = await fetch(`${API_BASE}/seed`, { method: 'POST' });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to seed topics');
    }
    return res.json();
  }
};

export default topicsService;
