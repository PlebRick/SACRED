import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import db from '../db.js';
import { logger } from '../utils/logger.js';

/**
 * Enrichment & coverage tools (v0.4.0)
 *
 * These let Claude (working from outside via MCP, on the user's subscription)
 * power the same features the in-app API-key assistant provides:
 *
 * - get_pulpit_coverage: the data behind the app's Coverage Dashboard
 * - get_enrichment_queue / add_note_suggestions / get_note_suggestions:
 *   Claude analyzes sermons and files suggestions into note_suggestions;
 *   they appear as accept/dismiss chips in the app's note editor.
 */

interface DoctrineChapter {
  chapter_number: number;
  title: string;
}

export function registerEnrichmentTools(server: McpServer): void {
  // The app server normally creates this table; create it here too so the MCP
  // server works even if the app hasn't started since v0.4.0
  db.exec(`
    CREATE TABLE IF NOT EXISTS note_suggestions (
      id TEXT PRIMARY KEY,
      note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT NOT NULL
    )
  `);

  // get_pulpit_coverage - aggregate teaching coverage stats
  server.tool(
    'get_pulpit_coverage',
    "Get pulpit coverage statistics: which Bible books/chapters have notes or sermons, which systematic theology doctrines are covered vs untouched, topic frequency, and reused illustrations. Use when the user asks what they have (or haven't) taught, preached, or studied.",
    {},
    async () => {
      try {
        const bookRows = db.prepare(`
          SELECT book,
                 COUNT(*) as note_count,
                 SUM(CASE WHEN type = 'sermon' THEN 1 ELSE 0 END) as sermon_count,
                 COUNT(DISTINCT start_chapter) as chapters_touched
          FROM notes GROUP BY book ORDER BY note_count DESC
        `).all();

        const doctrineChapters = db.prepare(`
          SELECT chapter_number, title FROM systematic_theology
          WHERE entry_type = 'chapter' ORDER BY chapter_number
        `).all() as DoctrineChapter[];

        const coverageStmt = db.prepare(`
          SELECT COUNT(*) as total FROM notes
          WHERE content LIKE ? OR content LIKE ?
        `);
        const covered: Array<{ chapterNumber: number; title: string; noteCount: number }> = [];
        const uncovered: Array<{ chapterNumber: number; title: string }> = [];
        for (const ch of doctrineChapters) {
          const { total } = coverageStmt.get(
            `%[[ST:Ch${ch.chapter_number}]]%`,
            `%[[ST:Ch${ch.chapter_number}:%`
          ) as { total: number };
          if (total > 0) covered.push({ chapterNumber: ch.chapter_number, title: ch.title, noteCount: total });
          else uncovered.push({ chapterNumber: ch.chapter_number, title: ch.title });
        }

        const topics = db.prepare(`
          SELECT t.name, COUNT(DISTINCT n.note_id) as note_count
          FROM topics t
          LEFT JOIN (
            SELECT note_id, topic_id FROM note_tags
            UNION
            SELECT id as note_id, primary_topic_id as topic_id FROM notes WHERE primary_topic_id IS NOT NULL
          ) n ON n.topic_id = t.id
          GROUP BY t.id HAVING note_count > 0
          ORDER BY note_count DESC LIMIT 20
        `).all();

        const reusedIllustrations = db.prepare(`
          SELECT MIN(text_content) as sample, COUNT(*) as use_count
          FROM inline_tags
          WHERE tag_type = 'illustration' AND text_signature IS NOT NULL
          GROUP BY text_signature HAVING COUNT(*) > 1
          ORDER BY use_count DESC LIMIT 10
        `).all() as Array<{ sample: string; use_count: number }>;

        const typeTotals = db.prepare(
          'SELECT type, COUNT(*) as count FROM notes GROUP BY type'
        ).all();

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  totals: typeTotals,
                  bookCoverage: bookRows,
                  doctrinesCovered: covered,
                  doctrinesUncovered: uncovered,
                  topTopics: topics,
                  reusedIllustrations: reusedIllustrations.map((r) => ({
                    excerpt: r.sample.slice(0, 120),
                    useCount: r.use_count,
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('get_pulpit_coverage failed:', error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // get_enrichment_queue - sermons/commentary that have no pending suggestions yet
  server.tool(
    'get_enrichment_queue',
    'List recently updated sermons and commentary that have no pending enrichment suggestions. Use this when the user asks you to enrich/analyze their recent sermons. For each note: read it with get_note, then file suggestions with add_note_suggestions — they appear as accept/dismiss chips in the SACRED note editor.',
    {
      limit: z.number().optional().describe('Max notes to return (default 10)'),
    },
    async ({ limit = 10 }) => {
      try {
        const rows = db.prepare(`
          SELECT n.id, n.title, n.book, n.start_chapter, n.type, n.updated_at,
                 LENGTH(n.content) as content_length
          FROM notes n
          WHERE n.type IN ('sermon', 'commentary')
            AND LENGTH(n.content) > 400
            AND NOT EXISTS (
              SELECT 1 FROM note_suggestions s
              WHERE s.note_id = n.id AND s.status = 'pending'
            )
          ORDER BY n.updated_at DESC
          LIMIT ?
        `).all(limit);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ queue: rows, count: rows.length }, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('get_enrichment_queue failed:', error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // add_note_suggestions - file enrichment suggestions that surface in the app UI
  server.tool(
    'add_note_suggestions',
    `File enrichment suggestions for a note. They appear as accept/dismiss chips in the SACRED note editor (accepting a doctrine inserts a [[ST:ChN]] link; accepting a topic adds the tag). Use after analyzing a sermon/commentary with get_note.

Suggestion kinds:
- doctrine: a systematic theology chapter (1-57) the note substantively engages but doesn't link yet
- topic: an existing topic name that fits the note
- illustration / application: an untagged passage worth inline-tagging (give the first ~15 words verbatim as excerpt)

Be selective — only file suggestions you're confident in. Invalid ones (unknown chapter/topic, already linked/tagged) are skipped and reported.`,
    {
      noteId: z.string().describe('The note to attach suggestions to'),
      suggestions: z
        .array(
          z.object({
            kind: z.enum(['doctrine', 'topic', 'illustration', 'application']),
            chapterNumber: z.number().optional().describe('doctrine: chapter 1-57'),
            topicName: z.string().optional().describe('topic: exact existing topic name'),
            excerpt: z.string().optional().describe('illustration/application: first ~15 words, verbatim'),
            summary: z.string().optional().describe('illustration/application: what it is, briefly'),
            reason: z.string().optional().describe('one short sentence shown as a tooltip'),
          })
        )
        .describe('Suggestions to file (max ~10)'),
      replacePending: z
        .boolean()
        .optional()
        .describe('If true, clear existing pending suggestions for this note first (default false)'),
    },
    async ({ noteId, suggestions, replacePending = false }) => {
      try {
        const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId) as
          | { id: string; content: string; primary_topic_id: string | null }
          | undefined;
        if (!note) {
          return {
            content: [{ type: 'text' as const, text: `Error: no note with id ${noteId}` }],
            isError: true,
          };
        }

        const doctrineChapters = db.prepare(`
          SELECT chapter_number, title FROM systematic_theology WHERE entry_type = 'chapter'
        `).all() as DoctrineChapter[];
        const validChapters = new Map(doctrineChapters.map((d) => [d.chapter_number, d.title]));
        const linkedDoctrines = new Set(
          [...(note.content || '').matchAll(/\[\[ST:Ch(\d+)/g)].map((m) => parseInt(m[1], 10))
        );

        const topics = db.prepare('SELECT id, name FROM topics').all() as Array<{ id: string; name: string }>;
        const topicByName = new Map(topics.map((t) => [t.name.toLowerCase(), t]));
        const existingTopicIds = new Set(
          (db.prepare('SELECT topic_id FROM note_tags WHERE note_id = ?').all(noteId) as Array<{ topic_id: string }>).map((r) => r.topic_id)
        );
        if (note.primary_topic_id) existingTopicIds.add(note.primary_topic_id);

        const now = new Date().toISOString();
        const insert = db.prepare(`
          INSERT INTO note_suggestions (id, note_id, kind, payload, status, created_at)
          VALUES (?, ?, ?, ?, 'pending', ?)
        `);

        const filed: string[] = [];
        const skipped: string[] = [];

        const run = db.transaction(() => {
          if (replacePending) {
            db.prepare("DELETE FROM note_suggestions WHERE note_id = ? AND status = 'pending'").run(noteId);
          }
          for (const s of suggestions.slice(0, 10)) {
            if (s.kind === 'doctrine') {
              if (!s.chapterNumber || !validChapters.has(s.chapterNumber)) {
                skipped.push(`doctrine Ch${s.chapterNumber}: unknown chapter`);
                continue;
              }
              if (linkedDoctrines.has(s.chapterNumber)) {
                skipped.push(`doctrine Ch${s.chapterNumber}: already linked in note`);
                continue;
              }
              insert.run(randomUUID(), noteId, 'doctrine', JSON.stringify({
                chapterNumber: s.chapterNumber,
                title: validChapters.get(s.chapterNumber),
                reason: s.reason || '',
              }), now);
              filed.push(`doctrine Ch${s.chapterNumber}`);
            } else if (s.kind === 'topic') {
              const topic = s.topicName ? topicByName.get(s.topicName.toLowerCase()) : undefined;
              if (!topic) {
                skipped.push(`topic "${s.topicName}": no such topic (use exact existing names)`);
                continue;
              }
              if (existingTopicIds.has(topic.id)) {
                skipped.push(`topic "${topic.name}": already tagged`);
                continue;
              }
              insert.run(randomUUID(), noteId, 'topic', JSON.stringify({
                topicId: topic.id,
                name: topic.name,
                reason: s.reason || '',
              }), now);
              filed.push(`topic "${topic.name}"`);
            } else {
              if (!s.excerpt) {
                skipped.push(`${s.kind}: missing excerpt`);
                continue;
              }
              insert.run(randomUUID(), noteId, s.kind, JSON.stringify({
                excerpt: s.excerpt,
                summary: s.summary || '',
              }), now);
              filed.push(`${s.kind} "${(s.summary || s.excerpt).slice(0, 40)}"`);
            }
          }
        });
        run();

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  filed,
                  skipped,
                  message: `${filed.length} suggestion(s) filed — they now appear in the SACRED note editor for review.`,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('add_note_suggestions failed:', error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // get_note_suggestions - read suggestions for a note
  server.tool(
    'get_note_suggestions',
    'Get enrichment suggestions for a note (pending by default). Check before filing new ones to avoid duplicates, or to see what the user accepted/dismissed.',
    {
      noteId: z.string(),
      status: z.enum(['pending', 'accepted', 'dismissed', 'all']).optional().describe('default: pending'),
    },
    async ({ noteId, status = 'pending' }) => {
      try {
        const rows =
          status === 'all'
            ? db.prepare('SELECT * FROM note_suggestions WHERE note_id = ? ORDER BY created_at').all(noteId)
            : db.prepare('SELECT * FROM note_suggestions WHERE note_id = ? AND status = ? ORDER BY created_at').all(noteId, status);

        const result = (rows as Array<{ id: string; kind: string; payload: string; status: string; created_at: string }>).map((r) => ({
          id: r.id,
          kind: r.kind,
          status: r.status,
          ...JSON.parse(r.payload),
          createdAt: r.created_at,
        }));

        return {
          content: [
            { type: 'text' as const, text: JSON.stringify({ suggestions: result, count: result.length }, null, 2) },
          ],
        };
      } catch (error) {
        logger.error('get_note_suggestions failed:', error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );
}
