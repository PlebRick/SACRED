// Coverage Service - pulpit coverage statistics
const API_BASE = '/api/coverage';

export const coverageService = {
  get: async () => {
    const res = await fetch(API_BASE);
    if (!res.ok) throw new Error('Failed to fetch coverage statistics');
    return res.json();
  }
};

export default coverageService;
