import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';

// Mock types for systematic theology
interface MockEntry {
  id: string;
  entry_type: string;
  part_number: number | null;
  chapter_number: number | null;
  section_letter: string | null;
  subsection_number: number | null;
  title: string;
  content: string | null;
  summary: string | null;
  parent_id: string | null;
  sort_order: number;
  word_count: number;
  created_at: string;
  updated_at: string;
}

interface MockScriptureRef {
  id: string;
  systematic_id: string;
  book: string;
  chapter: number;
  start_verse: number | null;
  end_verse: number | null;
  is_primary: number;
  context_snippet: string | null;
  created_at: string;
}

interface MockAnnotation {
  id: string;
  systematic_id: string;
  annotation_type: string;
  color: string | null;
  content: string | null;
  text_selection: string | null;
  position_start: number | null;
  position_end: number | null;
  created_at: string;
  updated_at: string;
}

interface MockTag {
  id: string;
  name: string;
  color: string | null;
  sort_order: number;
  created_at: string;
}

interface MockChapterTag {
  chapter_number: number;
  tag_id: string;
}

interface MockRelated {
  id: string;
  source_chapter: number;
  target_chapter: number;
  relationship_type: string;
  note: string | null;
  created_at: string;
}

// In-memory storage
let entries: Map<string, MockEntry>;
let scriptureRefs: Map<string, MockScriptureRef>;
let annotations: Map<string, MockAnnotation>;
let tags: Map<string, MockTag>;
let chapterTags: MockChapterTag[];
let related: Map<string, MockRelated>;
let notes: Map<string, any>;

