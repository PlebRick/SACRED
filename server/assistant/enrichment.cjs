// Auto-enrichment: after a sermon or commentary is saved, ask Claude to
// suggest doctrine links, topics, and untagged illustrations/applications.
// Suggestions land in note_suggestions and surface in the NoteEditor.
//
// Entirely optional — without ANTHROPIC_API_KEY this module does nothing.
const { randomUUID } = require('crypto');
const db = require('../db.cjs');
const { isAvailable, getClient, getModel } = require('./client.cjs');

const DEBOUNCE_MS = 20000; // notes autosave frequently; analyze after edits settle
const MIN_CONTENT_CHARS = 400;

const pendingTimers = new Map(); // noteId -> timeout
const inFlight = new Set();

const stripHtml = (html) =>
  (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const SUGGESTION_SCHEMA = {
  type: 'object',
  properties: {
    doctrines: {
      type: 'array',
      description: 'Systematic theology chapters this note substantively engages (max 4)',
      items: {
        type: 'object',
        properties: {
          chapterNumber: { type: 'integer' },
          reason: { type: 'string', description: 'One short sentence' }
        },
        required: ['chapterNumber', 'reason'],
        additionalProperties: false
      }
    },
    topics: {
      type: 'array',
      description: 'Topics from the provided list that fit this note (max 3)',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Exact name from the topic list' },
          reason: { type: 'string' }
        },
        required: ['name', 'reason'],
        additionalProperties: false
      }
    },
    illustrations: {
      type: 'array',
      description: 'Untagged illustration passages — stories, analogies, examples (max 3)',
      items: {
        type: 'object',
        properties: {
          excerpt: { type: 'string', description: 'First ~15 words of the passage, verbatim' },
          summary: { type: 'string', description: 'What the illustration is, in a few words' }
        },
        required: ['excerpt', 'summary'],
        additionalProperties: false
      }
    },
    applications: {
      type: 'array',
      description: 'Untagged application passages — direct calls to act or respond (max 3)',
      items: {
        type: 'object',
        properties: {
          excerpt: { type: 'string', description: 'First ~15 words of the passage, verbatim' },
          summary: { type: 'string' }
        },
        required: ['excerpt', 'summary'],
        additionalProperties: false
      }
    }
  },
  required: ['doctrines', 'topics', 'illustrations', 'applications'],
  additionalProperties: false
};

const analyzeNote = async (noteId) => {
  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);
  if (!note) return;

  const text = stripHtml(note.content);
  if (text.length < MIN_CONTENT_CHARS) return;

  // Context the model needs: doctrine chapter list, topic list, already-linked
  // doctrines, already-tagged inline passages
  const doctrineChapters = db.prepare(`
    SELECT chapter_number, title FROM systematic_theology
    WHERE entry_type = 'chapter' ORDER BY chapter_number
  `).all();
  const topics = db.prepare('SELECT id, name FROM topics ORDER BY name').all();
  const existingTags = db.prepare(`
    SELECT text_content, tag_type FROM inline_tags WHERE note_id = ?
  `).all(noteId);
  const linkedDoctrines = new Set(
    [...(note.content || '').matchAll(/\[\[ST:Ch(\d+)/g)].map((m) => parseInt(m[1], 10))
  );
  const existingTopicIds = new Set(
    db.prepare('SELECT topic_id FROM note_tags WHERE note_id = ?').all(noteId).map((r) => r.topic_id)
  );
  if (note.primary_topic_id) existingTopicIds.add(note.primary_topic_id);

  const prompt = `Analyze this ${note.type} for a pastor's study app and suggest enrichments.

NOTE TITLE: ${note.title || 'Untitled'}
PASSAGE: ${note.book} ${note.start_chapter}${note.start_verse ? `:${note.start_verse}` : ''}

NOTE TEXT:
${text.slice(0, 12000)}

AVAILABLE DOCTRINE CHAPTERS (suggest only chapters the note substantively engages, not passing mentions):
${doctrineChapters.map((d) => `${d.chapter_number}. ${d.title}`).join('\n')}

ALREADY LINKED (do not suggest again): ${[...linkedDoctrines].join(', ') || 'none'}

AVAILABLE TOPICS (use exact names): ${topics.map((t) => t.name).join('; ') || 'none'}

ALREADY TAGGED PASSAGES (do not suggest these as illustrations/applications):
${existingTags.map((t) => `[${t.tag_type}] ${t.text_content.slice(0, 80)}`).join('\n') || 'none'}

Be selective — empty arrays are better than weak suggestions.`;

  const client = getClient();
  const response = await client.messages.create({
    model: getModel(),
    max_tokens: 2048,
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema: SUGGESTION_SCHEMA }
    },
    messages: [{ role: 'user', content: prompt }]
  });

  if (response.stop_reason === 'refusal') return;
  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock) return;

  let result;
  try {
    result = JSON.parse(textBlock.text);
  } catch {
    return;
  }

  // Validate + persist, replacing prior pending suggestions for this note
  const now = new Date().toISOString();
  const validChapters = new Map(doctrineChapters.map((d) => [d.chapter_number, d.title]));
  const topicByName = new Map(topics.map((t) => [t.name.toLowerCase(), t]));

  const insert = db.prepare(`
    INSERT INTO note_suggestions (id, note_id, kind, payload, status, created_at)
    VALUES (?, ?, ?, ?, 'pending', ?)
  `);

  const replaceAll = db.transaction(() => {
    db.prepare("DELETE FROM note_suggestions WHERE note_id = ? AND status = 'pending'").run(noteId);

    for (const d of (result.doctrines || []).slice(0, 4)) {
      if (!validChapters.has(d.chapterNumber) || linkedDoctrines.has(d.chapterNumber)) continue;
      insert.run(randomUUID(), noteId, 'doctrine', JSON.stringify({
        chapterNumber: d.chapterNumber,
        title: validChapters.get(d.chapterNumber),
        reason: d.reason
      }), now);
    }

    for (const t of (result.topics || []).slice(0, 3)) {
      const topic = topicByName.get((t.name || '').toLowerCase());
      if (!topic || existingTopicIds.has(topic.id)) continue;
      insert.run(randomUUID(), noteId, 'topic', JSON.stringify({
        topicId: topic.id,
        name: topic.name,
        reason: t.reason
      }), now);
    }

    for (const kind of ['illustration', 'application']) {
      const items = kind === 'illustration' ? result.illustrations : result.applications;
      for (const item of (items || []).slice(0, 3)) {
        if (!item.excerpt) continue;
        insert.run(randomUUID(), noteId, kind, JSON.stringify({
          excerpt: item.excerpt,
          summary: item.summary
        }), now);
      }
    }
  });
  replaceAll();
};

// Debounced entry point, called from the notes routes after save.
const queueEnrichment = (noteId, noteType) => {
  if (!isAvailable()) return;
  if (!['sermon', 'commentary'].includes(noteType)) return;

  const existing = pendingTimers.get(noteId);
  if (existing) clearTimeout(existing);

  pendingTimers.set(noteId, setTimeout(async () => {
    pendingTimers.delete(noteId);
    if (inFlight.has(noteId)) return;
    inFlight.add(noteId);
    try {
      await analyzeNote(noteId);
    } catch (error) {
      console.error(`Enrichment failed for note ${noteId}:`, error.message);
    } finally {
      inFlight.delete(noteId);
    }
  }, DEBOUNCE_MS));
};

module.exports = { queueEnrichment, analyzeNote };
