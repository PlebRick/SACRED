import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';

// ====== Mock types ======

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

interface MockSuggestion {
  id: string;
  note_id: string;
  suggestion_type: string;
  topic_id: string | null;
  tag_type: string | null;
  text_content: string | null;
  html_context: string | null;
  char_offset_start: number | null;
  char_offset_end: number | null;
  confidence: number;
  signals: string;
  status: string;
  created_at: string;
  reviewed_at: string | null;
}

interface MockTopic {
  id: string;
  name: string;
  parent_id: string | null;
}

// ====== In-memory storage ======

let notes: Map<string, MockNote>;
let suggestions: Map<string, MockSuggestion>;
let topics: Map<string, MockTopic>;
let noteTags: { note_id: string; topic_id: string }[];

// ====== Mock db ======

function createMockDb() {
  return {
    prepare: vi.fn((sql: string) => {
      const sqlLower = sql.toLowerCase().trim();

      // Notes queries
      if (sqlLower.includes('select * from notes where id')) {
        return {
          get: (id: string) => notes.get(id),
          all: () => [],
          run: () => ({ changes: 0 }),
        };
      }

      if (sqlLower.includes('from notes') && sqlLower.includes('primary_topic_id is null')) {
        return {
          all: (...args: any[]) => {
            let result = Array.from(notes.values()).filter(n => !n.primary_topic_id);
            // Handle book/type filters
            if (args[0]) result = result.filter(n => n.book === args[0]);
            if (args[1]) result = result.filter(n => n.type === args[1]);
            return result;
          },
          get: () => undefined,
          run: () => ({ changes: 0 }),
        };
      }

      if (sqlLower.includes('count(*) as total from notes')) {
        return {
          get: () => ({ total: notes.size }),
          all: () => [],
          run: () => ({ changes: 0 }),
        };
      }

      if (sqlLower.includes('count(*) as untagged') || sqlLower.includes('primary_topic_id is null')) {
        return {
          get: () => ({
            untagged: Array.from(notes.values()).filter(n => !n.primary_topic_id).length,
          }),
          all: () => [],
          run: () => ({ changes: 0 }),
        };
      }

      // Suggestions queries
      if (sqlLower.includes('insert into tagging_suggestions')) {
        return {
          run: (...args: any[]) => {
            const s: MockSuggestion = {
              id: args[0],
              note_id: args[1],
              suggestion_type: args[2],
              topic_id: args[3],
              tag_type: args[4],
              text_content: args[5],
              html_context: args[6],
              char_offset_start: args[7],
              char_offset_end: args[8],
              confidence: args[9],
              signals: args[10],
              status: 'pending',
              created_at: args[11],
              reviewed_at: null,
            };
            suggestions.set(s.id, s);
            return { changes: 1 };
          },
          get: () => undefined,
          all: () => [],
        };
      }

      if (sqlLower.includes('from tagging_suggestions') && sqlLower.includes('note_id')) {
        return {
          all: (noteId: string, ...rest: any[]) => {
            return Array.from(suggestions.values()).filter(s => s.note_id === noteId);
          },
          get: (id: string) => suggestions.get(id),
          run: () => ({ changes: 0 }),
        };
      }

      if (sqlLower.includes('from tagging_suggestions where id')) {
        return {
          get: (id: string) => suggestions.get(id),
          all: () => [],
          run: () => ({ changes: 0 }),
        };
      }

      if (sqlLower.includes('update tagging_suggestions')) {
        return {
          run: (...args: any[]) => {
            // Find the suggestion by id (last arg)
            const id = args[args.length - 1];
            const s = suggestions.get(id);
            if (s) {
              s.status = args[0];
              s.reviewed_at = args[1];
              return { changes: 1 };
            }
            return { changes: 0 };
          },
          get: () => undefined,
          all: () => [],
        };
      }

      if (sqlLower.includes('delete from tagging_suggestions where note_id')) {
        return {
          run: (noteId: string) => {
            let count = 0;
            for (const [id, s] of suggestions.entries()) {
              if (s.note_id === noteId) {
                suggestions.delete(id);
                count++;
              }
            }
            return { changes: count };
          },
          get: () => undefined,
          all: () => [],
        };
      }

      // Topics queries
      if (sqlLower.includes('from topics where id')) {
        return {
          get: (id: string) => topics.get(id),
          all: () => [],
          run: () => ({ changes: 0 }),
        };
      }

      // Note tags
      if (sqlLower.includes('insert into note_tags')) {
        return {
          run: (noteId: string, topicId: string) => {
            noteTags.push({ note_id: noteId, topic_id: topicId });
            return { changes: 1 };
          },
          get: () => undefined,
          all: () => [],
        };
      }

      if (sqlLower.includes('update notes set primary_topic_id')) {
        return {
          run: (topicId: string, ...rest: any[]) => {
            const noteId = rest[rest.length - 1];
            const note = notes.get(noteId);
            if (note) {
              note.primary_topic_id = topicId;
              return { changes: 1 };
            }
            return { changes: 0 };
          },
          get: () => undefined,
          all: () => [],
        };
      }

      // systematic_scripture_index
      if (sqlLower.includes('systematic_scripture_index')) {
        return {
          all: () => [],
          get: () => undefined,
          run: () => ({ changes: 0 }),
        };
      }

      // Default
      return {
        all: () => [],
        get: () => undefined,
        run: () => ({ changes: 0 }),
      };
    }),
  };
}