// Helper to build tree structure
function buildTree(entryList: MockEntry[]) {
  const toApiFormat = (row: MockEntry) => ({
    id: row.id,
    entryType: row.entry_type,
    partNumber: row.part_number,
    chapterNumber: row.chapter_number,
    sectionLetter: row.section_letter,
    subsectionNumber: row.subsection_number,
    title: row.title,
    content: row.content,
    summary: row.summary,
    parentId: row.parent_id,
    sortOrder: row.sort_order,
    wordCount: row.word_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

  const map = new Map();
  const roots: any[] = [];

  for (const entry of entryList) {
    map.set(entry.id, { ...toApiFormat(entry), children: [] });
  }

  for (const entry of entryList) {
    const node = map.get(entry.id);
    if (entry.parent_id && map.has(entry.parent_id)) {
      map.get(entry.parent_id).children.push(node);
    } else {
      roots.push(node);
    }
  }

  function sortChildren(node: any) {
    node.children.sort((a: any, b: any) => a.sortOrder - b.sortOrder);
    node.children.forEach(sortChildren);
  }

  roots.sort((a, b) => a.sortOrder - b.sortOrder);
  roots.forEach(sortChildren);

  return roots;
}

// Mock db
const mockDb = {
  prepare: vi.fn((sql: string) => {
    const sqlLower = sql.toLowerCase().trim();

    // Entry queries
    if (sqlLower.includes('select * from systematic_theology') && sqlLower.includes('order by sort_order') && !sqlLower.includes('where')) {
      return {
        all: () => Array.from(entries.values()).sort((a, b) => a.sort_order - b.sort_order),
        get: () => undefined,
        run: () => ({ changes: 0 }),
      };
    }

    if (sqlLower.includes('select * from systematic_theology') && sqlLower.includes('where id =')) {
      return {
        all: () => [],
        get: (id: string) => entries.get(id),
        run: () => ({ changes: 0 }),
      };
    }

    if (sqlLower.includes('select * from systematic_theology') && sqlLower.includes("entry_type = 'chapter'") && sqlLower.includes('chapter_number =')) {
      return {
        all: () => [],
        get: (chapterNum: number) => {
          return Array.from(entries.values()).find(
            e => e.entry_type === 'chapter' && e.chapter_number === chapterNum
          );
        },
        run: () => ({ changes: 0 }),
      };
    }

    if (sqlLower.includes('select * from systematic_theology') && sqlLower.includes('chapter_number =') && sqlLower.includes("entry_type in ('section', 'subsection')")) {
      return {
        all: (chapterNum: number) => {
          return Array.from(entries.values())
            .filter(e => e.chapter_number === chapterNum && (e.entry_type === 'section' || e.entry_type === 'subsection'))
            .sort((a, b) => a.sort_order - b.sort_order);
        },
        get: () => undefined,
        run: () => ({ changes: 0 }),
      };
    }

    if (sqlLower.includes('select * from systematic_theology') && sqlLower.includes('where parent_id =')) {
      return {
        all: (parentId: string) => {
          return Array.from(entries.values())
            .filter(e => e.parent_id === parentId)
            .sort((a, b) => a.sort_order - b.sort_order);
        },
        get: () => undefined,
        run: () => ({ changes: 0 }),
      };
    }

    if (sqlLower.includes('select id from systematic_theology where id')) {
      return {
        all: () => [],
        get: (id: string) => (entries.has(id) ? { id } : undefined),
        run: () => ({ changes: 0 }),
      };
    }

    // Scripture index queries
    if (sqlLower.includes('select * from systematic_scripture_index') && sqlLower.includes('where systematic_id')) {
      return {
        all: (id: string) => {
          return Array.from(scriptureRefs.values())
            .filter(r => r.systematic_id === id)
            .sort((a, b) => b.is_primary - a.is_primary);
        },
        get: () => undefined,
        run: () => ({ changes: 0 }),
      };
    }

    if (sqlLower.includes('select ssi.* from systematic_scripture_index ssi') && sqlLower.includes('st.chapter_number')) {
      return {
        all: (chapterNum: number) => {
          const chapterEntryIds = new Set(
            Array.from(entries.values())
              .filter(e => e.chapter_number === chapterNum)
              .map(e => e.id)
          );
          return Array.from(scriptureRefs.values())
            .filter(r => chapterEntryIds.has(r.systematic_id))
            .sort((a, b) => b.is_primary - a.is_primary);
        },
        get: () => undefined,
        run: () => ({ changes: 0 }),
      };
    }

    if (sqlLower.includes('select distinct st.*') && sqlLower.includes('join systematic_scripture_index ssi')) {
      return {
        all: (book: string, chapter: number) => {
          const matchingRefs = Array.from(scriptureRefs.values())
            .filter(r => r.book === book && r.chapter === chapter);
          const entryIds = new Set(matchingRefs.map(r => r.systematic_id));
          return Array.from(entries.values())
            .filter(e => entryIds.has(e.id))
            .map(e => {
              const ref = matchingRefs.find(r => r.systematic_id === e.id);
              return { ...e, is_primary: ref?.is_primary || 0, context_snippet: ref?.context_snippet };
            });
        },
        get: () => undefined,
        run: () => ({ changes: 0 }),
      };
    }

    // Tags queries
    if (sqlLower.includes('select t.*') && sqlLower.includes('from systematic_tags t') && sqlLower.includes('count(ct.chapter_number)')) {
      return {
        all: () => {
          return Array.from(tags.values())
            .sort((a, b) => a.sort_order - b.sort_order)
            .map(t => {
              const count = chapterTags.filter(ct => ct.tag_id === t.id).length;
              return { ...t, chapter_count: count };
            });
        },
        get: () => undefined,
        run: () => ({ changes: 0 }),
      };
    }

    if (sqlLower.includes('select t.* from systematic_tags t') && sqlLower.includes('join systematic_chapter_tags ct')) {
      return {
        all: (chapterNum: number) => {
          const tagIds = chapterTags.filter(ct => ct.chapter_number === chapterNum).map(ct => ct.tag_id);
          return Array.from(tags.values()).filter(t => tagIds.includes(t.id));
        },
        get: () => undefined,
        run: () => ({ changes: 0 }),
      };
    }

    // Chapters by tag
    if (sqlLower.includes('select st.* from systematic_theology st') && sqlLower.includes('join systematic_chapter_tags ct')) {
      return {
        all: (tagId: string) => {
          const chapterNums = chapterTags.filter(ct => ct.tag_id === tagId).map(ct => ct.chapter_number);
          return Array.from(entries.values())
            .filter(e => e.entry_type === 'chapter' && chapterNums.includes(e.chapter_number!))
            .sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));
        },
        get: () => undefined,
        run: () => ({ changes: 0 }),
      };
    }

    // Related chapters
    if (sqlLower.includes('select sr.*') && sqlLower.includes('from systematic_related sr')) {
      return {
        all: (sourceChapter: number) => {
          return Array.from(related.values())
            .filter(r => r.source_chapter === sourceChapter)
            .map(r => {
              const targetEntry = Array.from(entries.values()).find(
                e => e.entry_type === 'chapter' && e.chapter_number === r.target_chapter
              );
              return { ...r, target_title: targetEntry?.title };
            });
        },
        get: () => undefined,
        run: () => ({ changes: 0 }),
      };
    }

    // Search (FTS)
    if (sqlLower.includes('systematic_theology_fts match')) {
      return {
        all: (query: string, limit: number) => {
          const searchTerm = query.toLowerCase();
          return Array.from(entries.values())
            .filter(e => e.title.toLowerCase().includes(searchTerm) ||
                        (e.content && e.content.toLowerCase().includes(searchTerm)))
            .slice(0, limit)
            .map(e => ({ ...e, snippet: `...${searchTerm}...` }));
        },
        get: () => undefined,
        run: () => ({ changes: 0 }),
      };
    }

    // Summary stats
    if (sqlLower.includes('select count(*) as c from systematic_theology')) {
      if (sqlLower.includes("entry_type = 'part'")) {
        return {
          all: () => [],
          get: () => ({ c: Array.from(entries.values()).filter(e => e.entry_type === 'part').length }),
          run: () => ({ changes: 0 }),
        };
      }
      if (sqlLower.includes("entry_type = 'chapter'")) {
        return {
          all: () => [],
          get: () => ({ c: Array.from(entries.values()).filter(e => e.entry_type === 'chapter').length }),
          run: () => ({ changes: 0 }),
        };
      }
      if (sqlLower.includes("entry_type = 'section'")) {
        return {
          all: () => [],
          get: () => ({ c: Array.from(entries.values()).filter(e => e.entry_type === 'section').length }),
          run: () => ({ changes: 0 }),
        };
      }
      if (sqlLower.includes("entry_type = 'subsection'")) {
        return {
          all: () => [],
          get: () => ({ c: Array.from(entries.values()).filter(e => e.entry_type === 'subsection').length }),
          run: () => ({ changes: 0 }),
        };
      }
      return {
        all: () => [],
        get: () => ({ c: entries.size }),
        run: () => ({ changes: 0 }),
      };
    }

    if (sqlLower.includes('select count(*) as c from systematic_scripture_index')) {
      return {
        all: () => [],
        get: () => ({ c: scriptureRefs.size }),
        run: () => ({ changes: 0 }),
      };
    }

    if (sqlLower.includes('select count(*) as c from systematic_annotations')) {
      return {
        all: () => [],
        get: () => ({ c: annotations.size }),
        run: () => ({ changes: 0 }),
      };
    }

    // Annotations
    if (sqlLower.includes('select * from systematic_annotations') && sqlLower.includes('where systematic_id')) {
      return {
        all: (id: string) => {
          return Array.from(annotations.values())
            .filter(a => a.systematic_id === id)
            .sort((a, b) => (a.position_start || 0) - (b.position_start || 0));
        },
        get: () => undefined,
        run: () => ({ changes: 0 }),
      };
    }

    if (sqlLower.includes('select * from systematic_annotations where id')) {
      return {
        all: () => [],
        get: (id: string) => annotations.get(id),
        run: () => ({ changes: 0 }),
      };
    }

    if (sqlLower.startsWith('insert into systematic_annotations')) {
      return {
        all: () => [],
        get: () => undefined,
        run: (id: string, systematicId: string, annotationType: string, color: string | null,
              content: string | null, textSelection: string | null, positionStart: number | null,
              positionEnd: number | null, createdAt: string, updatedAt: string) => {
          annotations.set(id, {
            id,
            systematic_id: systematicId,
            annotation_type: annotationType,
            color,
            content,
            text_selection: textSelection,
            position_start: positionStart,
            position_end: positionEnd,
            created_at: createdAt,
            updated_at: updatedAt,
          });
          return { changes: 1 };
        },
      };
    }

    if (sqlLower.startsWith('delete from systematic_annotations where id')) {
      return {
        all: () => [],
        get: () => undefined,
        run: (id: string) => {
          if (!annotations.has(id)) return { changes: 0 };
          annotations.delete(id);
          return { changes: 1 };
        },
      };
    }

    // Notes referencing
    if (sqlLower.includes('select * from notes') && sqlLower.includes('where content like')) {
      return {
        all: (pattern: string) => {
          const searchTerm = pattern.replace(/%/g, '');
          return Array.from(notes.values())
            .filter(n => n.content && n.content.includes(searchTerm));
        },
        get: () => undefined,
        run: () => ({ changes: 0 }),
      };
    }

    if (sqlLower.includes('select chapter_number, section_letter, subsection_number from systematic_theology where id')) {
      return {
        all: () => [],
        get: (id: string) => {
          const entry = entries.get(id);
          if (!entry) return undefined;
          return {
            chapter_number: entry.chapter_number,
            section_letter: entry.section_letter,
            subsection_number: entry.subsection_number,
          };
        },
        run: () => ({ changes: 0 }),
      };
    }

    // Delete queries
    if (sqlLower.startsWith('delete from systematic_scripture_index')) {
      return {
        all: () => [],
        get: () => undefined,
        run: () => {
          const count = scriptureRefs.size;
          scriptureRefs.clear();
          return { changes: count };
        },
      };
    }

    if (sqlLower.startsWith('delete from systematic_chapter_tags')) {
      return {
        all: () => [],
        get: () => undefined,
        run: () => {
          const count = chapterTags.length;
          chapterTags = [];
          return { changes: count };
        },
      };
    }

    if (sqlLower.startsWith('delete from systematic_related')) {
      return {
        all: () => [],
        get: () => undefined,
        run: () => {
          const count = related.size;
          related.clear();
          return { changes: count };
        },
      };
    }

    if (sqlLower.startsWith('delete from systematic_tags')) {
      return {
        all: () => [],
        get: () => undefined,
        run: () => {
          const count = tags.size;
          tags.clear();
          return { changes: count };
        },
      };
    }

    if (sqlLower === 'delete from systematic_theology') {
      return {
        all: () => [],
        get: () => undefined,
        run: () => {
          const count = entries.size;
          entries.clear();
          return { changes: count };
        },
      };
    }

    // Default fallback
    return {
      all: () => [],
      get: () => undefined,
      run: () => ({ changes: 0 }),
    };
  }),
  transaction: vi.fn((fn: () => any) => fn),
  pragma: vi.fn(),
};

