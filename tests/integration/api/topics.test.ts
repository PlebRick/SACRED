import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';

// Mock types for topics
interface MockTopic {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
  systematic_tag_id: string | null;
  created_at: string;
  updated_at: string;
}

interface MockNote {
  id: string;
  book: string;
  start_chapter: number;
  start_verse: number | null;
  end_chapter: number;
  end_verse: number | null;
  title: string;
  content: string;
  type: string;
  primary_topic_id: string | null;
  created_at: string;
  updated_at: string;
}

interface MockNoteTag {
  note_id: string;
  topic_id: string;
}

// In-memory storage
let topics: Map<string, MockTopic>;
let notes: Map<string, MockNote>;
let noteTags: Map<string, MockNoteTag[]>;
let systematicTags: Map<string, any>;

// Mock db
const mockDb = {
  prepare: vi.fn((sql: string) => {
    const sqlLower = sql.toLowerCase().trim();

    // Topics queries
    if (sqlLower.includes('select * from topics') && sqlLower.includes('order by sort_order')) {
      return {
        all: () => Array.from(topics.values()).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
        get: () => undefined,
        run: () => ({ changes: 0 }),
      };
    }

    if (sqlLower.includes('select * from topics where id')) {
      return {
        all: () => [],
        get: (id: string) => topics.get(id),
        run: () => ({ changes: 0 }),
      };
    }

    if (sqlLower.includes('select id from topics where id')) {
      return {
        all: () => [],
        get: (id: string) => (topics.has(id) ? { id } : undefined),
        run: () => ({ changes: 0 }),
      };
    }

    if (sqlLower.includes('select id from topics where parent_id')) {
      return {
        all: (parentId: string) => {
          return Array.from(topics.values())
            .filter(t => t.parent_id === parentId)
            .map(t => ({ id: t.id }));
        },
        get: () => undefined,
        run: () => ({ changes: 0 }),
      };
    }

    if (sqlLower.includes('select parent_id from topics where id')) {
      return {
        all: () => [],
        get: (id: string) => {
          const topic = topics.get(id);
          return topic ? { parent_id: topic.parent_id } : undefined;
        },
        run: () => ({ changes: 0 }),
      };
    }

    if (sqlLower.includes('select id from systematic_tags where id')) {
      return {
        all: () => [],
        get: (id: string) => (systematicTags.has(id) ? { id } : undefined),
        run: () => ({ changes: 0 }),
      };
    }

    if (sqlLower.startsWith('insert into topics')) {
      return {
        all: () => [],
        get: () => undefined,
        run: (id: string, name: string, parentId: string | null, sortOrder: number, systematicTagId: string | null, createdAt: string, updatedAt: string) => {
          topics.set(id, {
            id,
            name,
            parent_id: parentId,
            sort_order: sortOrder,
            systematic_tag_id: systematicTagId,
            created_at: createdAt,
            updated_at: updatedAt,
          });
          return { changes: 1 };
        },
      };
    }

    if (sqlLower.startsWith('update topics')) {
      return {
        all: () => [],
        get: () => undefined,
        run: (name: string, parentId: string | null, sortOrder: number, systematicTagId: string | null, updatedAt: string, id: string) => {
          const existing = topics.get(id);
          if (!existing) return { changes: 0 };
          topics.set(id, { ...existing, name, parent_id: parentId, sort_order: sortOrder, systematic_tag_id: systematicTagId, updated_at: updatedAt });
          return { changes: 1 };
        },
      };
    }

    if (sqlLower.startsWith('delete from topics')) {
      return {
        all: () => [],
        get: () => undefined,
        run: (id: string) => {
          if (!topics.has(id)) return { changes: 0 };
          // Delete children recursively
          const deleteChildren = (parentId: string) => {
            Array.from(topics.values())
              .filter(t => t.parent_id === parentId)
              .forEach(t => {
                deleteChildren(t.id);
                topics.delete(t.id);
              });
          };
          deleteChildren(id);
          topics.delete(id);
          return { changes: 1 };
        },
      };
    }

    // Note tags queries
    if (sqlLower.includes('select count(distinct note_id) as count from note_tags')) {
      return {
        all: () => [],
        get: (...topicIds: string[]) => {
          const allTags = Array.from(noteTags.values()).flat();
          const count = new Set(
            allTags.filter(nt => topicIds.includes(nt.topic_id)).map(nt => nt.note_id)
          ).size;
          return { count };
        },
        run: () => ({ changes: 0 }),
      };
    }

    if (sqlLower.startsWith('delete from note_tags')) {
      return {
        all: () => [],
        get: () => undefined,
        run: (topicId: string) => {
          const noteIds = Array.from(noteTags.keys());
          noteIds.forEach(noteId => {
            const tags = noteTags.get(noteId) || [];
            noteTags.set(noteId, tags.filter(nt => nt.topic_id !== topicId));
          });
          return { changes: 1 };
        },
      };
    }

    // Notes queries for topics
    if (sqlLower.includes('select count(*) as count from notes') && sqlLower.includes('primary_topic_id in')) {
      return {
        all: () => [],
        get: (...topicIds: string[]) => {
          const count = Array.from(notes.values()).filter(n => topicIds.includes(n.primary_topic_id || '')).length;
          return { count };
        },
        run: () => ({ changes: 0 }),
      };
    }

    if (sqlLower.includes('update notes set primary_topic_id = null')) {
      return {
        all: () => [],
        get: () => undefined,
        run: (topicId: string) => {
          Array.from(notes.entries()).forEach(([id, note]) => {
            if (note.primary_topic_id === topicId) {
              notes.set(id, { ...note, primary_topic_id: null });
            }
          });
          return { changes: 1 };
        },
      };
    }

    if (sqlLower.includes('select distinct n.* from notes n')) {
      return {
        all: (...topicIds: string[]) => {
          const allTopicIds = topicIds.filter(id => typeof id === 'string');
          const matchingNotes: MockNote[] = [];

          Array.from(notes.values()).forEach(note => {
            // Check primary topic
            if (allTopicIds.includes(note.primary_topic_id || '')) {
              matchingNotes.push(note);
              return;
            }
            // Check secondary topics
            Array.from(noteTags.values()).flat().forEach(nt => {
              if (nt.note_id === note.id && allTopicIds.includes(nt.topic_id)) {
                if (!matchingNotes.find(n => n.id === note.id)) {
                  matchingNotes.push(note);
                }
              }
            });
          });

          return matchingNotes.sort((a, b) => {
            if (a.book !== b.book) return a.book.localeCompare(b.book);
            if (a.start_chapter !== b.start_chapter) return a.start_chapter - b.start_chapter;
            return (a.start_verse || 0) - (b.start_verse || 0);
          });
        },
        get: () => undefined,
        run: () => ({ changes: 0 }),
      };
    }

    // Combined unique count query for topics
    if (sqlLower.includes('select count(*) as count from (') && sqlLower.includes('select id from notes where primary_topic_id in')) {
      return {
        all: () => [],
        get: (...allIds: string[]) => {
          // Split the topicIds - they appear twice in the query (once for primary, once for note_tags)
          const topicIds = allIds.filter(id => typeof id === 'string').slice(0, allIds.length / 2);

          const noteIdsFromPrimary = new Set(
            Array.from(notes.values())
              .filter(n => topicIds.includes(n.primary_topic_id || ''))
              .map(n => n.id)
          );

          const noteIdsFromTags = new Set(
            Array.from(noteTags.values())
              .flat()
              .filter(nt => topicIds.includes(nt.topic_id))
              .map(nt => nt.note_id)
          );

          const allNoteIds = new Set([...noteIdsFromPrimary, ...noteIdsFromTags]);
          return { count: allNoteIds.size };
        },
        run: () => ({ changes: 0 }),
      };
    }

    // Topics count query
    if (sqlLower.includes('select count(*) as count from topics')) {
      return {
        all: () => [],
        get: () => ({ count: topics.size }),
        run: () => ({ changes: 0 }),
      };
    }

    // Topics flat query (order by name)
    if (sqlLower.includes('select * from topics') && sqlLower.includes('order by name')) {
      return {
        all: () => Array.from(topics.values()).sort((a, b) => a.name.localeCompare(b.name)),
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
function createTopicsRouter() {
  const router = express.Router();
  const db = mockDb;

  const toApiFormat = (row: MockTopic) => ({
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    sortOrder: row.sort_order,
    systematicTagId: row.systematic_tag_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

  const buildTree = (topicList: ReturnType<typeof toApiFormat>[], parentId: string | null = null): any[] => {
    return topicList
      .filter(t => t.parentId === parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .map(topic => ({
        ...topic,
        children: buildTree(topicList, topic.id),
      }));
  };

  const getTopicNoteCount = (topicId: string): number => {
    const getDescendantIds = (id: string): string[] => {
      const children = db.prepare('SELECT id FROM topics WHERE parent_id = ?').all(id);
      let ids = [id];
      for (const child of children) {
        ids = ids.concat(getDescendantIds((child as { id: string }).id));
      }
      return ids;
    };

    const allIds = getDescendantIds(topicId);
    const placeholders = allIds.map(() => '?').join(',');

    const uniqueCount = db.prepare(`
      SELECT COUNT(*) as count FROM (
        SELECT id FROM notes WHERE primary_topic_id IN (${placeholders})
        UNION
        SELECT note_id FROM note_tags WHERE topic_id IN (${placeholders})
      )
    `).get(...allIds, ...allIds) as { count: number };

    return uniqueCount.count;
  };

  const addNoteCounts = (tree: any[]): any[] => {
    return tree.map(topic => ({
      ...topic,
      noteCount: getTopicNoteCount(topic.id),
      children: addNoteCounts(topic.children),
    }));
  };

  // GET /
  router.get('/', (req, res) => {
    try {
      const topicList = db.prepare('SELECT * FROM topics ORDER BY sort_order, name').all() as MockTopic[];
      const formattedTopics = topicList.map(toApiFormat);
      const tree = buildTree(formattedTopics);
      const treeWithCounts = addNoteCounts(tree);
      res.json(treeWithCounts);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch topics' });
    }
  });

  // GET /flat
  router.get('/flat', (req, res) => {
    try {
      const topicList = db.prepare('SELECT * FROM topics ORDER BY name').all() as MockTopic[];
      res.json(topicList.map(toApiFormat));
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch topics' });
    }
  });

  // GET /:id
  router.get('/:id', (req, res) => {
    try {
      const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(req.params.id) as MockTopic | undefined;

      if (!topic) {
        return res.status(404).json({ error: 'Topic not found' });
      }

      res.json(toApiFormat(topic));
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch topic' });
    }
  });

  // GET /:id/notes
  router.get('/:id/notes', (req, res) => {
    try {
      const { id } = req.params;

      const getDescendantIds = (topicId: string): string[] => {
        const children = db.prepare('SELECT id FROM topics WHERE parent_id = ?').all(topicId) as { id: string }[];
        let ids = [topicId];
        for (const child of children) {
          ids = ids.concat(getDescendantIds(child.id));
        }
        return ids;
      };

      const allIds = getDescendantIds(id);
      const placeholders = allIds.map(() => '?').join(',');

      const noteList = db.prepare(`
        SELECT DISTINCT n.* FROM notes n
        LEFT JOIN note_tags nt ON n.id = nt.note_id
        WHERE n.primary_topic_id IN (${placeholders})
           OR nt.topic_id IN (${placeholders})
        ORDER BY n.book, n.start_chapter, n.start_verse
      `).all(...allIds, ...allIds) as MockNote[];

      const formattedNotes = noteList.map(row => ({
        id: row.id,
        book: row.book,
        startChapter: row.start_chapter,
        startVerse: row.start_verse,
        endChapter: row.end_chapter,
        endVerse: row.end_verse,
        title: row.title,
        content: row.content,
        type: row.type,
        primaryTopicId: row.primary_topic_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      res.json(formattedNotes);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch notes for topic' });
    }
  });

  // POST /
  router.post('/', (req, res) => {
    try {
      const { name, parentId = null, sortOrder = 0, systematicTagId = null } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Topic name is required' });
      }

      if (parentId) {
        const parent = db.prepare('SELECT id FROM topics WHERE id = ?').get(parentId);
        if (!parent) {
          return res.status(400).json({ error: 'Parent topic not found' });
        }
      }

      if (systematicTagId) {
        const tag = db.prepare('SELECT id FROM systematic_tags WHERE id = ?').get(systematicTagId);
        if (!tag) {
          return res.status(400).json({ error: 'Systematic tag not found' });
        }
      }

      const id = uuidv4();
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO topics (id, name, parent_id, sort_order, systematic_tag_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, name.trim(), parentId, sortOrder, systematicTagId, now, now);

      const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(id) as MockTopic;
      res.status(201).json(toApiFormat(topic));
    } catch (error) {
      res.status(500).json({ error: 'Failed to create topic' });
    }
  });

  // PUT /:id
  router.put('/:id', (req, res) => {
    try {
      const { id } = req.params;
      const existing = db.prepare('SELECT * FROM topics WHERE id = ?').get(id) as MockTopic | undefined;

      if (!existing) {
        return res.status(404).json({ error: 'Topic not found' });
      }

      const {
        name = existing.name,
        parentId = existing.parent_id,
        sortOrder = existing.sort_order,
        systematicTagId = existing.systematic_tag_id,
      } = req.body;

      // Prevent self-reference
      if (parentId === id) {
        return res.status(400).json({ error: 'Topic cannot be its own parent' });
      }

      // Check for circular reference
      if (parentId) {
        let currentParent: string | null = parentId;
        while (currentParent) {
          if (currentParent === id) {
            return res.status(400).json({ error: 'Circular reference detected' });
          }
          const parent = db.prepare('SELECT parent_id FROM topics WHERE id = ?').get(currentParent) as { parent_id: string | null } | undefined;
          currentParent = parent?.parent_id ?? null;
        }
      }

      if (systematicTagId) {
        const tag = db.prepare('SELECT id FROM systematic_tags WHERE id = ?').get(systematicTagId);
        if (!tag) {
          return res.status(400).json({ error: 'Systematic tag not found' });
        }
      }

      const now = new Date().toISOString();

      db.prepare(`
        UPDATE topics
        SET name = ?, parent_id = ?, sort_order = ?, systematic_tag_id = ?, updated_at = ?
        WHERE id = ?
      `).run(name.trim(), parentId, sortOrder, systematicTagId, now, id);

      const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(id) as MockTopic;
      res.json(toApiFormat(topic));
    } catch (error) {
      res.status(500).json({ error: 'Failed to update topic' });
    }
  });

  // DELETE /:id
  router.delete('/:id', (req, res) => {
    try {
      const { id } = req.params;

      db.prepare('UPDATE notes SET primary_topic_id = NULL WHERE primary_topic_id = ?').run(id);
      db.prepare('DELETE FROM note_tags WHERE topic_id = ?').run(id);

      const result = db.prepare('DELETE FROM topics WHERE id = ?').run(id);

      if (result.changes === 0) {
        return res.status(404).json({ error: 'Topic not found' });
      }

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete topic' });
    }
  });

  return router;
}

describe('Topics API Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset in-memory storage
    topics = new Map();
    notes = new Map();
    noteTags = new Map();
    systematicTags = new Map();

    // Seed systematic tags
    systematicTags.set('doctrine-god', { id: 'doctrine-god', name: 'Doctrine of God' });

    // Seed topics with hierarchy
    topics.set('doctrinal', {
      id: 'doctrinal',
      name: 'Doctrinal',
      parent_id: null,
      sort_order: 0,
      systematic_tag_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    topics.set('god', {
      id: 'god',
      name: 'God',
      parent_id: 'doctrinal',
      sort_order: 0,
      systematic_tag_id: 'doctrine-god',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    topics.set('trinity', {
      id: 'trinity',
      name: 'Trinity',
      parent_id: 'god',
      sort_order: 0,
      systematic_tag_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Seed notes
    notes.set('note-1', {
      id: 'note-1',
      book: 'JHN',
      start_chapter: 1,
      start_verse: 1,
      end_chapter: 1,
      end_verse: 14,
      title: 'The Word',
      content: '<p>Test content</p>',
      type: 'note',
      primary_topic_id: 'trinity',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    app = express();
    app.use(express.json());
    app.use('/api/topics', createTopicsRouter());
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('GET /api/topics', () => {
    it('returns topic tree structure', async () => {
      const res = await request(app).get('/api/topics');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Doctrinal');
      expect(res.body[0].children).toHaveLength(1);
      expect(res.body[0].children[0].name).toBe('God');
    });

    it('includes note counts', async () => {
      const res = await request(app).get('/api/topics');

      expect(res.status).toBe(200);
      // Doctrinal includes all descendants, so it should have 1 note
      expect(res.body[0].noteCount).toBe(1);
    });

    it('builds nested tree correctly', async () => {
      const res = await request(app).get('/api/topics');

      expect(res.status).toBe(200);
      const doctrinal = res.body[0];
      const god = doctrinal.children[0];
      const trinity = god.children[0];

      expect(trinity.name).toBe('Trinity');
      expect(trinity.children).toHaveLength(0);
    });
  });

  describe('GET /api/topics/flat', () => {
    it('returns flat list of topics', async () => {
      const res = await request(app).get('/api/topics/flat');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(3);
      // Should be sorted by name
      expect(res.body.map((t: any) => t.name)).toContain('Doctrinal');
      expect(res.body.map((t: any) => t.name)).toContain('God');
      expect(res.body.map((t: any) => t.name)).toContain('Trinity');
    });
  });

  describe('GET /api/topics/:id', () => {
    it('returns single topic', async () => {
      const res = await request(app).get('/api/topics/god');

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('God');
      expect(res.body.parentId).toBe('doctrinal');
      expect(res.body.systematicTagId).toBe('doctrine-god');
    });

    it('returns 404 for non-existent topic', async () => {
      const res = await request(app).get('/api/topics/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Topic not found');
    });
  });

  describe('GET /api/topics/:id/notes', () => {
    it('returns notes for topic', async () => {
      const res = await request(app).get('/api/topics/trinity/notes');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe('The Word');
    });

    it('includes notes from descendant topics', async () => {
      const res = await request(app).get('/api/topics/doctrinal/notes');

      expect(res.status).toBe(200);
      // Should include note from trinity (descendant)
      expect(res.body).toHaveLength(1);
    });
  });

  describe('POST /api/topics', () => {
    it('creates a new topic', async () => {
      const res = await request(app)
        .post('/api/topics')
        .send({ name: 'Salvation', sortOrder: 1 });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Salvation');
      expect(res.body.parentId).toBeNull();
      expect(res.body.id).toBeDefined();
    });

    it('creates a child topic', async () => {
      const res = await request(app)
        .post('/api/topics')
        .send({ name: 'Attributes', parentId: 'god' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Attributes');
      expect(res.body.parentId).toBe('god');
    });

    it('rejects missing name', async () => {
      const res = await request(app)
        .post('/api/topics')
        .send({ parentId: 'god' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Topic name is required');
    });

    it('rejects empty name', async () => {
      const res = await request(app)
        .post('/api/topics')
        .send({ name: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Topic name is required');
    });

    it('rejects invalid parent', async () => {
      const res = await request(app)
        .post('/api/topics')
        .send({ name: 'New Topic', parentId: 'nonexistent' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Parent topic not found');
    });

    it('rejects invalid systematic tag', async () => {
      const res = await request(app)
        .post('/api/topics')
        .send({ name: 'New Topic', systematicTagId: 'nonexistent' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Systematic tag not found');
    });

    it('accepts valid systematic tag', async () => {
      const res = await request(app)
        .post('/api/topics')
        .send({ name: 'New Topic', systematicTagId: 'doctrine-god' });

      expect(res.status).toBe(201);
      expect(res.body.systematicTagId).toBe('doctrine-god');
    });
  });

  describe('PUT /api/topics/:id', () => {
    it('updates topic name', async () => {
      const res = await request(app)
        .put('/api/topics/god')
        .send({ name: 'Doctrine of God' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Doctrine of God');
    });

    it('updates parent', async () => {
      // Create a new parent first
      await request(app)
        .post('/api/topics')
        .send({ name: 'New Parent' });

      const allTopics = await request(app).get('/api/topics/flat');
      const newParent = allTopics.body.find((t: any) => t.name === 'New Parent');

      const res = await request(app)
        .put('/api/topics/trinity')
        .send({ parentId: newParent.id });

      expect(res.status).toBe(200);
      expect(res.body.parentId).toBe(newParent.id);
    });

    it('returns 404 for non-existent topic', async () => {
      const res = await request(app)
        .put('/api/topics/nonexistent')
        .send({ name: 'Updated' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Topic not found');
    });

    it('rejects self-reference', async () => {
      const res = await request(app)
        .put('/api/topics/god')
        .send({ parentId: 'god' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Topic cannot be its own parent');
    });

    it('rejects circular reference', async () => {
      // god -> doctrinal, trying to make doctrinal -> god creates circular
      const res = await request(app)
        .put('/api/topics/doctrinal')
        .send({ parentId: 'god' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Circular reference detected');
    });
  });

  describe('DELETE /api/topics/:id', () => {
    it('deletes topic', async () => {
      // Create a topic to delete
      const createRes = await request(app)
        .post('/api/topics')
        .send({ name: 'To Delete' });

      const res = await request(app).delete(`/api/topics/${createRes.body.id}`);

      expect(res.status).toBe(204);
    });

    it('returns 404 for non-existent topic', async () => {
      const res = await request(app).delete('/api/topics/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Topic not found');
    });

    it('clears notes primary_topic_id', async () => {
      // Delete trinity which has a note attached
      const res = await request(app).delete('/api/topics/trinity');

      expect(res.status).toBe(204);
      // Note should have null primary_topic_id now
      expect(notes.get('note-1')?.primary_topic_id).toBeNull();
    });
  });
});
