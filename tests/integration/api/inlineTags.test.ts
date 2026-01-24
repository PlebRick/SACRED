import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';

// Mock types for inline tags
interface MockTagType {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  is_default: number;
  sort_order: number;
  created_at: string;
}

interface MockInlineTag {
  id: string;
  note_id: string;
  tag_type: string;
  text_content: string;
  html_fragment: string;
  position_start: number;
  position_end: number;
  created_at: string;
  note_title?: string;
  book?: string;
  start_chapter?: number;
  start_verse?: number;
  end_chapter?: number;
  end_verse?: number;
}

// In-memory storage
let tagTypes: Map<string, MockTagType>;
let inlineTags: Map<string, MockInlineTag>;
let notes: Map<string, any>;

// Mock db
const mockDb = {
  prepare: vi.fn((sql: string) => {
    const sqlLower = sql.toLowerCase().trim();

    // Tag types queries
    if (sqlLower.includes('select * from inline_tag_types') && sqlLower.includes('order by sort_order')) {
      return {
        all: () => Array.from(tagTypes.values()).sort((a, b) => a.sort_order - b.sort_order),
        get: () => undefined,
        run: () => ({ changes: 0 }),
      };
    }

    if (sqlLower.includes('select * from inline_tag_types where id')) {
      return {
        all: () => [],
        get: (id: string) => tagTypes.get(id),
        run: () => ({ changes: 0 }),
      };
    }

    if (sqlLower.includes('select max(sort_order)')) {
      return {
        all: () => [],
        get: () => {
          const types = Array.from(tagTypes.values());
          if (types.length === 0) return { max: 0 };
          return { max: Math.max(...types.map(t => t.sort_order)) };
        },
        run: () => ({ changes: 0 }),
      };
    }

    if (sqlLower.startsWith('insert into inline_tag_types')) {
      return {
        all: () => [],
        get: () => undefined,
        // Note: is_default is a literal 0 in the SQL, not a parameter
        run: (id: string, name: string, color: string, icon: string | null, sortOrder: number, createdAt: string) => {
          const existing = Array.from(tagTypes.values()).find(t => t.name === name);
          if (existing) {
            const err: any = new Error('UNIQUE constraint failed');
            err.code = 'SQLITE_CONSTRAINT_UNIQUE';
            throw err;
          }
          tagTypes.set(id, {
            id,
            name,
            color,
            icon,
            is_default: 0, // Always 0 for custom tag types
            sort_order: sortOrder,
            created_at: createdAt,
          });
          return { changes: 1 };
        },
      };
    }

    if (sqlLower.startsWith('update inline_tag_types')) {
      return {
        all: () => [],
        get: () => undefined,
        run: (name: string, color: string, icon: string | null, sortOrder: number, id: string) => {
          const existing = tagTypes.get(id);
          if (!existing) return { changes: 0 };
          // Check for duplicate name
          const duplicate = Array.from(tagTypes.values()).find(t => t.name === name && t.id !== id);
          if (duplicate) {
            const err: any = new Error('UNIQUE constraint failed');
            err.code = 'SQLITE_CONSTRAINT_UNIQUE';
            throw err;
          }
          tagTypes.set(id, { ...existing, name, color, icon, sort_order: sortOrder });
          return { changes: 1 };
        },
      };
    }

    if (sqlLower.startsWith('delete from inline_tag_types')) {
      return {
        all: () => [],
        get: () => undefined,
        run: (id: string) => {
          if (!tagTypes.has(id)) return { changes: 0 };
          tagTypes.delete(id);
          return { changes: 1 };
        },
      };
    }

    // Search query - must be before general inline tags query
    if (sqlLower.includes('where it.text_content like') && !sqlLower.includes('and it.tag_type')) {
      return {
        all: (query: string, limit: number) => {
          const searchTerm = query.replace(/%/g, '').toLowerCase();
          const results = Array.from(inlineTags.values())
            .filter(tag => tag.text_content.toLowerCase().includes(searchTerm))
            .map(tag => {
              const note = notes.get(tag.note_id);
              return {
                ...tag,
                note_title: note?.title || '',
                book: note?.book || '',
                start_chapter: note?.start_chapter || 0,
                start_verse: note?.start_verse || null,
                end_chapter: note?.end_chapter || 0,
                end_verse: note?.end_verse || null,
              };
            })
            .slice(0, limit);
          return results;
        },
        get: () => undefined,
        run: () => ({ changes: 0 }),
      };
    }

    // Inline tags queries (general)
    if (sqlLower.includes('select it.*') && sqlLower.includes('from inline_tags it') && sqlLower.includes('join notes n')) {
      return {
        all: (...args: any[]) => {
          let results = Array.from(inlineTags.values());

          // Check for filters in args
          const filters: any = {};
          if (sqlLower.includes('and it.tag_type')) {
            filters.tagType = args[0];
          }

          results = results.filter(tag => {
            const note = notes.get(tag.note_id);
            if (!note) return false;
            if (filters.tagType && tag.tag_type !== filters.tagType) return false;
            return true;
          }).map(tag => {
            const note = notes.get(tag.note_id);
            return {
              ...tag,
              note_title: note?.title || '',
              book: note?.book || '',
              start_chapter: note?.start_chapter || 0,
              start_verse: note?.start_verse || null,
              end_chapter: note?.end_chapter || 0,
              end_verse: note?.end_verse || null,
            };
          });

          return results;
        },
        get: () => undefined,
        run: () => ({ changes: 0 }),
      };
    }

    // By-type counts query
    if (sqlLower.includes('select itt.*') && sqlLower.includes('count(it.id) as count')) {
      return {
        all: () => {
          const types = Array.from(tagTypes.values()).sort((a, b) => a.sort_order - b.sort_order);
          return types.map(type => {
            const count = Array.from(inlineTags.values()).filter(t => t.tag_type === type.id).length;
            return { ...type, count };
          });
        },
        get: () => undefined,
        run: () => ({ changes: 0 }),
      };
    }

    // Default fallback
    return {
      all: () => [],
      get: () => undefined,
      run: () => ({ changes: 0 }),
    };
  }),
};