// Create router with mocked db
function createSystematicRouter() {
  const router = express.Router();
  const db = mockDb;

  const toApiFormat = (row: MockEntry) => ({
    id: row.id,
    entryType: row.entry_type,
    partNumber: row.part_number,
    chapterNumber: row.chapter_number,
    sectionLetter: row.section_letter,
    subsectionNumber: row.subsection_number,
    title: row.title,
    content: row.content,
    summary: row.summary,
    parentId: row.parent_id,
    sortOrder: row.sort_order,
    wordCount: row.word_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

  const toScriptureIndexFormat = (row: MockScriptureRef) => ({
    id: row.id,
    systematicId: row.systematic_id,
    book: row.book,
    chapter: row.chapter,
    startVerse: row.start_verse,
    endVerse: row.end_verse,
    isPrimary: row.is_primary === 1,
    contextSnippet: row.context_snippet,
    createdAt: row.created_at,
  });

  const toAnnotationFormat = (row: MockAnnotation) => ({
    id: row.id,
    systematicId: row.systematic_id,
    annotationType: row.annotation_type,
    color: row.color,
    content: row.content,
    textSelection: row.text_selection,
    positionStart: row.position_start,
    positionEnd: row.position_end,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

  const toTagFormat = (row: MockTag) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  });

  // GET /
  router.get('/', (req, res) => {
    try {
      const entryList = db.prepare('SELECT * FROM systematic_theology ORDER BY sort_order').all() as MockEntry[];
      const tree = buildTree(entryList);
      res.json(tree);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch systematic theology' });
    }
  });

  // GET /flat
  router.get('/flat', (req, res) => {
    try {
      const entryList = db.prepare('SELECT * FROM systematic_theology ORDER BY sort_order').all() as MockEntry[];
      res.json(entryList.map(toApiFormat));
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch systematic theology' });
    }
  });

  // GET /chapter/:num
  router.get('/chapter/:num', (req, res) => {
    try {
      const chapterNum = parseInt(req.params.num, 10);

      const chapter = db.prepare(`
        SELECT * FROM systematic_theology
        WHERE entry_type = 'chapter' AND chapter_number = ?
      `).get(chapterNum) as MockEntry | undefined;

      if (!chapter) {
        return res.status(404).json({ error: 'Chapter not found' });
      }

      const sections = db.prepare(`
        SELECT * FROM systematic_theology
        WHERE chapter_number = ? AND entry_type IN ('section', 'subsection')
        ORDER BY sort_order
      `).all(chapterNum) as MockEntry[];

      const refs = db.prepare(`
        SELECT ssi.* FROM systematic_scripture_index ssi
        JOIN systematic_theology st ON ssi.systematic_id = st.id
        WHERE st.chapter_number = ?
      `).all(chapterNum) as MockScriptureRef[];

      const relatedChapters = db.prepare(`
        SELECT sr.*, st.title as target_title
        FROM systematic_related sr
        JOIN systematic_theology st ON sr.target_chapter = st.chapter_number AND st.entry_type = 'chapter'
        WHERE sr.source_chapter = ?
      `).all(chapterNum) as any[];

      const chapterTagList = db.prepare(`
        SELECT t.* FROM systematic_tags t
        JOIN systematic_chapter_tags ct ON t.id = ct.tag_id
        WHERE ct.chapter_number = ?
      `).all(chapterNum) as MockTag[];

      res.json({
        ...toApiFormat(chapter),
        sections: sections.map(toApiFormat),
        scriptureReferences: refs.map(toScriptureIndexFormat),
        relatedChapters: relatedChapters.map((r: any) => ({
          chapterNumber: r.target_chapter,
          title: r.target_title,
          relationshipType: r.relationship_type,
        })),
        tags: chapterTagList.map(toTagFormat),
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch chapter' });
    }
  });

  // GET /for-passage/:book/:chapter
  router.get('/for-passage/:book/:chapter', (req, res) => {
    try {
      const { book, chapter } = req.params;
      const chapterNum = parseInt(chapter, 10);

      const entryList = db.prepare(`
        SELECT DISTINCT st.*, ssi.is_primary, ssi.context_snippet
        FROM systematic_theology st
        JOIN systematic_scripture_index ssi ON st.id = ssi.systematic_id
        WHERE ssi.book = ? AND ssi.chapter = ?
      `).all(book, chapterNum) as any[];

      const result = entryList.map((row: any) => ({
        ...toApiFormat(row),
        isPrimary: row.is_primary === 1,
        contextSnippet: row.context_snippet,
      }));

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch doctrines for passage' });
    }
  });

  // GET /tags
  router.get('/tags', (req, res) => {
    try {
      const tagList = db.prepare(`
        SELECT t.*, COUNT(ct.chapter_number) as chapter_count
        FROM systematic_tags t
        LEFT JOIN systematic_chapter_tags ct ON t.id = ct.tag_id
        GROUP BY t.id
        ORDER BY t.sort_order
      `).all() as any[];

      res.json(tagList.map((t: any) => ({
        ...toTagFormat(t),
        chapterCount: t.chapter_count,
      })));
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch tags' });
    }
  });

  // GET /by-tag/:tagId
  router.get('/by-tag/:tagId', (req, res) => {
    try {
      const { tagId } = req.params;

      const chapters = db.prepare(`
        SELECT st.* FROM systematic_theology st
        JOIN systematic_chapter_tags ct ON st.chapter_number = ct.chapter_number
        WHERE ct.tag_id = ? AND st.entry_type = 'chapter'
        ORDER BY st.chapter_number
      `).all(tagId) as MockEntry[];

      res.json(chapters.map(toApiFormat));
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch chapters by tag' });
    }
  });

  // GET /search
  router.get('/search', (req, res) => {
    try {
      const { q, limit = 20 } = req.query;

      if (!q || (q as string).trim().length < 2) {
        return res.status(400).json({ error: 'Query must be at least 2 characters' });
      }

      const results = db.prepare(`
        SELECT st.*, snippet(systematic_theology_fts, 1, '<mark>', '</mark>', '...', 30) as snippet
        FROM systematic_theology st
        JOIN systematic_theology_fts fts ON st.rowid = fts.rowid
        WHERE systematic_theology_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `).all((q as string).trim(), parseInt(limit as string, 10)) as any[];

      res.json(results.map((row: any) => ({
        ...toApiFormat(row),
        snippet: row.snippet,
      })));
    } catch (error) {
      res.status(500).json({ error: 'Failed to search' });
    }
  });

  // GET /summary
  router.get('/summary', (req, res) => {
    try {
      const stats = {
        totalEntries: db.prepare('SELECT COUNT(*) as c FROM systematic_theology').get().c,
        parts: db.prepare("SELECT COUNT(*) as c FROM systematic_theology WHERE entry_type = 'part'").get().c,
        chapters: db.prepare("SELECT COUNT(*) as c FROM systematic_theology WHERE entry_type = 'chapter'").get().c,
        sections: db.prepare("SELECT COUNT(*) as c FROM systematic_theology WHERE entry_type = 'section'").get().c,
        subsections: db.prepare("SELECT COUNT(*) as c FROM systematic_theology WHERE entry_type = 'subsection'").get().c,
        scriptureReferences: db.prepare('SELECT COUNT(*) as c FROM systematic_scripture_index').get().c,
        annotations: db.prepare('SELECT COUNT(*) as c FROM systematic_annotations').get().c,
      };

      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch summary' });
    }
  });

  // GET /:id
  router.get('/:id', (req, res) => {
    try {
      const entry = db.prepare('SELECT * FROM systematic_theology WHERE id = ?').get(req.params.id) as MockEntry | undefined;

      if (!entry) {
        return res.status(404).json({ error: 'Entry not found' });
      }

      const children = db.prepare(`
        SELECT * FROM systematic_theology
        WHERE parent_id = ?
        ORDER BY sort_order
      `).all(req.params.id) as MockEntry[];

      const refs = db.prepare(`
        SELECT * FROM systematic_scripture_index
        WHERE systematic_id = ?
        ORDER BY is_primary DESC, book, chapter, start_verse
      `).all(req.params.id) as MockScriptureRef[];

      res.json({
        ...toApiFormat(entry),
        children: children.map(toApiFormat),
        scriptureReferences: refs.map(toScriptureIndexFormat),
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch entry' });
    }
  });

  // POST /:id/annotations
  router.post('/:id/annotations', (req, res) => {
    try {
      const { id } = req.params;
      const { annotationType, color, content, textSelection, positionStart, positionEnd } = req.body;

      const entry = db.prepare('SELECT id FROM systematic_theology WHERE id = ?').get(id);
      if (!entry) {
        return res.status(404).json({ error: 'Systematic theology entry not found' });
      }

      if (!annotationType || !['highlight', 'note'].includes(annotationType)) {
        return res.status(400).json({ error: 'Invalid annotation type' });
      }

      const annotationId = uuidv4();
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO systematic_annotations (
          id, systematic_id, annotation_type, color, content, text_selection,
          position_start, position_end, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(annotationId, id, annotationType, color || null, content || null,
            textSelection || null, positionStart || null, positionEnd || null, now, now);

      const annotation = db.prepare('SELECT * FROM systematic_annotations WHERE id = ?').get(annotationId) as MockAnnotation;
      res.status(201).json(toAnnotationFormat(annotation));
    } catch (error) {
      res.status(500).json({ error: 'Failed to create annotation' });
    }
  });

  // GET /:id/annotations
  router.get('/:id/annotations', (req, res) => {
    try {
      const annotationList = db.prepare(`
        SELECT * FROM systematic_annotations
        WHERE systematic_id = ?
        ORDER BY position_start, created_at
      `).all(req.params.id) as MockAnnotation[];

      res.json(annotationList.map(toAnnotationFormat));
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch annotations' });
    }
  });

  // DELETE /annotations/:id
  router.delete('/annotations/:id', (req, res) => {
    try {
      const result = db.prepare('DELETE FROM systematic_annotations WHERE id = ?').run(req.params.id);

      if (result.changes === 0) {
        return res.status(404).json({ error: 'Annotation not found' });
      }

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete annotation' });
    }
  });

  return router;
}

describe('Systematic Theology API Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset storage
    entries = new Map();
    scriptureRefs = new Map();
    annotations = new Map();
    tags = new Map();
    chapterTags = [];
    related = new Map();
    notes = new Map();

    // Seed data
    const now = new Date().toISOString();

    // Part
    entries.set('part-1', {
      id: 'part-1',
      entry_type: 'part',
      part_number: 1,
      chapter_number: null,
      section_letter: null,
      subsection_number: null,
      title: 'Part 1: Doctrine of God',
      content: null,
      summary: null,
      parent_id: null,
      sort_order: 0,
      word_count: 0,
      created_at: now,
      updated_at: now,
    });

    // Chapters
    entries.set('ch-31', {
      id: 'ch-31',
      entry_type: 'chapter',
      part_number: 1,
      chapter_number: 31,
      section_letter: null,
      subsection_number: null,
      title: 'The Character of God',
      content: '<p>God is spirit...</p>',
      summary: 'Exploring the character of God',
      parent_id: 'part-1',
      sort_order: 0,
      word_count: 1000,
      created_at: now,
      updated_at: now,
    });

    entries.set('ch-32', {
      id: 'ch-32',
      entry_type: 'chapter',
      part_number: 1,
      chapter_number: 32,
      section_letter: null,
      subsection_number: null,
      title: 'The Trinity',
      content: '<p>The Trinity is...</p>',
      summary: 'The doctrine of the Trinity',
      parent_id: 'part-1',
      sort_order: 1,
      word_count: 2000,
      created_at: now,
      updated_at: now,
    });

    // Section
    entries.set('ch-32-a', {
      id: 'ch-32-a',
      entry_type: 'section',
      part_number: 1,
      chapter_number: 32,
      section_letter: 'A',
      subsection_number: null,
      title: 'Biblical Evidence',
      content: '<p>Scripture teaches...</p>',
      summary: null,
      parent_id: 'ch-32',
      sort_order: 0,
      word_count: 500,
      created_at: now,
      updated_at: now,
    });

    // Scripture refs
    scriptureRefs.set('ref-1', {
      id: 'ref-1',
      systematic_id: 'ch-32',
      book: 'JHN',
      chapter: 1,
      start_verse: 1,
      end_verse: 14,
      is_primary: 1,
      context_snippet: 'The Word was with God...',
      created_at: now,
    });

    // Tags
    tags.set('doctrine-god', {
      id: 'doctrine-god',
      name: 'Doctrine of God',
      color: '#4a90d9',
      sort_order: 0,
      created_at: now,
    });

    // Chapter tags
    chapterTags.push({ chapter_number: 31, tag_id: 'doctrine-god' });
    chapterTags.push({ chapter_number: 32, tag_id: 'doctrine-god' });

    // Related chapters
    related.set('rel-1', {
      id: 'rel-1',
      source_chapter: 31,
      target_chapter: 32,
      relationship_type: 'see_also',
      note: null,
      created_at: now,
    });

    // Annotations
    annotations.set('ann-1', {
      id: 'ann-1',
      systematic_id: 'ch-32',
      annotation_type: 'highlight',
      color: 'yellow',
      content: null,
      text_selection: 'The Trinity',
      position_start: 0,
      position_end: 11,
      created_at: now,
      updated_at: now,
    });

    // Notes
    notes.set('note-1', {
      id: 'note-1',
      book: 'JHN',
      start_chapter: 1,
      start_verse: 1,
      end_chapter: 1,
      end_verse: 14,
      title: 'The Word',
      content: '<p>See [[ST:Ch32]] for more on the Trinity</p>',
      type: 'note',
      updated_at: now,
    });

    app = express();
    app.use(express.json());
    app.use('/api/systematic', createSystematicRouter());
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('GET /api/systematic', () => {
    it('returns tree structure', async () => {
      const res = await request(app).get('/api/systematic');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe('Part 1: Doctrine of God');
      expect(res.body[0].children).toHaveLength(2);
    });

    it('nests chapters under parts', async () => {
      const res = await request(app).get('/api/systematic');

      const part = res.body[0];
      expect(part.children[0].title).toBe('The Character of God');
      expect(part.children[1].title).toBe('The Trinity');
    });
  });

  describe('GET /api/systematic/flat', () => {
    it('returns flat list', async () => {
      const res = await request(app).get('/api/systematic/flat');

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body.map((e: any) => e.entryType)).toContain('part');
      expect(res.body.map((e: any) => e.entryType)).toContain('chapter');
    });
  });

  describe('GET /api/systematic/chapter/:num', () => {
    it('returns chapter with sections', async () => {
      const res = await request(app).get('/api/systematic/chapter/32');

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('The Trinity');
      expect(res.body.sections).toHaveLength(1);
      expect(res.body.sections[0].title).toBe('Biblical Evidence');
    });

    it('includes scripture references', async () => {
      const res = await request(app).get('/api/systematic/chapter/32');

      expect(res.body.scriptureReferences).toHaveLength(1);
      expect(res.body.scriptureReferences[0].book).toBe('JHN');
    });

    it('includes related chapters', async () => {
      const res = await request(app).get('/api/systematic/chapter/31');

      expect(res.body.relatedChapters).toHaveLength(1);
      expect(res.body.relatedChapters[0].chapterNumber).toBe(32);
    });

    it('includes tags', async () => {
      const res = await request(app).get('/api/systematic/chapter/32');

      expect(res.body.tags).toHaveLength(1);
      expect(res.body.tags[0].name).toBe('Doctrine of God');
    });

    it('returns 404 for non-existent chapter', async () => {
      const res = await request(app).get('/api/systematic/chapter/999');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Chapter not found');
    });
  });

  describe('GET /api/systematic/for-passage/:book/:chapter', () => {
    it('returns doctrines for passage', async () => {
      const res = await request(app).get('/api/systematic/for-passage/JHN/1');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe('The Trinity');
      expect(res.body[0].isPrimary).toBe(true);
    });

    it('returns empty for passages with no doctrines', async () => {
      const res = await request(app).get('/api/systematic/for-passage/GEN/1');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });
  });

  describe('GET /api/systematic/tags', () => {
    it('returns tags with chapter counts', async () => {
      const res = await request(app).get('/api/systematic/tags');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Doctrine of God');
      expect(res.body[0].chapterCount).toBe(2);
    });
  });

  describe('GET /api/systematic/by-tag/:tagId', () => {
    it('returns chapters by tag', async () => {
      const res = await request(app).get('/api/systematic/by-tag/doctrine-god');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it('returns empty for unknown tag', async () => {
      const res = await request(app).get('/api/systematic/by-tag/unknown');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });
  });

  describe('GET /api/systematic/search', () => {
    it('searches entries', async () => {
      const res = await request(app).get('/api/systematic/search?q=trinity');

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('rejects short query', async () => {
      const res = await request(app).get('/api/systematic/search?q=a');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Query must be at least 2 characters');
    });

    it('rejects missing query', async () => {
      const res = await request(app).get('/api/systematic/search');

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/systematic/summary', () => {
    it('returns statistics', async () => {
      const res = await request(app).get('/api/systematic/summary');

      expect(res.status).toBe(200);
      expect(res.body.totalEntries).toBe(4);
      expect(res.body.parts).toBe(1);
      expect(res.body.chapters).toBe(2);
      expect(res.body.sections).toBe(1);
    });
  });

  describe('GET /api/systematic/:id', () => {
    it('returns entry with children and scripture', async () => {
      const res = await request(app).get('/api/systematic/ch-32');

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('The Trinity');
      expect(res.body.children).toHaveLength(1);
      expect(res.body.scriptureReferences).toHaveLength(1);
    });

    it('returns 404 for non-existent entry', async () => {
      const res = await request(app).get('/api/systematic/nonexistent');

      expect(res.status).toBe(404);
    });
  });

  describe('Annotations', () => {
    describe('POST /api/systematic/:id/annotations', () => {
      it('creates a highlight annotation', async () => {
        const res = await request(app)
          .post('/api/systematic/ch-32/annotations')
          .send({
            annotationType: 'highlight',
            color: 'green',
            textSelection: 'Test text',
            positionStart: 0,
            positionEnd: 9,
          });

        expect(res.status).toBe(201);
        expect(res.body.annotationType).toBe('highlight');
        expect(res.body.color).toBe('green');
      });

      it('creates a note annotation', async () => {
        const res = await request(app)
          .post('/api/systematic/ch-32/annotations')
          .send({
            annotationType: 'note',
            content: 'My note content',
          });

        expect(res.status).toBe(201);
        expect(res.body.annotationType).toBe('note');
        expect(res.body.content).toBe('My note content');
      });

      it('rejects invalid annotation type', async () => {
        const res = await request(app)
          .post('/api/systematic/ch-32/annotations')
          .send({ annotationType: 'invalid' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Invalid annotation type');
      });

      it('returns 404 for non-existent entry', async () => {
        const res = await request(app)
          .post('/api/systematic/nonexistent/annotations')
          .send({ annotationType: 'highlight' });

        expect(res.status).toBe(404);
      });
    });

    describe('GET /api/systematic/:id/annotations', () => {
      it('returns annotations for entry', async () => {
        const res = await request(app).get('/api/systematic/ch-32/annotations');

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].textSelection).toBe('The Trinity');
      });
    });

    describe('DELETE /api/systematic/annotations/:id', () => {
      it('deletes annotation', async () => {
        const res = await request(app).delete('/api/systematic/annotations/ann-1');

        expect(res.status).toBe(204);
      });

      it('returns 404 for non-existent annotation', async () => {
        const res = await request(app).delete('/api/systematic/annotations/nonexistent');

        expect(res.status).toBe(404);
      });
    });
  });
});
