import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../../setup/test-app';

describe('Sessions API', () => {
  let app: ReturnType<typeof createTestApp>['app'];

  beforeEach(() => {
    const testApp = createTestApp();
    app = testApp.app;
  });

  describe('POST /api/sessions', () => {
    it('creates a Bible study session (201)', async () => {
      const payload = {
        sessionType: 'bible',
        referenceId: 'ROM:3',
        referenceLabel: 'Romans 3',
      };

      const response = await request(app)
        .post('/api/sessions')
        .send(payload)
        .expect(201);

      expect(response.body).toMatchObject({
        sessionType: 'bible',
        referenceId: 'ROM:3',
        referenceLabel: 'Romans 3',
      });
      expect(response.body.id).toBeDefined();
      expect(response.body.createdAt).toBeDefined();
    });

    it('creates a doctrine study session (201)', async () => {
      const payload = {
        sessionType: 'doctrine',
        referenceId: 'ch32',
        referenceLabel: 'The Trinity',
      };

      const response = await request(app)
        .post('/api/sessions')
        .send(payload)
        .expect(201);

      expect(response.body.sessionType).toBe('doctrine');
      expect(response.body.referenceId).toBe('ch32');
    });

    it('creates a note study session (201)', async () => {
      const payload = {
        sessionType: 'note',
        referenceId: 'some-note-uuid',
        referenceLabel: 'My Note Title',
      };

      const response = await request(app)
        .post('/api/sessions')
        .send(payload)
        .expect(201);

      expect(response.body.sessionType).toBe('note');
    });

    it('creates a session without referenceLabel', async () => {
      const payload = {
        sessionType: 'bible',
        referenceId: 'JHN:1',
      };

      const response = await request(app)
        .post('/api/sessions')
        .send(payload)
        .expect(201);

      expect(response.body.referenceLabel).toBeNull();
    });

    it('returns 400 when sessionType is missing', async () => {
      const payload = {
        referenceId: 'ROM:3',
      };

      const response = await request(app)
        .post('/api/sessions')
        .send(payload)
        .expect(400);

      expect(response.body.error).toContain('Missing required fields');
    });

    it('returns 400 when referenceId is missing', async () => {
      const payload = {
        sessionType: 'bible',
      };

      const response = await request(app)
        .post('/api/sessions')
        .send(payload)
        .expect(400);

      expect(response.body.error).toContain('Missing required fields');
    });

    it('returns 400 for invalid sessionType', async () => {
      const payload = {
        sessionType: 'invalid',
        referenceId: 'ROM:3',
      };

      const response = await request(app)
        .post('/api/sessions')
        .send(payload)
        .expect(400);

      expect(response.body.error).toContain('Invalid sessionType');
    });
  });

  describe('GET /api/sessions', () => {
    it('returns empty array when no sessions exist', async () => {
      const response = await request(app)
        .get('/api/sessions')
        .expect(200);

      expect(response.body.sessions).toEqual([]);
      expect(response.body.total).toBe(0);
    });

    it('returns sessions sorted by createdAt DESC', async () => {
      // Create multiple sessions
      await request(app)
        .post('/api/sessions')
        .send({ sessionType: 'bible', referenceId: 'ROM:1', referenceLabel: 'Romans 1' });

      await new Promise((r) => setTimeout(r, 10));

      await request(app)
        .post('/api/sessions')
        .send({ sessionType: 'bible', referenceId: 'ROM:2', referenceLabel: 'Romans 2' });

      await new Promise((r) => setTimeout(r, 10));

      await request(app)
        .post('/api/sessions')
        .send({ sessionType: 'bible', referenceId: 'ROM:3', referenceLabel: 'Romans 3' });

      const response = await request(app)
        .get('/api/sessions')
        .expect(200);

      expect(response.body.sessions).toHaveLength(3);
      // Most recent first
      expect(response.body.sessions[0].referenceId).toBe('ROM:3');
      expect(response.body.sessions[1].referenceId).toBe('ROM:2');
      expect(response.body.sessions[2].referenceId).toBe('ROM:1');
    });

    it('returns sessions with camelCase format', async () => {
      await request(app)
        .post('/api/sessions')
        .send({ sessionType: 'bible', referenceId: 'ROM:1' });

      const response = await request(app)
        .get('/api/sessions')
        .expect(200);

      const session = response.body.sessions[0];
      expect(session).toHaveProperty('sessionType');
      expect(session).toHaveProperty('referenceId');
      expect(session).toHaveProperty('referenceLabel');
      expect(session).toHaveProperty('createdAt');
      // Should NOT have snake_case
      expect(session).not.toHaveProperty('session_type');
      expect(session).not.toHaveProperty('reference_id');
    });

    it('includes total count and pagination info', async () => {
      await request(app)
        .post('/api/sessions')
        .send({ sessionType: 'bible', referenceId: 'ROM:1' });

      const response = await request(app)
        .get('/api/sessions')
        .expect(200);

      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('limit');
      expect(response.body).toHaveProperty('offset');
      expect(response.body.total).toBe(1);
    });
  });

  describe('GET /api/sessions/summary', () => {
    it('returns summary with empty data', async () => {
      const response = await request(app)
        .get('/api/sessions/summary')
        .expect(200);

      expect(response.body).toHaveProperty('period');
      expect(response.body).toHaveProperty('byType');
      expect(response.body).toHaveProperty('topBibleChapters');
      expect(response.body).toHaveProperty('topDoctrines');
      expect(response.body).toHaveProperty('topNotes');
    });

    it('returns counts by session type', async () => {
      // Create sessions of different types
      await request(app)
        .post('/api/sessions')
        .send({ sessionType: 'bible', referenceId: 'ROM:1' });
      await request(app)
        .post('/api/sessions')
        .send({ sessionType: 'bible', referenceId: 'ROM:2' });
      await request(app)
        .post('/api/sessions')
        .send({ sessionType: 'doctrine', referenceId: 'ch32' });

      const response = await request(app)
        .get('/api/sessions/summary')
        .expect(200);

      expect(response.body.byType.bible).toBe(2);
      expect(response.body.byType.doctrine).toBe(1);
    });
  });
});
