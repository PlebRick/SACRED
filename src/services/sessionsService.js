// Sessions Service - API for study session tracking
const API_BASE = '/api/sessions';

export const sessionsService = {
  /**
   * Log a study session
   * @param {Object} data - Session data
   * @param {string} data.sessionType - 'bible', 'doctrine', or 'note'
   * @param {string} data.referenceId - Unique identifier (e.g., 'JHN:3', 'ch32', note UUID)
   * @param {string} [data.referenceLabel] - Human-readable label (e.g., 'John 3', 'The Trinity')
   * @param {number} [data.durationSeconds] - Time spent (for future use)
   */
  log: async (data) => {
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        console.warn('Failed to log session:', res.status);
        return null;
      }
      return res.json();
    } catch (error) {
      // Silently fail - session tracking shouldn't break the app
      console.warn('Session logging error:', error);
      return null;
    }
  },

  /**
   * Get recent study sessions
   * @param {Object} [options]
   * @param {number} [options.limit=50]
   * @param {number} [options.offset=0]
   * @param {string} [options.type] - Filter by session type
   * @param {string} [options.startDate] - Filter by start date (ISO string)
   * @param {string} [options.endDate] - Filter by end date (ISO string)
   */
  getRecent: async (options = {}) => {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', options.limit.toString());
    if (options.offset) params.set('offset', options.offset.toString());
    if (options.type) params.set('type', options.type);
    if (options.startDate) params.set('startDate', options.startDate);
    if (options.endDate) params.set('endDate', options.endDate);

    const res = await fetch(`${API_BASE}?${params}`);
    if (!res.ok) throw new Error('Failed to fetch sessions');
    return res.json();
  },

  /**
   * Get session summary/statistics
   * @param {number} [days=30] - Number of days to include
   */
  getSummary: async (days = 30) => {
    const res = await fetch(`${API_BASE}/summary?days=${days}`);
    if (!res.ok) throw new Error('Failed to fetch session summary');
    return res.json();
  },

  /**
   * Find sessions related to a reference
   * @param {Object} options
   * @param {string} [options.book] - Bible book code
   * @param {number} [options.chapter] - Bible chapter
   * @param {number} [options.doctrineChapter] - Doctrine chapter number
   */
  findRelated: async (options) => {
    const params = new URLSearchParams();
    if (options.book) params.set('book', options.book);
    if (options.chapter) params.set('chapter', options.chapter.toString());
    if (options.doctrineChapter) params.set('doctrineChapter', options.doctrineChapter.toString());

    const res = await fetch(`${API_BASE}/related?${params}`);
    if (!res.ok) throw new Error('Failed to fetch related sessions');
    return res.json();
  }
};

export default sessionsService;