// Create router with mocked db
function createInlineTagsRouter() {
  const router = express.Router();
  const db = mockDb;

  const tagTypeToApiFormat = (row: MockTagType) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    isDefault: row.is_default === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  });

  const inlineTagToApiFormat = (row: MockInlineTag) => ({
    id: row.id,
    noteId: row.note_id,
    tagType: row.tag_type,
    textContent: row.text_content,
    htmlFragment: row.html_fragment,
    positionStart: row.position_start,
    positionEnd: row.position_end,
    createdAt: row.created_at,
    noteTitle: row.note_title,
    book: row.book,
    startChapter: row.start_chapter,
    startVerse: row.start_verse,
    endChapter: row.end_chapter,
    endVerse: row.end_verse,
  });

  // GET /types
  router.get('/types', (req, res) => {
    try {
      const types = db.prepare('SELECT * FROM inline_tag_types ORDER BY sort_order').all();
      res.json(types.map(tagTypeToApiFormat));
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch inline tag types' });
    }
  });

  // POST /types
  router.post('/types', (req, res) => {
    try {
      const { name, color, icon } = req.body;

      if (!name || !color) {
        return res.status(400).json({ error: 'Missing required fields: name, color' });
      }

      const maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM inline_tag_types').get().max || 0;

      const id = uuidv4();
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO inline_tag_types (id, name, color, icon, is_default, sort_order, created_at)
        VALUES (?, ?, ?, ?, 0, ?, ?)
      `).run(id, name, color, icon || null, maxOrder + 1, now);

      const type = db.prepare('SELECT * FROM inline_tag_types WHERE id = ?').get(id);
      res.status(201).json(tagTypeToApiFormat(type));
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(400).json({ error: 'A tag type with this name already exists' });
      }
      res.status(500).json({ error: 'Failed to create inline tag type' });
    }
  });

  // PUT /types/:id
  router.put('/types/:id', (req, res) => {
    try {
      const { id } = req.params;
      const existing = db.prepare('SELECT * FROM inline_tag_types WHERE id = ?').get(id);

      if (!existing) {
        return res.status(404).json({ error: 'Tag type not found' });
      }

      const {
        name = existing.name,
        color = existing.color,
        icon = existing.icon,
        sortOrder = existing.sort_order,
      } = req.body;

      db.prepare(`
        UPDATE inline_tag_types
        SET name = ?, color = ?, icon = ?, sort_order = ?
        WHERE id = ?
      `).run(name, color, icon, sortOrder, id);

      const type = db.prepare('SELECT * FROM inline_tag_types WHERE id = ?').get(id);
      res.json(tagTypeToApiFormat(type));
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(400).json({ error: 'A tag type with this name already exists' });
      }
      res.status(500).json({ error: 'Failed to update inline tag type' });
    }
  });

  // DELETE /types/:id
  router.delete('/types/:id', (req, res) => {
    try {
      const { id } = req.params;
      const existing = db.prepare('SELECT * FROM inline_tag_types WHERE id = ?').get(id);

      if (!existing) {
        return res.status(404).json({ error: 'Tag type not found' });
      }

      if (existing.is_default === 1) {
        return res.status(400).json({ error: 'Cannot delete default tag types' });
      }

      db.prepare('DELETE FROM inline_tag_types WHERE id = ?').run(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete inline tag type' });
    }
  });

  // GET /
  router.get('/', (req, res) => {
    try {
      const { tagType, book, search, limit = 100, offset = 0 } = req.query;

      let query = `
        SELECT it.*, n.title as note_title, n.book, n.start_chapter, n.start_verse, n.end_chapter, n.end_verse
        FROM inline_tags it
        JOIN notes n ON it.note_id = n.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (tagType) {
        query += ' AND it.tag_type = ?';
        params.push(tagType);
      }

      if (book) {
        query += ' AND n.book = ?';
        params.push(book);
      }

      if (search) {
        query += ' AND it.text_content LIKE ?';
        params.push(`%${search}%`);
      }

      query += ' ORDER BY n.book, n.start_chapter, n.start_verse LIMIT ? OFFSET ?';
      params.push(parseInt(limit as string), parseInt(offset as string));

      const tags = db.prepare(query).all(...params);
      res.json(tags.map(inlineTagToApiFormat));
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch inline tags' });
    }
  });

  // GET /by-type
  router.get('/by-type', (req, res) => {
    try {
      const counts = db.prepare(`
        SELECT itt.*, COUNT(it.id) as count
        FROM inline_tag_types itt
        LEFT JOIN inline_tags it ON itt.id = it.tag_type
        GROUP BY itt.id
        ORDER BY itt.sort_order
      `).all();

      res.json(counts.map((row: any) => ({
        ...tagTypeToApiFormat(row),
        count: row.count,
      })));
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch inline tag counts' });
    }
  });

  // GET /search
  router.get('/search', (req, res) => {
    try {
      const { q, limit = 50 } = req.query;

      if (!q) {
        return res.status(400).json({ error: 'Missing query parameter: q' });
      }

      const tags = db.prepare(`
        SELECT it.*, n.title as note_title, n.book, n.start_chapter, n.start_verse, n.end_chapter, n.end_verse
        FROM inline_tags it
        JOIN notes n ON it.note_id = n.id
        WHERE it.text_content LIKE ?
        ORDER BY n.book, n.start_chapter, n.start_verse
        LIMIT ?
      `).all(`%${q}%`, parseInt(limit as string));

      res.json(tags.map(inlineTagToApiFormat));
    } catch (error) {
      res.status(500).json({ error: 'Failed to search inline tags' });
    }
  });

  return router;
}

