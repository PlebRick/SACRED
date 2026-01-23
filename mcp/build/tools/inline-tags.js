import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { inlineTagTypeToApiFormat, inlineTagToApiFormat } from '../utils/format.js';
import { logger } from '../utils/logger.js';
/**
 * Register inline tag tools for MCP
 */
export function registerInlineTagTools(server) {
    // list_inline_tag_types - Get all tag type definitions
    server.tool('list_inline_tag_types', 'Get all inline tag type definitions (predefined and custom)', {}, async () => {
        try {
            const types = db.prepare('SELECT * FROM inline_tag_types ORDER BY sort_order').all();
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            types: types.map(inlineTagTypeToApiFormat),
                            total: types.length,
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error listing inline tag types:', error);
            return {
                content: [{ type: 'text', text: `Error listing inline tag types: ${error}` }],
                isError: true,
            };
        }
    });
    // create_inline_tag_type - Create a custom tag type
    server.tool('create_inline_tag_type', 'Create a new custom inline tag type', {
        name: z.string().describe('Tag type name (must be unique)'),
        color: z.string().describe('Hex color code (e.g., "#60a5fa")'),
        icon: z.string().optional().describe('Emoji icon for the tag type'),
    }, async ({ name, color, icon }) => {
        try {
            if (!name || !name.trim()) {
                return {
                    content: [{ type: 'text', text: 'Tag type name is required' }],
                    isError: true,
                };
            }
            if (!color.match(/^#[0-9a-fA-F]{6}$/)) {
                return {
                    content: [{ type: 'text', text: 'Color must be a valid hex code (e.g., "#60a5fa")' }],
                    isError: true,
                };
            }
            // Check for duplicate name
            const existing = db.prepare('SELECT id FROM inline_tag_types WHERE name = ?').get(name.trim());
            if (existing) {
                return {
                    content: [{ type: 'text', text: `A tag type with name "${name}" already exists` }],
                    isError: true,
                };
            }
            // Get next sort order
            const maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM inline_tag_types').get().max || 0;
            const id = uuidv4();
            const now = new Date().toISOString();
            db.prepare(`
          INSERT INTO inline_tag_types (id, name, color, icon, is_default, sort_order, created_at)
          VALUES (?, ?, ?, ?, 0, ?, ?)
        `).run(id, name.trim(), color, icon ?? null, maxOrder + 1, now);
            const tagType = db.prepare('SELECT * FROM inline_tag_types WHERE id = ?').get(id);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            message: 'Inline tag type created successfully',
                            tagType: inlineTagTypeToApiFormat(tagType),
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error creating inline tag type:', error);
            return {
                content: [{ type: 'text', text: `Error creating inline tag type: ${error}` }],
                isError: true,
            };
        }
    });
    // update_inline_tag_type - Update a tag type
    server.tool('update_inline_tag_type', 'Update an existing inline tag type', {
        id: z.string().describe('The ID of the tag type to update'),
        name: z.string().optional().describe('New name'),
        color: z.string().optional().describe('New hex color code'),
        icon: z.string().optional().describe('New emoji icon'),
        sortOrder: z.number().optional().describe('New sort order'),
    }, async ({ id, name, color, icon, sortOrder }) => {
        try {
            const existing = db.prepare('SELECT * FROM inline_tag_types WHERE id = ?').get(id);
            if (!existing) {
                return {
                    content: [{ type: 'text', text: `Tag type not found with ID: ${id}` }],
                    isError: true,
                };
            }
            if (color && !color.match(/^#[0-9a-fA-F]{6}$/)) {
                return {
                    content: [{ type: 'text', text: 'Color must be a valid hex code (e.g., "#60a5fa")' }],
                    isError: true,
                };
            }
            const updatedName = name?.trim() ?? existing.name;
            const updatedColor = color ?? existing.color;
            const updatedIcon = icon !== undefined ? icon : existing.icon;
            const updatedSortOrder = sortOrder ?? existing.sort_order;
            db.prepare(`
          UPDATE inline_tag_types
          SET name = ?, color = ?, icon = ?, sort_order = ?
          WHERE id = ?
        `).run(updatedName, updatedColor, updatedIcon, updatedSortOrder, id);
            const tagType = db.prepare('SELECT * FROM inline_tag_types WHERE id = ?').get(id);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            message: 'Inline tag type updated successfully',
                            tagType: inlineTagTypeToApiFormat(tagType),
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error updating inline tag type:', error);
            return {
                content: [{ type: 'text', text: `Error updating inline tag type: ${error}` }],
                isError: true,
            };
        }
    });
    // delete_inline_tag_type - Delete a tag type
    server.tool('delete_inline_tag_type', 'Delete a custom inline tag type (cannot delete default types)', {
        id: z.string().describe('The ID of the tag type to delete'),
    }, async ({ id }) => {
        try {
            const existing = db.prepare('SELECT * FROM inline_tag_types WHERE id = ?').get(id);
            if (!existing) {
                return {
                    content: [{ type: 'text', text: `Tag type not found with ID: ${id}` }],
                    isError: true,
                };
            }
            if (existing.is_default === 1) {
                return {
                    content: [{ type: 'text', text: 'Cannot delete default tag types' }],
                    isError: true,
                };
            }
            db.prepare('DELETE FROM inline_tag_types WHERE id = ?').run(id);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            message: 'Inline tag type deleted successfully',
                            deletedTagType: inlineTagTypeToApiFormat(existing),
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error deleting inline tag type:', error);
            return {
                content: [{ type: 'text', text: `Error deleting inline tag type: ${error}` }],
                isError: true,
            };
        }
    });
    // list_inline_tags - Get all inline tags with optional filters
    server.tool('list_inline_tags', 'Get inline tags extracted from notes with optional filtering', {
        tagType: z.string().optional().describe('Filter by tag type ID (e.g., "illustration", "application")'),
        book: z.string().optional().describe('Filter by Bible book code'),
        search: z.string().optional().describe('Search text content'),
        limit: z.number().optional().describe('Maximum results (default: 100)'),
        offset: z.number().optional().describe('Skip results (default: 0)'),
    }, async ({ tagType, book, search, limit = 100, offset = 0 }) => {
        try {
            let query = `
          SELECT it.*, n.title as note_title, n.book, n.start_chapter, n.start_verse, n.end_chapter, n.end_verse
          FROM inline_tags it
          JOIN notes n ON it.note_id = n.id
          WHERE 1=1
        `;
            const params = [];
            if (tagType) {
                query += ' AND it.tag_type = ?';
                params.push(tagType);
            }
            if (book) {
                query += ' AND n.book = ?';
                params.push(book.toUpperCase());
            }
            if (search) {
                query += ' AND it.text_content LIKE ?';
                params.push(`%${search}%`);
            }
            query += ' ORDER BY n.book, n.start_chapter, n.start_verse LIMIT ? OFFSET ?';
            params.push(limit, offset);
            const tags = db.prepare(query).all(...params);
            // Get total count
            let countQuery = `
          SELECT COUNT(*) as count
          FROM inline_tags it
          JOIN notes n ON it.note_id = n.id
          WHERE 1=1
        `;
            const countParams = [];
            if (tagType) {
                countQuery += ' AND it.tag_type = ?';
                countParams.push(tagType);
            }
            if (book) {
                countQuery += ' AND n.book = ?';
                countParams.push(book.toUpperCase());
            }
            if (search) {
                countQuery += ' AND it.text_content LIKE ?';
                countParams.push(`%${search}%`);
            }
            const totalResult = db.prepare(countQuery).get(...countParams);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            tags: tags.map(inlineTagToApiFormat),
                            total: totalResult.count,
                            limit,
                            offset,
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error listing inline tags:', error);
            return {
                content: [{ type: 'text', text: `Error listing inline tags: ${error}` }],
                isError: true,
            };
        }
    });
    // get_inline_tags_by_type - Get counts grouped by tag type
    server.tool('get_inline_tags_by_type', 'Get inline tag counts grouped by tag type', {}, async () => {
        try {
            const counts = db
                .prepare(`
          SELECT itt.*, COUNT(it.id) as count
          FROM inline_tag_types itt
          LEFT JOIN inline_tags it ON itt.id = it.tag_type
          GROUP BY itt.id
          ORDER BY itt.sort_order
        `)
                .all();
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            types: counts.map((row) => ({
                                ...inlineTagTypeToApiFormat(row),
                                count: row.count,
                            })),
                            totalTags: counts.reduce((sum, t) => sum + t.count, 0),
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error getting inline tag counts:', error);
            return {
                content: [{ type: 'text', text: `Error getting inline tag counts: ${error}` }],
                isError: true,
            };
        }
    });
    // search_inline_tags - Search tagged content
    server.tool('search_inline_tags', 'Search inline tagged content by keyword', {
        query: z.string().describe('Search query'),
        limit: z.number().optional().describe('Maximum results (default: 50)'),
    }, async ({ query, limit = 50 }) => {
        try {
            const tags = db
                .prepare(`
          SELECT it.*, n.title as note_title, n.book, n.start_chapter, n.start_verse, n.end_chapter, n.end_verse
          FROM inline_tags it
          JOIN notes n ON it.note_id = n.id
          WHERE it.text_content LIKE ?
          ORDER BY n.book, n.start_chapter, n.start_verse
          LIMIT ?
        `)
                .all(`%${query}%`, limit);
            // Group by tag type
            const byType = {};
            for (const tag of tags) {
                if (!byType[tag.tag_type]) {
                    byType[tag.tag_type] = [];
                }
                byType[tag.tag_type].push(tag);
            }
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            query,
                            results: tags.map(inlineTagToApiFormat),
                            byType: Object.fromEntries(Object.entries(byType).map(([type, tagList]) => [type, tagList.map(inlineTagToApiFormat)])),
                            count: tags.length,
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error searching inline tags:', error);
            return {
                content: [{ type: 'text', text: `Error searching inline tags: ${error}` }],
                isError: true,
            };
        }
    });
    // seed_inline_tag_types - Re-seed default tag types
    server.tool('seed_inline_tag_types', 'Re-seed the default inline tag types (upserts, does not delete custom types)', {}, async () => {
        try {
            const defaultTypes = [
                { id: 'illustration', name: 'Illustration', color: '#60a5fa', icon: '💡', sort_order: 0 },
                { id: 'application', name: 'Application', color: '#34d399', icon: '✅', sort_order: 1 },
                { id: 'keypoint', name: 'Key Point', color: '#fbbf24', icon: '⭐', sort_order: 2 },
                { id: 'quote', name: 'Quote', color: '#a78bfa', icon: '💬', sort_order: 3 },
                { id: 'crossref', name: 'Cross-Ref', color: '#f472b6', icon: '🔗', sort_order: 4 },
            ];
            const now = new Date().toISOString();
            const upsert = db.prepare(`
          INSERT INTO inline_tag_types (id, name, color, icon, is_default, sort_order, created_at)
          VALUES (?, ?, ?, ?, 1, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            color = excluded.color,
            icon = excluded.icon,
            is_default = 1,
            sort_order = excluded.sort_order
        `);
            for (const tagType of defaultTypes) {
                upsert.run(tagType.id, tagType.name, tagType.color, tagType.icon, tagType.sort_order, now);
            }
            const types = db.prepare('SELECT * FROM inline_tag_types ORDER BY sort_order').all();
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            message: 'Default inline tag types seeded successfully',
                            types: types.map(inlineTagTypeToApiFormat),
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error seeding inline tag types:', error);
            return {
                content: [{ type: 'text', text: `Error seeding inline tag types: ${error}` }],
                isError: true,
            };
        }
    });
    logger.info('Registered inline tag tools: list_inline_tag_types, create_inline_tag_type, update_inline_tag_type, delete_inline_tag_type, list_inline_tags, get_inline_tags_by_type, search_inline_tags, seed_inline_tag_types');
}
