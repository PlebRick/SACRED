// Tool surface for the in-app AI assistant.
//
// Internal tools query SACRED's own database; connector tools are bridged
// from the user's enabled MCP connectors (see server/connectors/manager.cjs).
const { randomUUID } = require('crypto');
const db = require('../db.cjs');
const connectorManager = require('../connectors/manager.cjs');
const { getLocalWebChapter } = require('../routes/bible.cjs');

const stripHtml = (html) =>
  (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const truncate = (text, max) =>
  text && text.length > max ? `${text.slice(0, max)}…` : text;

// ---------------------------------------------------------------------------
// Internal tool definitions (Anthropic tool schema format)
// ---------------------------------------------------------------------------

const INTERNAL_TOOLS = [
  {
    name: 'search_notes',
    description:
      "Full-text search the pastor's personal notes, commentary, and sermons. Call this whenever the user asks about their own past study, writing, or preaching.",
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search terms' },
        limit: { type: 'integer', description: 'Max results (default 8)' }
      },
      required: ['query']
    }
  },
  {
    name: 'get_chapter_notes',
    description:
      'Get all notes, commentary, and sermons that overlap a Bible chapter. Use 3-letter book codes (JHN, ROM, GEN).',
    input_schema: {
      type: 'object',
      properties: {
        book: { type: 'string', description: "3-letter book code, e.g. 'ROM'" },
        chapter: { type: 'integer' }
      },
      required: ['book', 'chapter']
    }
  },
  {
    name: 'get_note',
    description: 'Get the full content of a single note by its ID.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id']
    }
  },
  {
    name: 'search_doctrine',
    description:
      "Full-text search the systematic theology library (Grudem, 57 chapters). Call this for doctrinal questions — what does the user's theology resource say about a topic.",
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'integer', description: 'Max results (default 6)' }
      },
      required: ['query']
    }
  },
  {
    name: 'get_doctrine_section',
    description:
      "Get systematic theology content by chapter number (1-57) and optional section letter. Reference format for linking in notes: [[ST:Ch32]] or [[ST:Ch32:A]].",
    input_schema: {
      type: 'object',
      properties: {
        chapterNumber: { type: 'integer', description: '1-57' },
        sectionLetter: { type: 'string', description: "Optional, e.g. 'A'" }
      },
      required: ['chapterNumber']
    }
  },
  {
    name: 'find_doctrines_for_passage',
    description:
      'Find systematic theology chapters whose scripture index cites a given Bible chapter — which doctrines this passage teaches.',
    input_schema: {
      type: 'object',
      properties: {
        book: { type: 'string', description: '3-letter book code' },
        chapter: { type: 'integer' }
      },
      required: ['book', 'chapter']
    }
  },
  {
    name: 'get_similar_sermons',
    description:
      "Find the pastor's past sermons by book, chapter, and/or keyword. Always check this during sermon prep to avoid repeating material and to build on prior preaching.",
    input_schema: {
      type: 'object',
      properties: {
        book: { type: 'string', description: 'Optional 3-letter book code' },
        chapter: { type: 'integer', description: 'Optional chapter number' },
        query: { type: 'string', description: 'Optional keyword' }
      }
    }
  },
  {
    name: 'find_illustrations',
    description:
      "Search the pastor's tagged sermon illustrations by keyword, and see how often each has been used. Use during sermon prep.",
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query']
    }
  },
  {
    name: 'get_bible_chapter',
    description:
      'Get the full text of a Bible chapter (World English Bible). Use 3-letter book codes.',
    input_schema: {
      type: 'object',
      properties: {
        book: { type: 'string' },
        chapter: { type: 'integer' }
      },
      required: ['book', 'chapter']
    }
  },
  {
    name: 'list_series',
    description: 'List the sermon series with their sermon counts.',
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'create_note',
    description:
      "Save a note, commentary entry, or sermon to SACRED. Call this when the user asks to save, file, or keep something. Content must be clean HTML (<h2>, <p>, <ul>, <blockquote>). Link doctrines inline with [[ST:Ch32]] syntax. Returns the new note's ID.",
    input_schema: {
      type: 'object',
      properties: {
        book: { type: 'string', description: '3-letter book code' },
        startChapter: { type: 'integer' },
        startVerse: { type: 'integer', description: 'Optional' },
        endChapter: { type: 'integer', description: 'Defaults to startChapter' },
        endVerse: { type: 'integer', description: 'Optional' },
        title: { type: 'string' },
        content: { type: 'string', description: 'HTML content' },
        type: { type: 'string', enum: ['note', 'commentary', 'sermon'] }
      },
      required: ['book', 'startChapter', 'title', 'content', 'type']
    }
  }
];

// ---------------------------------------------------------------------------
// Internal tool executors
// ---------------------------------------------------------------------------