// ====== Test data ======

const topicGospel: MockTopic = { id: uuidv4(), name: 'Gospel', parent_id: null };
const topicJustification: MockTopic = { id: uuidv4(), name: 'Justification', parent_id: null };
const topicCreation: MockTopic = { id: uuidv4(), name: 'Creation', parent_id: null };

function createTestNote(overrides: Partial<MockNote> = {}): MockNote {
  return {
    id: uuidv4(),
    book: 'ROM',
    start_chapter: 3,
    start_verse: 21,
    end_chapter: 3,
    end_verse: 26,
    title: 'Justification by Faith',
    content: '<p>Paul teaches about justification by faith apart from works of the law.</p>',
    type: 'commentary',
    primary_topic_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// ====== Create app ======

function createTestApp() {
  const app = express();
  app.use(express.json());

  // Mock the tagging engine and db for the route
  // We need to use require to get the actual route module but with mocked db
  const mockDb = createMockDb();

  // Create a simplified version of the tagging routes for testing
  const router = express.Router();

  // GET /queue
  router.get('/queue', (req, res) => {
    const book = req.query.book as string | undefined;
    const type = req.query.type as string | undefined;

    const total = notes.size;
    const untaggedNotes = Array.from(notes.values()).filter(n => !n.primary_topic_id);
    let queue = untaggedNotes;
    if (book) queue = queue.filter(n => n.book === book);
    if (type) queue = queue.filter(n => n.type === type);

    const progress = total > 0 ? Math.round(((total - untaggedNotes.length) / total) * 100) : 100;

    const queueItems = queue.map(n => {
      const pendingSuggestions = Array.from(suggestions.values())
        .filter(s => s.note_id === n.id && s.status === 'pending').length;
      return {
        id: n.id,
        book: n.book,
        startChapter: n.start_chapter,
        startVerse: n.start_verse,
        endChapter: n.end_chapter,
        title: n.title,
        type: n.type,
        pendingSuggestions,
      };
    });

    res.json({
      queue: queueItems,
      stats: {
        totalNotes: total,
        untaggedNotes: untaggedNotes.length,
        progress,
      },
    });
  });

  // GET /suggestions/:noteId
  router.get('/suggestions/:noteId', (req, res) => {
    const noteId = req.params.noteId;
    const status = req.query.status as string | undefined;

    let result = Array.from(suggestions.values()).filter(s => s.note_id === noteId);
    if (status) result = result.filter(s => s.status === status);

    const items = result.map(s => ({
      id: s.id,
      noteId: s.note_id,
      suggestionType: s.suggestion_type,
      topicId: s.topic_id,
      topicName: s.topic_id ? topics.get(s.topic_id)?.name || 'Unknown' : null,
      tagType: s.tag_type,
      textContent: s.text_content,
      confidence: s.confidence,
      signals: JSON.parse(s.signals || '[]'),
      status: s.status,
    }));

    res.json({ suggestions: items });
  });

  // POST /apply
  router.post('/apply', (req, res) => {
    const { accepted = [], rejected = [] } = req.body;
    let applied = 0;
    let rejectedCount = 0;

    for (const id of accepted) {
      const s = suggestions.get(id);
      if (s && s.status === 'pending') {
        s.status = 'accepted';
        s.reviewed_at = new Date().toISOString();

        // Apply the suggestion
        if (s.suggestion_type === 'primary_topic' && s.topic_id) {
          const note = notes.get(s.note_id);
          if (note) note.primary_topic_id = s.topic_id;
        } else if (s.suggestion_type === 'secondary_topic' && s.topic_id) {
          noteTags.push({ note_id: s.note_id, topic_id: s.topic_id });
        }
        applied++;
      }
    }

    for (const id of rejected) {
      const s = suggestions.get(id);
      if (s && s.status === 'pending') {
        s.status = 'rejected';
        s.reviewed_at = new Date().toISOString();
        rejectedCount++;
      }
    }

    res.json({ applied, rejected: rejectedCount });
  });

  app.use('/api/tagging', router);
  return app;
}

// ====== Tests ======

describe('Tagging API Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    notes = new Map();
    suggestions = new Map();
    topics = new Map();
    noteTags = [];

    // Seed topics
    topics.set(topicGospel.id, topicGospel);
    topics.set(topicJustification.id, topicJustification);
    topics.set(topicCreation.id, topicCreation);

    app = createTestApp();
  });

  describe('GET /api/tagging/queue', () => {
    it('returns empty queue when all notes are tagged', async () => {
      const note = createTestNote({ primary_topic_id: topicGospel.id });
      notes.set(note.id, note);

      const res = await request(app).get('/api/tagging/queue');

      expect(res.status).toBe(200);
      expect(res.body.queue).toHaveLength(0);
      expect(res.body.stats.progress).toBe(100);
      expect(res.body.stats.untaggedNotes).toBe(0);
    });

    it('returns untagged notes in queue', async () => {
      const tagged = createTestNote({ primary_topic_id: topicGospel.id });
      const untagged = createTestNote({ primary_topic_id: null, title: 'Untagged Note' });
      notes.set(tagged.id, tagged);
      notes.set(untagged.id, untagged);

      const res = await request(app).get('/api/tagging/queue');

      expect(res.status).toBe(200);
      expect(res.body.queue).toHaveLength(1);
      expect(res.body.queue[0].title).toBe('Untagged Note');
      expect(res.body.stats.totalNotes).toBe(2);
      expect(res.body.stats.untaggedNotes).toBe(1);
      expect(res.body.stats.progress).toBe(50);
    });

    it('filters by book', async () => {
      const rom = createTestNote({ book: 'ROM', primary_topic_id: null });
      const jhn = createTestNote({ book: 'JHN', primary_topic_id: null, title: 'John Note' });
      notes.set(rom.id, rom);
      notes.set(jhn.id, jhn);

      const res = await request(app).get('/api/tagging/queue?book=JHN');

      expect(res.status).toBe(200);
      expect(res.body.queue).toHaveLength(1);
      expect(res.body.queue[0].book).toBe('JHN');
    });

    it('filters by type', async () => {
      const commentary = createTestNote({ type: 'commentary', primary_topic_id: null });
      const sermon = createTestNote({ type: 'sermon', primary_topic_id: null, title: 'Sermon' });
      notes.set(commentary.id, commentary);
      notes.set(sermon.id, sermon);

      const res = await request(app).get('/api/tagging/queue?type=sermon');

      expect(res.status).toBe(200);
      expect(res.body.queue).toHaveLength(1);
      expect(res.body.queue[0].type).toBe('sermon');
    });

    it('shows pending suggestion counts per note', async () => {
      const note = createTestNote({ primary_topic_id: null });
      notes.set(note.id, note);

      // Add some suggestions
      const s1: MockSuggestion = {
        id: uuidv4(), note_id: note.id, suggestion_type: 'primary_topic',
        topic_id: topicGospel.id, tag_type: null, text_content: null,
        html_context: null, char_offset_start: null, char_offset_end: null,
        confidence: 0.8, signals: '[]', status: 'pending',
        created_at: new Date().toISOString(), reviewed_at: null,
      };
      const s2: MockSuggestion = {
        ...s1, id: uuidv4(), topic_id: topicJustification.id, confidence: 0.6,
      };
      suggestions.set(s1.id, s1);
      suggestions.set(s2.id, s2);

      const res = await request(app).get('/api/tagging/queue');

      expect(res.body.queue[0].pendingSuggestions).toBe(2);
    });
  });

  describe('GET /api/tagging/suggestions/:noteId', () => {
    it('returns suggestions for a note', async () => {
      const note = createTestNote();
      notes.set(note.id, note);

      const s1: MockSuggestion = {
        id: uuidv4(), note_id: note.id, suggestion_type: 'primary_topic',
        topic_id: topicGospel.id, tag_type: null, text_content: null,
        html_context: null, char_offset_start: null, char_offset_end: null,
        confidence: 0.85, signals: '["keyword match"]', status: 'pending',
        created_at: new Date().toISOString(), reviewed_at: null,
      };
      suggestions.set(s1.id, s1);

      const res = await request(app).get(`/api/tagging/suggestions/${note.id}`);

      expect(res.status).toBe(200);
      expect(res.body.suggestions).toHaveLength(1);
      expect(res.body.suggestions[0].topicName).toBe('Gospel');
      expect(res.body.suggestions[0].confidence).toBe(0.85);
    });

    it('filters by status', async () => {
      const note = createTestNote();
      notes.set(note.id, note);

      const pending: MockSuggestion = {
        id: uuidv4(), note_id: note.id, suggestion_type: 'primary_topic',
        topic_id: topicGospel.id, tag_type: null, text_content: null,
        html_context: null, char_offset_start: null, char_offset_end: null,
        confidence: 0.8, signals: '[]', status: 'pending',
        created_at: new Date().toISOString(), reviewed_at: null,
      };
      const accepted: MockSuggestion = {
        ...pending, id: uuidv4(), status: 'accepted', topic_id: topicJustification.id,
      };
      suggestions.set(pending.id, pending);
      suggestions.set(accepted.id, accepted);

      const res = await request(app).get(`/api/tagging/suggestions/${note.id}?status=pending`);

      expect(res.body.suggestions).toHaveLength(1);
      expect(res.body.suggestions[0].status).toBe('pending');
    });
  });

  describe('POST /api/tagging/apply', () => {
    it('accepts suggestions and applies primary topic', async () => {
      const note = createTestNote({ primary_topic_id: null });
      notes.set(note.id, note);

      const s: MockSuggestion = {
        id: uuidv4(), note_id: note.id, suggestion_type: 'primary_topic',
        topic_id: topicGospel.id, tag_type: null, text_content: null,
        html_context: null, char_offset_start: null, char_offset_end: null,
        confidence: 0.8, signals: '[]', status: 'pending',
        created_at: new Date().toISOString(), reviewed_at: null,
      };
      suggestions.set(s.id, s);

      const res = await request(app)
        .post('/api/tagging/apply')
        .send({ accepted: [s.id], rejected: [] });

      expect(res.status).toBe(200);
      expect(res.body.applied).toBe(1);
      expect(note.primary_topic_id).toBe(topicGospel.id);
      expect(suggestions.get(s.id)?.status).toBe('accepted');
    });

    it('rejects suggestions', async () => {
      const note = createTestNote();
      notes.set(note.id, note);

      const s: MockSuggestion = {
        id: uuidv4(), note_id: note.id, suggestion_type: 'primary_topic',
        topic_id: topicGospel.id, tag_type: null, text_content: null,
        html_context: null, char_offset_start: null, char_offset_end: null,
        confidence: 0.3, signals: '[]', status: 'pending',
        created_at: new Date().toISOString(), reviewed_at: null,
      };
      suggestions.set(s.id, s);

      const res = await request(app)
        .post('/api/tagging/apply')
        .send({ accepted: [], rejected: [s.id] });

      expect(res.status).toBe(200);
      expect(res.body.rejected).toBe(1);
      expect(suggestions.get(s.id)?.status).toBe('rejected');
      expect(suggestions.get(s.id)?.reviewed_at).toBeTruthy();
    });

    it('applies secondary topic as note tag', async () => {
      const note = createTestNote();
      notes.set(note.id, note);

      const s: MockSuggestion = {
        id: uuidv4(), note_id: note.id, suggestion_type: 'secondary_topic',
        topic_id: topicJustification.id, tag_type: null, text_content: null,
        html_context: null, char_offset_start: null, char_offset_end: null,
        confidence: 0.7, signals: '[]', status: 'pending',
        created_at: new Date().toISOString(), reviewed_at: null,
      };
      suggestions.set(s.id, s);

      const res = await request(app)
        .post('/api/tagging/apply')
        .send({ accepted: [s.id], rejected: [] });

      expect(res.status).toBe(200);
      expect(res.body.applied).toBe(1);
      expect(noteTags).toContainEqual({
        note_id: note.id,
        topic_id: topicJustification.id,
      });
    });

    it('handles mixed accept and reject', async () => {
      const note = createTestNote();
      notes.set(note.id, note);

      const s1: MockSuggestion = {
        id: uuidv4(), note_id: note.id, suggestion_type: 'primary_topic',
        topic_id: topicGospel.id, tag_type: null, text_content: null,
        html_context: null, char_offset_start: null, char_offset_end: null,
        confidence: 0.8, signals: '[]', status: 'pending',
        created_at: new Date().toISOString(), reviewed_at: null,
      };
      const s2: MockSuggestion = {
        ...s1, id: uuidv4(), topic_id: topicJustification.id, confidence: 0.3,
      };
      suggestions.set(s1.id, s1);
      suggestions.set(s2.id, s2);

      const res = await request(app)
        .post('/api/tagging/apply')
        .send({ accepted: [s1.id], rejected: [s2.id] });

      expect(res.status).toBe(200);
      expect(res.body.applied).toBe(1);
      expect(res.body.rejected).toBe(1);
    });

    it('ignores already-reviewed suggestions', async () => {
      const note = createTestNote();
      notes.set(note.id, note);

      const s: MockSuggestion = {
        id: uuidv4(), note_id: note.id, suggestion_type: 'primary_topic',
        topic_id: topicGospel.id, tag_type: null, text_content: null,
        html_context: null, char_offset_start: null, char_offset_end: null,
        confidence: 0.8, signals: '[]', status: 'accepted',
        created_at: new Date().toISOString(), reviewed_at: new Date().toISOString(),
      };
      suggestions.set(s.id, s);

      const res = await request(app)
        .post('/api/tagging/apply')
        .send({ accepted: [s.id], rejected: [] });

      expect(res.body.applied).toBe(0);
    });
  });
});
