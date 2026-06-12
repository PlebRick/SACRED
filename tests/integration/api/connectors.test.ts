import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import path from 'path';
import os from 'os';
import fs from 'fs';

// The vmThreads pool's VM context lacks some web globals that undici
// (a transitive dependency of the server import chain) expects.
import { ReadableStream, WritableStream, TransformStream } from 'node:stream/web';
globalThis.ReadableStream ??= ReadableStream as any;
globalThis.WritableStream ??= WritableStream as any;
globalThis.TransformStream ??= TransformStream as any;

// Isolate the database BEFORE importing any server modules.
// server/db.cjs reads DB_PATH at require time, so the dev database
// (data/sacred.db) is never touched. The require cache for server .cjs
// modules is shared across test files in a worker, so all API test files
// share one temp database (env-guarded) and isolate via beforeEach cleanup.
if (!process.env.SACRED_TEST_DB_DIR) {
  process.env.SACRED_TEST_DB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sacred-api-test-'));
}
process.env.DB_PATH = path.join(process.env.SACRED_TEST_DB_DIR, 'test.db');

let app: express.Application;
let db: any;

describe('Connectors API', () => {
  beforeAll(async () => {
    db = (await import('../../../server/db.cjs')).default;
    const connectorsRouter = (await import('../../../server/routes/connectors.cjs')).default;

    app = express();
    app.use(express.json());
    app.use('/api/connectors', connectorsRouter);
  });

  // Note: the db connection is intentionally never closed here — server/db.cjs
  // is a singleton shared across test files in the same worker.

  beforeEach(() => {
    db.exec('DELETE FROM connectors;');
  });

  const stdioPayload = (overrides: Record<string, unknown> = {}) => ({
    name: 'My MCP Server',
    description: 'Test connector',
    transport: 'stdio',
    command: 'node',
    args: ['server.js', '--verbose'],
    env: { API_KEY: 'secret' },
    ...overrides,
  });

  describe('POST /api/connectors', () => {
    it('creates a stdio connector (201) with camelCase fields', async () => {
      const res = await request(app)
        .post('/api/connectors')
        .send(stdioPayload());

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        name: 'My MCP Server',
        description: 'Test connector',
        transport: 'stdio',
        command: 'node',
        args: ['server.js', '--verbose'],
        env: { API_KEY: 'secret' },
        url: '',
        enabled: true,
      });
      expect(res.body.id).toBeDefined();
      expect(res.body.createdAt).toBeDefined();
      expect(res.body.updatedAt).toBeDefined();
      expect(Array.isArray(res.body.args)).toBe(true);
      expect(typeof res.body.env).toBe('object');
      expect(typeof res.body.enabled).toBe('boolean');
      expect(res.body.status).toEqual({ state: 'idle', error: null });
    });

    it('creates an http connector (201)', async () => {
      const res = await request(app)
        .post('/api/connectors')
        .send({ name: 'Remote MCP', transport: 'http', url: 'https://example.com/mcp' });

      expect(res.status).toBe(201);
      expect(res.body.transport).toBe('http');
      expect(res.body.url).toBe('https://example.com/mcp');
      expect(res.body.command).toBe('');
      expect(res.body.args).toEqual([]);
      expect(res.body.env).toEqual({});
    });

    it('defaults transport to stdio and enabled to true', async () => {
      const res = await request(app)
        .post('/api/connectors')
        .send({ name: 'Default Transport', command: 'node' });

      expect(res.status).toBe(201);
      expect(res.body.transport).toBe('stdio');
      expect(res.body.enabled).toBe(true);
    });

    it('rejects missing name (400)', async () => {
      const res = await request(app)
        .post('/api/connectors')
        .send({ transport: 'stdio', command: 'node' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Name is required');
    });

    it('rejects whitespace-only name (400)', async () => {
      const res = await request(app)
        .post('/api/connectors')
        .send({ name: '   ', transport: 'stdio', command: 'node' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Name is required');
    });

    it('rejects stdio connector without command (400)', async () => {
      const res = await request(app)
        .post('/api/connectors')
        .send({ name: 'No Command', transport: 'stdio' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('stdio connectors require a command');
    });

    it('rejects http connector without url (400)', async () => {
      const res = await request(app)
        .post('/api/connectors')
        .send({ name: 'No URL', transport: 'http' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('http connectors require a url');
    });

    it('rejects invalid transport (400)', async () => {
      const res = await request(app)
        .post('/api/connectors')
        .send({ name: 'Bad Transport', transport: 'websocket' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("transport must be 'stdio' or 'http'");
    });
  });

  describe('GET /api/connectors', () => {
    it('returns empty array when no connectors exist', async () => {
      const res = await request(app).get('/api/connectors');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('lists connectors sorted by name', async () => {
      await request(app).post('/api/connectors').send(stdioPayload({ name: 'Zebra' }));
      await request(app).post('/api/connectors').send(stdioPayload({ name: 'Alpha' }));

      const res = await request(app).get('/api/connectors');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body.map((c: any) => c.name)).toEqual(['Alpha', 'Zebra']);
      expect(res.body[0].status).toEqual({ state: 'idle', error: null });
    });
  });

  describe('PUT /api/connectors/:id', () => {
    it('updates fields and bumps updatedAt', async () => {
      const createRes = await request(app).post('/api/connectors').send(stdioPayload());
      const created = createRes.body;

      // Ensure the updated_at timestamp can actually advance
      await new Promise((resolve) => setTimeout(resolve, 10));

      const res = await request(app)
        .put(`/api/connectors/${created.id}`)
        .send({ name: 'Renamed Server', enabled: false, args: ['other.js'] });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Renamed Server');
      expect(res.body.enabled).toBe(false);
      expect(res.body.args).toEqual(['other.js']);
      // Unchanged fields preserved
      expect(res.body.command).toBe('node');
      expect(res.body.env).toEqual({ API_KEY: 'secret' });
      expect(res.body.createdAt).toBe(created.createdAt);
      expect(new Date(res.body.updatedAt).getTime()).toBeGreaterThan(
        new Date(created.updatedAt).getTime()
      );
    });

    it('returns 404 for missing connector', async () => {
      const res = await request(app)
        .put('/api/connectors/nonexistent-id')
        .send({ name: 'Whatever' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Connector not found');
    });
  });

  describe('DELETE /api/connectors/:id', () => {
    it('deletes a connector', async () => {
      const createRes = await request(app).post('/api/connectors').send(stdioPayload());

      const res = await request(app).delete(`/api/connectors/${createRes.body.id}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });

      const listRes = await request(app).get('/api/connectors');
      expect(listRes.body).toEqual([]);
    });

    it('returns 404 for missing connector', async () => {
      const res = await request(app).delete('/api/connectors/nonexistent-id');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Connector not found');
    });
  });
});