const executors = {
  search_notes({ query, limit = 8 }) {
    const rows = db.prepare(`
      SELECT n.id, n.book, n.start_chapter, n.start_verse, n.end_chapter, n.end_verse,
             n.title, n.type, n.updated_at,
             snippet(notes_fts, 1, '[', ']', '…', 30) as snip
      FROM notes n
      JOIN notes_fts fts ON n.rowid = fts.rowid
      WHERE notes_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `).all(query, limit);
    if (rows.length === 0) return `No notes match "${query}".`;
    return rows.map((r) =>
      `[id:${r.id}] ${r.type.toUpperCase()} "${r.title || 'Untitled'}" — ${r.book} ${r.start_chapter}${r.start_verse ? `:${r.start_verse}` : ''}\n  ${stripHtml(r.snip)}`
    ).join('\n');
  },

  get_chapter_notes({ book, chapter }) {
    const rows = db.prepare(`
      SELECT id, title, type, start_chapter, start_verse, end_chapter, end_verse, content
      FROM notes
      WHERE book = ? AND start_chapter <= ? AND end_chapter >= ?
      ORDER BY start_verse
    `).all(book.toUpperCase(), chapter, chapter);
    if (rows.length === 0) return `No notes on ${book} ${chapter}.`;
    return rows.map((r) =>
      `[id:${r.id}] ${r.type.toUpperCase()} "${r.title || 'Untitled'}" (${r.start_chapter}:${r.start_verse || '?'}-${r.end_chapter}:${r.end_verse || '?'})\n${truncate(stripHtml(r.content), 600)}`
    ).join('\n\n');
  },

  get_note({ id }) {
    const r = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
    if (!r) return `No note with id ${id}.`;
    return `${r.type.toUpperCase()} "${r.title || 'Untitled'}" — ${r.book} ${r.start_chapter}${r.start_verse ? `:${r.start_verse}` : ''}-${r.end_chapter}${r.end_verse ? `:${r.end_verse}` : ''}\nUpdated: ${r.updated_at}\n\n${stripHtml(r.content)}`;
  },

  search_doctrine({ query, limit = 6 }) {
    const rows = db.prepare(`
      SELECT st.chapter_number, st.section_letter, st.title, st.entry_type,
             snippet(systematic_theology_fts, 1, '[', ']', '…', 35) as snip
      FROM systematic_theology st
      JOIN systematic_theology_fts fts ON st.rowid = fts.rowid
      WHERE systematic_theology_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `).all(query, limit);
    if (rows.length === 0) return `Nothing in the theology library matches "${query}".`;
    return rows.map((r) =>
      `Ch${r.chapter_number}${r.section_letter ? `:${r.section_letter}` : ''} (${r.entry_type}) "${r.title}"\n  ${stripHtml(r.snip)}`
    ).join('\n');
  },

  get_doctrine_section({ chapterNumber, sectionLetter }) {
    let row;
    if (sectionLetter) {
      row = db.prepare(`
        SELECT * FROM systematic_theology
        WHERE chapter_number = ? AND section_letter = ? AND subsection_number IS NULL
      `).get(chapterNumber, sectionLetter.toUpperCase());
    } else {
      row = db.prepare(`
        SELECT * FROM systematic_theology
        WHERE chapter_number = ? AND entry_type = 'chapter'
      `).get(chapterNumber);
    }
    if (!row) return `No doctrine entry for Ch${chapterNumber}${sectionLetter ? `:${sectionLetter}` : ''}.`;
    const body = stripHtml(row.content) || row.summary || '(no content)';
    return `Ch${row.chapter_number}${row.section_letter ? `:${row.section_letter}` : ''} "${row.title}"\nLink syntax: [[ST:Ch${row.chapter_number}${row.section_letter ? `:${row.section_letter}` : ''}]]\n\n${truncate(body, 6000)}`;
  },

  find_doctrines_for_passage({ book, chapter }) {
    const rows = db.prepare(`
      SELECT DISTINCT st.chapter_number, st.title,
             COUNT(*) as ref_count,
             MAX(ssi.is_primary) as has_primary
      FROM systematic_scripture_index ssi
      JOIN systematic_theology st ON st.id = ssi.systematic_id
      WHERE ssi.book = ? AND ssi.chapter = ? AND st.chapter_number IS NOT NULL
      GROUP BY st.chapter_number, st.title
      ORDER BY has_primary DESC, ref_count DESC
      LIMIT 12
    `).all(book.toUpperCase(), chapter);
    if (rows.length === 0) return `No doctrines cite ${book} ${chapter}.`;
    return rows.map((r) =>
      `Ch${r.chapter_number} "${r.title}" — ${r.ref_count} reference${r.ref_count > 1 ? 's' : ''}${r.has_primary ? ' (primary)' : ''}`
    ).join('\n');
  },

  get_similar_sermons({ book, chapter, query }) {
    let rows;
    if (query) {
      rows = db.prepare(`
        SELECT n.id, n.book, n.start_chapter, n.title, n.updated_at,
               snippet(notes_fts, 1, '[', ']', '…', 25) as snip
        FROM notes n JOIN notes_fts fts ON n.rowid = fts.rowid
        WHERE notes_fts MATCH ? AND n.type = 'sermon'
        ORDER BY rank LIMIT 10
      `).all(query);
    } else {
      const conditions = ["type = 'sermon'"];
      const params = [];
      if (book) { conditions.push('book = ?'); params.push(book.toUpperCase()); }
      if (chapter) { conditions.push('start_chapter <= ? AND end_chapter >= ?'); params.push(chapter, chapter); }
      rows = db.prepare(`
        SELECT id, book, start_chapter, title, updated_at, NULL as snip
        FROM notes WHERE ${conditions.join(' AND ')}
        ORDER BY updated_at DESC LIMIT 10
      `).all(...params);
    }
    if (rows.length === 0) return 'No matching sermons found.';
    return rows.map((r) =>
      `[id:${r.id}] "${r.title || 'Untitled'}" — ${r.book} ${r.start_chapter} (${(r.updated_at || '').slice(0, 10)})${r.snip ? `\n  ${stripHtml(r.snip)}` : ''}`
    ).join('\n');
  },

  find_illustrations({ query }) {
    const rows = db.prepare(`
      SELECT it.text_content, it.text_signature, n.title as note_title, n.book, n.start_chapter
      FROM inline_tags it
      JOIN notes n ON n.id = it.note_id
      WHERE it.tag_type = 'illustration' AND it.text_content LIKE ?
      ORDER BY it.created_at DESC
      LIMIT 12
    `).all(`%${query}%`);
    if (rows.length === 0) return `No tagged illustrations match "${query}".`;
    const usage = db.prepare(`
      SELECT COUNT(*) as c FROM inline_tags WHERE tag_type = 'illustration' AND text_signature = ?
    `);
    return rows.map((r) => {
      const uses = r.text_signature ? usage.get(r.text_signature).c : 1;
      return `"${truncate(r.text_content, 200)}"\n  from "${r.note_title || 'Untitled'}" (${r.book} ${r.start_chapter}) — used ${uses}×`;
    }).join('\n\n');
  },

  get_bible_chapter({ book, chapter }) {
    const data = getLocalWebChapter(book.toUpperCase(), chapter);
    if (!data) return `Bible text for ${book} ${chapter} is not available offline. Quote from memory and say so.`;
    return `${data.reference} (${data.translation})\n` +
      data.verses.map((v) => `${v.verse} ${v.text}`).join('\n');
  },

  list_series() {
    const rows = db.prepare(`
      SELECT s.id, s.name, s.description, COUNT(n.id) as count
      FROM series s LEFT JOIN notes n ON n.series_id = s.id
      GROUP BY s.id ORDER BY s.name
    `).all();
    if (rows.length === 0) return 'No sermon series yet.';
    return rows.map((r) => `[id:${r.id}] "${r.name}" — ${r.count} sermon${r.count !== 1 ? 's' : ''}${r.description ? ` (${r.description})` : ''}`).join('\n');
  },

  create_note(input) {
    const now = new Date().toISOString();
    const id = randomUUID();
    db.prepare(`
      INSERT INTO notes (id, book, start_chapter, start_verse, end_chapter, end_verse, title, content, type, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.book.toUpperCase(),
      input.startChapter,
      input.startVerse || null,
      input.endChapter || input.startChapter,
      input.endVerse || null,
      input.title,
      input.content,
      input.type,
      now,
      now
    );
    return `Saved ${input.type} "${input.title}" with id ${id}. It is now visible in SACRED on ${input.book} ${input.startChapter}.`;
  }
};

// ---------------------------------------------------------------------------
// Connector tool bridging
// ---------------------------------------------------------------------------

// Tool names must match ^[a-zA-Z0-9_-]{1,64}$, so connector tools are exposed
// as cx_<id8>_<tool> and resolved back at dispatch time.
const connectorToolName = (connectorId, toolName) =>
  `cx_${connectorId.replace(/-/g, '').slice(0, 8)}_${toolName}`.slice(0, 64);

// Returns { tools: [...anthropic defs], dispatch: Map<exposedName, {connector, toolName}> }
const loadConnectorTools = async () => {
  const tools = [];
  const dispatch = new Map();
  const connectors = db.prepare('SELECT * FROM connectors WHERE enabled = 1 ORDER BY name').all();

  for (const connector of connectors) {
    try {
      const connectorTools = await connectorManager.listTools(connector);
      for (const t of connectorTools) {
        const exposed = connectorToolName(connector.id, t.name);
        tools.push({
          name: exposed,
          description: `[${connector.name} connector] ${t.description || t.name}`,
          input_schema: t.inputSchema
        });
        dispatch.set(exposed, { connector, toolName: t.name });
      }
    } catch (error) {
      console.error(`Connector "${connector.name}" unavailable for assistant:`, error.message);
    }
  }
  return { tools, dispatch };
};

// Execute any tool (internal or connector). Returns a string for the tool_result.
const executeTool = async (name, input, connectorDispatch) => {
  if (executors[name]) {
    return String(executors[name](input || {}));
  }
  const bridged = connectorDispatch.get(name);
  if (bridged) {
    const result = await connectorManager.callTool(bridged.connector, bridged.toolName, input || {});
    const text = (result.content || [])
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('\n');
    return text || JSON.stringify(result);
  }
  throw new Error(`Unknown tool: ${name}`);
};

module.exports = { INTERNAL_TOOLS, loadConnectorTools, executeTool };
