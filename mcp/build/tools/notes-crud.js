import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { toApiFormat, topicToApiFormat } from '../utils/format.js';
import { logger } from '../utils/logger.js';
/**
 * Get tags for a note
 */
function getNoteTags(noteId) {
    const tags = db.prepare('SELECT topic_id FROM note_tags WHERE note_id = ?').all(noteId);
    return tags.map((t) => t.topic_id);
}
/**
 * Set tags for a note (replaces existing tags)
 */
function setNoteTags(noteId, tagIds) {
    db.prepare('DELETE FROM note_tags WHERE note_id = ?').run(noteId);
    if (tagIds.length > 0) {
        const insertTag = db.prepare('INSERT OR IGNORE INTO note_tags (note_id, topic_id) VALUES (?, ?)');
        for (const tagId of tagIds) {
            insertTag.run(noteId, tagId);
        }
    }
}
/**
 * Register CRUD tools for notes
 */
export function registerCrudTools(server) {
    // create_note - Create a new Bible study note
    server.tool('create_note', 'Create a new Bible study note attached to a verse range', {
        book: z.string().describe('3-letter book code (e.g., "JHN", "ROM", "GEN")'),
        startChapter: z.number().describe('Starting chapter number'),
        startVerse: z.number().optional().describe('Starting verse number (optional, null for chapter-level notes)'),
        endChapter: z.number().describe('Ending chapter number'),
        endVerse: z.number().optional().describe('Ending verse number (optional)'),
        title: z.string().optional().describe('Note title (optional)'),
        content: z.string().optional().describe('Note content as HTML (optional)'),
        type: z.enum(['note', 'commentary', 'sermon']).optional().describe('Note type (default: "note")'),
        primaryTopicId: z.string().optional().describe('Primary topic ID for categorization'),
        tags: z.array(z.string()).optional().describe('Array of secondary topic IDs'),
    }, async ({ book, startChapter, startVerse, endChapter, endVerse, title = '', content = '', type = 'note', primaryTopicId, tags }) => {
        try {
            const id = uuidv4();
            const now = new Date().toISOString();
            // Validate primary topic exists if provided
            if (primaryTopicId) {
                const topic = db.prepare('SELECT id FROM topics WHERE id = ?').get(primaryTopicId);
                if (!topic) {
                    return {
                        content: [{ type: 'text', text: `Primary topic not found: ${primaryTopicId}` }],
                        isError: true,
                    };
                }
            }
            db.prepare(`
          INSERT INTO notes (id, book, start_chapter, start_verse, end_chapter, end_verse, title, content, type, primary_topic_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, book.toUpperCase(), startChapter, startVerse ?? null, endChapter, endVerse ?? null, title, content, type, primaryTopicId ?? null, now, now);
            // Set secondary tags if provided
            if (tags && tags.length > 0) {
                setNoteTags(id, tags);
            }
            const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            message: 'Note created successfully',
                            note: {
                                ...toApiFormat(note),
                                tags: getNoteTags(id),
                            },
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error creating note:', error);
            return {
                content: [{ type: 'text', text: `Error creating note: ${error}` }],
                isError: true,
            };
        }
    });
    // update_note - Update an existing note
    server.tool('update_note', 'Update an existing Bible study note (partial update - only provided fields are changed)', {
        id: z.string().describe('The UUID of the note to update'),
        book: z.string().optional().describe('3-letter book code (e.g., "JHN", "ROM", "GEN")'),
        startChapter: z.number().optional().describe('Starting chapter number'),
        startVerse: z.number().nullable().optional().describe('Starting verse number (null for chapter-level)'),
        endChapter: z.number().optional().describe('Ending chapter number'),
        endVerse: z.number().nullable().optional().describe('Ending verse number'),
        title: z.string().optional().describe('Note title'),
        content: z.string().optional().describe('Note content as HTML'),
        type: z.enum(['note', 'commentary', 'sermon']).optional().describe('Note type'),
        primaryTopicId: z.string().nullable().optional().describe('Primary topic ID (null to clear)'),
        tags: z.array(z.string()).optional().describe('Array of secondary topic IDs (replaces existing tags)'),
    }, async ({ id, book, startChapter, startVerse, endChapter, endVerse, title, content, type, primaryTopicId, tags }) => {
        try {
            const existing = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
            if (!existing) {
                return {
                    content: [{ type: 'text', text: `Note not found with ID: ${id}` }],
                    isError: true,
                };
            }
            // Validate primary topic exists if provided
            if (primaryTopicId) {
                const topic = db.prepare('SELECT id FROM topics WHERE id = ?').get(primaryTopicId);
                if (!topic) {
                    return {
                        content: [{ type: 'text', text: `Primary topic not found: ${primaryTopicId}` }],
                        isError: true,
                    };
                }
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
            const updatedPrimaryTopicId = primaryTopicId !== undefined ? primaryTopicId : existing.primary_topic_id;
            const now = new Date().toISOString();
            db.prepare(`
          UPDATE notes
          SET book = ?, start_chapter = ?, start_verse = ?, end_chapter = ?, end_verse = ?,
              title = ?, content = ?, type = ?, primary_topic_id = ?, updated_at = ?
          WHERE id = ?
        `).run(updatedBook, updatedStartChapter, updatedStartVerse, updatedEndChapter, updatedEndVerse, updatedTitle, updatedContent, updatedType, updatedPrimaryTopicId, now, id);
            // Update secondary tags if provided
            if (tags !== undefined) {
                setNoteTags(id, tags);
            }
            const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            message: 'Note updated successfully',
                            note: {
                                ...toApiFormat(note),
                                tags: getNoteTags(id),
                            },
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error updating note:', error);
            return {
                content: [{ type: 'text', text: `Error updating note: ${error}` }],
                isError: true,
            };
        }
    });
    // delete_note - Delete a note
    server.tool('delete_note', 'Delete a Bible study note by ID', {
        id: z.string().describe('The UUID of the note to delete'),
    }, async ({ id }) => {
        try {
            // Get note info before deletion for confirmation
            const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
            if (!note) {
                return {
                    content: [{ type: 'text', text: `Note not found with ID: ${id}` }],
                    isError: true,
                };
            }
            const result = db.prepare('DELETE FROM notes WHERE id = ?').run(id);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            message: 'Note deleted successfully',
                            deletedNote: toApiFormat(note),
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error deleting note:', error);
            return {
                content: [{ type: 'text', text: `Error deleting note: ${error}` }],
                isError: true,
            };
        }
    });
    // set_note_topics - Assign primary + secondary topics to note
    server.tool('set_note_topics', 'Assign primary and/or secondary topics to an existing note', {
        noteId: z.string().describe('The UUID of the note'),
        primaryTopicId: z.string().nullable().optional().describe('Primary topic ID (null to clear, omit to keep unchanged)'),
        tags: z.array(z.string()).optional().describe('Array of secondary topic IDs (replaces existing tags)'),
        addTags: z.array(z.string()).optional().describe('Topic IDs to add (without replacing existing)'),
        removeTags: z.array(z.string()).optional().describe('Topic IDs to remove'),
    }, async ({ noteId, primaryTopicId, tags, addTags, removeTags }) => {
        try {
            const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);
            if (!note) {
                return {
                    content: [{ type: 'text', text: `Note not found with ID: ${noteId}` }],
                    isError: true,
                };
            }
            // Update primary topic if provided
            if (primaryTopicId !== undefined) {
                if (primaryTopicId !== null) {
                    const topic = db.prepare('SELECT id FROM topics WHERE id = ?').get(primaryTopicId);
                    if (!topic) {
                        return {
                            content: [{ type: 'text', text: `Primary topic not found: ${primaryTopicId}` }],
                            isError: true,
                        };
                    }
                }
                db.prepare('UPDATE notes SET primary_topic_id = ?, updated_at = ? WHERE id = ?').run(primaryTopicId, new Date().toISOString(), noteId);
            }
            // Handle secondary tags
            if (tags !== undefined) {
                // Replace all tags
                setNoteTags(noteId, tags);
            }
            else {
                // Handle add/remove
                if (addTags && addTags.length > 0) {
                    const insertTag = db.prepare('INSERT OR IGNORE INTO note_tags (note_id, topic_id) VALUES (?, ?)');
                    for (const tagId of addTags) {
                        insertTag.run(noteId, tagId);
                    }
                }
                if (removeTags && removeTags.length > 0) {
                    const placeholders = removeTags.map(() => '?').join(',');
                    db.prepare(`DELETE FROM note_tags WHERE note_id = ? AND topic_id IN (${placeholders})`).run(noteId, ...removeTags);
                }
            }
            const updatedNote = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);
            const currentTags = getNoteTags(noteId);
            // Get topic details for response
            let primaryTopic;
            if (updatedNote.primary_topic_id) {
                primaryTopic = db.prepare('SELECT * FROM topics WHERE id = ?').get(updatedNote.primary_topic_id);
            }
            const tagTopics = currentTags.length > 0
                ? db.prepare(`SELECT * FROM topics WHERE id IN (${currentTags.map(() => '?').join(',')})`).all(...currentTags)
                : [];
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            message: 'Note topics updated successfully',
                            note: {
                                ...toApiFormat(updatedNote),
                                tags: currentTags,
                            },
                            primaryTopic: primaryTopic ? topicToApiFormat(primaryTopic) : null,
                            tagTopics: tagTopics.map(topicToApiFormat),
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error setting note topics:', error);
            return {
                content: [{ type: 'text', text: `Error setting note topics: ${error}` }],
                isError: true,
            };
        }
    });
    logger.info('Registered CRUD tools: create_note, update_note, delete_note, set_note_topics');
}
