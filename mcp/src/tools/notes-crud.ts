import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { toApiFormat, DbNote } from '../utils/format.js';
import { logger } from '../utils/logger.js';

/**
 * Register CRUD tools for notes
 */
export function registerCrudTools(server: McpServer): void {
  // create_note - Create a new Bible study note
  server.tool(
    'create_note',
    'Create a new Bible study note attached to a verse range',
    {
      book: z.string().describe('3-letter book code (e.g., "JHN", "ROM", "GEN")'),
      startChapter: z.number().describe('Starting chapter number'),
      startVerse: z.number().optional().describe('Starting verse number (optional, null for chapter-level notes)'),
      endChapter: z.number().describe('Ending chapter number'),
      endVerse: z.number().optional().describe('Ending verse number (optional)'),
      title: z.string().optional().describe('Note title (optional)'),
      content: z.string().optional().describe('Note content as HTML (optional)'),
      type: z.enum(['note', 'commentary', 'sermon']).optional().describe('Note type (default: "note")'),
    },
    async ({ book, startChapter, startVerse, endChapter, endVerse, title = '', content = '', type = 'note' }) => {
      try {
        const id = uuidv4();
        const now = new Date().toISOString();

        db.prepare(
          `
          INSERT INTO notes (id, book, start_chapter, start_verse, end_chapter, end_verse, title, content, type, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
        ).run(id, book.toUpperCase(), startChapter, startVerse ?? null, endChapter, endVerse ?? null, title, content, type, now, now);

        const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as DbNote;

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  success: true,
                  message: 'Note created successfully',
                  note: toApiFormat(note),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Error creating note:', error);
        return {
          content: [{ type: 'text' as const, text: `Error creating note: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // update_note - Update an existing note
  server.tool(
    'update_note',
    'Update an existing Bible study note (partial update - only provided fields are changed)',
    {
      id: z.string().describe('The UUID of the note to update'),
      book: z.string().optional().describe('3-letter book code (e.g., "JHN", "ROM", "GEN")'),
      startChapter: z.number().optional().describe('Starting chapter number'),
      startVerse: z.number().nullable().optional().describe('Starting verse number (null for chapter-level)'),
      endChapter: z.number().optional().describe('Ending chapter number'),
      endVerse: z.number().nullable().optional().describe('Ending verse number'),
      title: z.string().optional().describe('Note title'),
      content: z.string().optional().describe('Note content as HTML'),
      type: z.enum(['note', 'commentary', 'sermon']).optional().describe('Note type'),
    },
    async ({ id, book, startChapter, startVerse, endChapter, endVerse, title, content, type }) => {
      try {
        const existing = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as DbNote | undefined;

        if (!existing) {
          return {
            content: [{ type: 'text' as const, text: `Note not found with ID: ${id}` }],
            isError: true,
          };
        }

        // Merge with existing values
        const updatedBook = book?.toUpperCase() ?? existing.book;
        const updatedStartChapter = startChapter ?? existing.start_chapter;
        const updatedStartVerse = startVerse !== undefined ? startVerse : existing.start_verse;
        const updatedEndChapter = endChapter ?? existing.end_chapter;
        const updatedEndVerse = endVerse !== undefined ? endVerse : existing.end_verse;
        const updatedTitle = title ?? existing.title;
        const updatedContent = content ?? existing.content;
        const updatedType = type ?? existing.type;
        const now = new Date().toISOString();

        db.prepare(
          `
          UPDATE notes
          SET book = ?, start_chapter = ?, start_verse = ?, end_chapter = ?, end_verse = ?,
              title = ?, content = ?, type = ?, updated_at = ?
          WHERE id = ?
        `
        ).run(
          updatedBook,
          updatedStartChapter,
          updatedStartVerse,
          updatedEndChapter,
          updatedEndVerse,
          updatedTitle,
          updatedContent,
          updatedType,
          now,
          id
        );

        const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as DbNote;

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  success: true,
                  message: 'Note updated successfully',
                  note: toApiFormat(note),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Error updating note:', error);
        return {
          content: [{ type: 'text' as const, text: `Error updating note: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // delete_note - Delete a note
  server.tool(
    'delete_note',
    'Delete a Bible study note by ID',
    {
      id: z.string().describe('The UUID of the note to delete'),
    },
    async ({ id }) => {
      try {
        // Get note info before deletion for confirmation
        const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as DbNote | undefined;

        if (!note) {
          return {
            content: [{ type: 'text' as const, text: `Note not found with ID: ${id}` }],
            isError: true,
          };
        }

        const result = db.prepare('DELETE FROM notes WHERE id = ?').run(id);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  success: true,
                  message: 'Note deleted successfully',
                  deletedNote: toApiFormat(note),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Error deleting note:', error);
        return {
          content: [{ type: 'text' as const, text: `Error deleting note: ${error}` }],
          isError: true,
        };
      }
    }
  );

  logger.info('Registered CRUD tools: create_note, update_note, delete_note');
}
