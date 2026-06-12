import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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

// The assistant reports unavailable when no API key is configured.
const originalApiKey = process.env.ANTHROPIC_API_KEY;
delete process.env.ANTHROPIC_API_KEY;

let app: express.Application;
let db: any;

describe('Assistant API', () => {
  beforeAll(async () => {
    db = (await import('../../../server/db.cjs')).default;
    const assistantRouter = (await import('../../../server/routes/assistant.cjs')).default;

    app = express();
    app.use(express.json());
    app.use('/api/assistant', assistantRouter);
  });

  // Note: the db connection is intentionally never closed here — server/db.cjs
  // is a singleton shared across test files in the same worker.
  afterAll(() => {
    if (originalApiKey !== undefined) {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    }
  });

  describe('GET /api/assistant/status', () => {
    it('reports unavailable with null model when ANTHROPIC_API_KEY is unset', async () => {
      const res = await request(app).get('/api/assistant/status');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ available: false, model: null });
    });
  });

  describe('POST /api/assistant/chat', () => {
    it('returns 503 when the assistant is not configured', async () => {
      const res = await request(app)
        .post('/api/assistant/chat')
        .send({ messages: [{ role: 'user', content: 'Hello' }] });

      expect(res.status).toBe(503);
      expect(res.body.error).toContain('Assistant not configured');
    });

    it('returns 503 before validating the messages payload', async () => {
      const res = await request(app).post('/api/assistant/chat').send({});

      expect(res.status).toBe(503);
      expect(res.body.error).toContain('Assistant not configured');
    });
  });
});