describe('Inline Tags API Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset in-memory storage
    tagTypes = new Map();
    inlineTags = new Map();
    notes = new Map();

    // Seed some default tag types
    tagTypes.set('illustration', {
      id: 'illustration',
      name: 'Illustration',
      color: '#60a5fa',
      icon: '💡',
      is_default: 1,
      sort_order: 0,
      created_at: new Date().toISOString(),
    });
    tagTypes.set('application', {
      id: 'application',
      name: 'Application',
      color: '#34d399',
      icon: '✅',
      is_default: 1,
      sort_order: 1,
      created_at: new Date().toISOString(),
    });

    // Seed a note
    notes.set('note-1', {
      id: 'note-1',
      title: 'Test Note',
      book: 'ROM',
      start_chapter: 3,
      start_verse: 21,
      end_chapter: 3,
      end_verse: 26,
    });

    // Seed an inline tag
    inlineTags.set('tag-1', {
      id: 'tag-1',
      note_id: 'note-1',
      tag_type: 'illustration',
      text_content: 'Grace example',
      html_fragment: '<span>Grace example</span>',
      position_start: 10,
      position_end: 23,
      created_at: new Date().toISOString(),
    });

    app = express();
    app.use(express.json());
    app.use('/api/inline-tags', createInlineTagsRouter());
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('GET /api/inline-tags/types', () => {
    it('returns all tag types', async () => {
      const res = await request(app).get('/api/inline-tags/types');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].name).toBe('Illustration');
      expect(res.body[0].isDefault).toBe(true);
      expect(res.body[1].name).toBe('Application');
    });

    it('returns tag types in sort order', async () => {
      const res = await request(app).get('/api/inline-tags/types');

      expect(res.status).toBe(200);
      expect(res.body[0].sortOrder).toBe(0);
      expect(res.body[1].sortOrder).toBe(1);
    });
  });

  describe('POST /api/inline-tags/types', () => {
    it('creates a new tag type', async () => {
      const res = await request(app)
        .post('/api/inline-tags/types')
        .send({ name: 'Quote', color: '#a78bfa', icon: '💬' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Quote');
      expect(res.body.color).toBe('#a78bfa');
      expect(res.body.icon).toBe('💬');
      expect(res.body.isDefault).toBe(false);
      expect(res.body.id).toBeDefined();
    });

    it('rejects missing name', async () => {
      const res = await request(app)
        .post('/api/inline-tags/types')
        .send({ color: '#a78bfa' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Missing required fields: name, color');
    });

    it('rejects missing color', async () => {
      const res = await request(app)
        .post('/api/inline-tags/types')
        .send({ name: 'Quote' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Missing required fields: name, color');
    });

    it('rejects duplicate name', async () => {
      const res = await request(app)
        .post('/api/inline-tags/types')
        .send({ name: 'Illustration', color: '#ffffff' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('A tag type with this name already exists');
    });

    it('assigns correct sort order', async () => {
      const res = await request(app)
        .post('/api/inline-tags/types')
        .send({ name: 'Quote', color: '#a78bfa' });

      expect(res.status).toBe(201);
      expect(res.body.sortOrder).toBe(2); // After illustration (0) and application (1)
    });
  });

  describe('PUT /api/inline-tags/types/:id', () => {
    it('updates an existing tag type', async () => {
      // First create a custom type
      const createRes = await request(app)
        .post('/api/inline-tags/types')
        .send({ name: 'Quote', color: '#a78bfa' });

      const id = createRes.body.id;

      const res = await request(app)
        .put(`/api/inline-tags/types/${id}`)
        .send({ name: 'Updated Quote', color: '#ffffff' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Quote');
      expect(res.body.color).toBe('#ffffff');
    });

    it('returns 404 for non-existent tag type', async () => {
      const res = await request(app)
        .put('/api/inline-tags/types/nonexistent')
        .send({ name: 'Updated' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Tag type not found');
    });

    it('preserves unchanged fields', async () => {
      const createRes = await request(app)
        .post('/api/inline-tags/types')
        .send({ name: 'Quote', color: '#a78bfa', icon: '💬' });

      const id = createRes.body.id;

      const res = await request(app)
        .put(`/api/inline-tags/types/${id}`)
        .send({ name: 'Updated Quote' });

      expect(res.status).toBe(200);
      expect(res.body.color).toBe('#a78bfa'); // Unchanged
      expect(res.body.icon).toBe('💬'); // Unchanged
    });
  });

  describe('DELETE /api/inline-tags/types/:id', () => {
    it('deletes a custom tag type', async () => {
      // Create a custom type
      const createRes = await request(app)
        .post('/api/inline-tags/types')
        .send({ name: 'Quote', color: '#a78bfa' });

      const id = createRes.body.id;

      const res = await request(app).delete(`/api/inline-tags/types/${id}`);

      expect(res.status).toBe(204);
    });

    it('returns 404 for non-existent tag type', async () => {
      const res = await request(app).delete('/api/inline-tags/types/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Tag type not found');
    });

    it('rejects deletion of default tag type', async () => {
      const res = await request(app).delete('/api/inline-tags/types/illustration');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Cannot delete default tag types');
    });
  });

  describe('GET /api/inline-tags', () => {
    it('returns all inline tags', async () => {
      const res = await request(app).get('/api/inline-tags');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].textContent).toBe('Grace example');
      expect(res.body[0].tagType).toBe('illustration');
    });

    it('includes note information', async () => {
      const res = await request(app).get('/api/inline-tags');

      expect(res.status).toBe(200);
      expect(res.body[0].noteTitle).toBe('Test Note');
      expect(res.body[0].book).toBe('ROM');
      expect(res.body[0].startChapter).toBe(3);
    });

    it('filters by tag type', async () => {
      const res = await request(app).get('/api/inline-tags?tagType=illustration');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });
  });

  describe('GET /api/inline-tags/by-type', () => {
    it('returns tag types with counts', async () => {
      const res = await request(app).get('/api/inline-tags/by-type');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);

      const illustration = res.body.find((t: any) => t.id === 'illustration');
      expect(illustration.count).toBe(1);

      const application = res.body.find((t: any) => t.id === 'application');
      expect(application.count).toBe(0);
    });
  });

  describe('GET /api/inline-tags/search', () => {
    it('searches by text content', async () => {
      const res = await request(app).get('/api/inline-tags/search?q=grace');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].textContent).toBe('Grace example');
    });

    it('returns empty for no matches', async () => {
      const res = await request(app).get('/api/inline-tags/search?q=nomatch');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });

    it('rejects missing query parameter', async () => {
      const res = await request(app).get('/api/inline-tags/search');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Missing query parameter: q');
    });
  });
});
