import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { topicToApiFormat, toApiFormat } from '../utils/format.js';
import { logger } from '../utils/logger.js';
/**
 * Build tree structure from flat list
 */
function buildTree(topics, parentId = null) {
    return topics
        .filter((t) => t.parent_id === parentId)
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
        .map((topic) => ({
        ...topic,
        children: buildTree(topics, topic.id),
    }));
}
/**
 * Get all descendant IDs for a topic (recursive)
 */
function getDescendantIds(topicId) {
    const children = db.prepare('SELECT id FROM topics WHERE parent_id = ?').all(topicId);
    let ids = [topicId];
    for (const child of children) {
        ids = ids.concat(getDescendantIds(child.id));
    }
    return ids;
}
/**
 * Get note count for a topic (including all descendants)
 */
function getTopicNoteCount(topicId) {
    const allIds = getDescendantIds(topicId);
    const placeholders = allIds.map(() => '?').join(',');
    const result = db
        .prepare(`
    SELECT COUNT(*) as count FROM (
      SELECT id FROM notes WHERE primary_topic_id IN (${placeholders})
      UNION
      SELECT note_id FROM note_tags WHERE topic_id IN (${placeholders})
    )
  `)
        .get(...allIds, ...allIds);
    return result.count;
}
/**
 * Add note counts to tree
 */
function addNoteCounts(tree) {
    return tree.map((topic) => ({
        ...topic,
        noteCount: getTopicNoteCount(topic.id),
        children: addNoteCounts(topic.children || []),
    }));
}
/**
 * Convert topic with children to API format
 */
function topicTreeToApiFormat(topic) {
    return {
        ...topicToApiFormat(topic),
        noteCount: topic.noteCount,
        children: (topic.children || []).map(topicTreeToApiFormat),
    };
}
/**
 * Register topic tools for MCP
 */
export function registerTopicTools(server) {
    // list_topics - Get topic tree or flat list
    server.tool('list_topics', 'Get the topic taxonomy as a tree structure or flat list', {
        flat: z.boolean().optional().describe('Return flat list instead of tree (default: false)'),
        includeNoteCounts: z.boolean().optional().describe('Include note counts for each topic (default: true)'),
    }, async ({ flat = false, includeNoteCounts = true }) => {
        try {
            const topics = db.prepare('SELECT * FROM topics ORDER BY sort_order, name').all();
            if (flat) {
                const result = topics.map((t) => ({
                    ...topicToApiFormat(t),
                    noteCount: includeNoteCounts ? getTopicNoteCount(t.id) : undefined,
                }));
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                topics: result,
                                total: result.length,
                            }, null, 2),
                        },
                    ],
                };
            }
            let tree = buildTree(topics);
            if (includeNoteCounts) {
                tree = addNoteCounts(tree);
            }
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            topics: tree.map(topicTreeToApiFormat),
                            total: topics.length,
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error listing topics:', error);
            return {
                content: [{ type: 'text', text: `Error listing topics: ${error}` }],
                isError: true,
            };
        }
    });
    // get_topic - Get single topic by ID
    server.tool('get_topic', 'Get a single topic by its ID, including children and note count', {
        id: z.string().describe('The UUID of the topic to retrieve'),
    }, async ({ id }) => {
        try {
            const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(id);
            if (!topic) {
                return {
                    content: [{ type: 'text', text: `Topic not found with ID: ${id}` }],
                    isError: true,
                };
            }
            // Get children
            const children = db.prepare('SELECT * FROM topics WHERE parent_id = ? ORDER BY sort_order, name').all(id);
            // Get parent path
            const getParentPath = (topicId) => {
                if (!topicId)
                    return [];
                const parent = db.prepare('SELECT * FROM topics WHERE id = ?').get(topicId);
                if (!parent)
                    return [];
                return [...getParentPath(parent.parent_id), parent];
            };
            const parentPath = getParentPath(topic.parent_id);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            ...topicToApiFormat(topic),
                            noteCount: getTopicNoteCount(topic.id),
                            children: children.map((c) => ({
                                ...topicToApiFormat(c),
                                noteCount: getTopicNoteCount(c.id),
                            })),
                            parentPath: parentPath.map(topicToApiFormat),
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error getting topic:', error);
            return {
                content: [{ type: 'text', text: `Error getting topic: ${error}` }],
                isError: true,
            };
        }
    });
    // get_topic_notes - Get all notes under a topic
    server.tool('get_topic_notes', 'Get all notes that have a specific topic (primary or secondary), including descendant topics', {
        id: z.string().describe('The UUID of the topic'),
        limit: z.number().optional().describe('Maximum number of notes to return (default: 100)'),
        offset: z.number().optional().describe('Number of notes to skip (default: 0)'),
    }, async ({ id, limit = 100, offset = 0 }) => {
        try {
            const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(id);
            if (!topic) {
                return {
                    content: [{ type: 'text', text: `Topic not found with ID: ${id}` }],
                    isError: true,
                };
            }
            const allIds = getDescendantIds(id);
            const placeholders = allIds.map(() => '?').join(',');
            const notes = db
                .prepare(`
          SELECT DISTINCT n.* FROM notes n
          LEFT JOIN note_tags nt ON n.id = nt.note_id
          WHERE n.primary_topic_id IN (${placeholders})
             OR nt.topic_id IN (${placeholders})
          ORDER BY n.book, n.start_chapter, n.start_verse
          LIMIT ? OFFSET ?
        `)
                .all(...allIds, ...allIds, limit, offset);
            const totalResult = db
                .prepare(`
          SELECT COUNT(*) as count FROM (
            SELECT DISTINCT n.id FROM notes n
            LEFT JOIN note_tags nt ON n.id = nt.note_id
            WHERE n.primary_topic_id IN (${placeholders})
               OR nt.topic_id IN (${placeholders})
          )
        `)
                .get(...allIds, ...allIds);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            topic: topicToApiFormat(topic),
                            notes: notes.map(toApiFormat),
                            total: totalResult.count,
                            limit,
                            offset,
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error getting topic notes:', error);
            return {
                content: [{ type: 'text', text: `Error getting topic notes: ${error}` }],
                isError: true,
            };
        }
    });
    // create_topic - Create a new topic
    server.tool('create_topic', 'Create a new topic in the taxonomy', {
        name: z.string().describe('Topic name'),
        parentId: z.string().optional().describe('Parent topic ID (null for root topic)'),
        sortOrder: z.number().optional().describe('Sort order within parent (default: 0)'),
        systematicTagId: z.string().optional().describe('Link to systematic theology tag'),
    }, async ({ name, parentId, sortOrder = 0, systematicTagId }) => {
        try {
            if (!name || !name.trim()) {
                return {
                    content: [{ type: 'text', text: 'Topic name is required' }],
                    isError: true,
                };
            }
            // Validate parent exists if provided
            if (parentId) {
                const parent = db.prepare('SELECT id FROM topics WHERE id = ?').get(parentId);
                if (!parent) {
                    return {
                        content: [{ type: 'text', text: 'Parent topic not found' }],
                        isError: true,
                    };
                }
            }
            // Validate systematic tag exists if provided
            if (systematicTagId) {
                const tag = db.prepare('SELECT id FROM systematic_tags WHERE id = ?').get(systematicTagId);
                if (!tag) {
                    return {
                        content: [{ type: 'text', text: 'Systematic tag not found' }],
                        isError: true,
                    };
                }
            }
            const id = uuidv4();
            const now = new Date().toISOString();
            db.prepare(`
          INSERT INTO topics (id, name, parent_id, sort_order, systematic_tag_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(id, name.trim(), parentId ?? null, sortOrder, systematicTagId ?? null, now, now);
            const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(id);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            message: 'Topic created successfully',
                            topic: topicToApiFormat(topic),
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error creating topic:', error);
            return {
                content: [{ type: 'text', text: `Error creating topic: ${error}` }],
                isError: true,
            };
        }
    });
    // update_topic - Update an existing topic
    server.tool('update_topic', 'Update an existing topic (partial update - only provided fields are changed)', {
        id: z.string().describe('The UUID of the topic to update'),
        name: z.string().optional().describe('New topic name'),
        parentId: z.string().nullable().optional().describe('New parent topic ID (null for root)'),
        sortOrder: z.number().optional().describe('New sort order'),
        systematicTagId: z.string().nullable().optional().describe('New systematic tag ID'),
    }, async ({ id, name, parentId, sortOrder, systematicTagId }) => {
        try {
            const existing = db.prepare('SELECT * FROM topics WHERE id = ?').get(id);
            if (!existing) {
                return {
                    content: [{ type: 'text', text: `Topic not found with ID: ${id}` }],
                    isError: true,
                };
            }
            const newParentId = parentId !== undefined ? parentId : existing.parent_id;
            // Prevent self-reference
            if (newParentId === id) {
                return {
                    content: [{ type: 'text', text: 'Topic cannot be its own parent' }],
                    isError: true,
                };
            }
            // Prevent circular reference
            if (newParentId) {
                let currentParent = newParentId;
                while (currentParent) {
                    if (currentParent === id) {
                        return {
                            content: [{ type: 'text', text: 'Circular reference detected' }],
                            isError: true,
                        };
                    }
                    const parent = db.prepare('SELECT parent_id FROM topics WHERE id = ?').get(currentParent);
                    currentParent = parent?.parent_id ?? null;
                }
            }
            const updatedName = name ?? existing.name;
            const updatedSortOrder = sortOrder ?? existing.sort_order;
            const updatedSystematicTagId = systematicTagId !== undefined ? systematicTagId : existing.systematic_tag_id;
            const now = new Date().toISOString();
            db.prepare(`
          UPDATE topics
          SET name = ?, parent_id = ?, sort_order = ?, systematic_tag_id = ?, updated_at = ?
          WHERE id = ?
        `).run(updatedName.trim(), newParentId, updatedSortOrder, updatedSystematicTagId, now, id);
            const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(id);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            message: 'Topic updated successfully',
                            topic: topicToApiFormat(topic),
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error updating topic:', error);
            return {
                content: [{ type: 'text', text: `Error updating topic: ${error}` }],
                isError: true,
            };
        }
    });
    // delete_topic - Delete a topic
    server.tool('delete_topic', 'Delete a topic by ID (also removes topic from notes and deletes child topics)', {
        id: z.string().describe('The UUID of the topic to delete'),
    }, async ({ id }) => {
        try {
            const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(id);
            if (!topic) {
                return {
                    content: [{ type: 'text', text: `Topic not found with ID: ${id}` }],
                    isError: true,
                };
            }
            // Get descendant count for confirmation
            const descendantIds = getDescendantIds(id);
            const childCount = descendantIds.length - 1; // Exclude self
            // Clear primary_topic_id from notes
            db.prepare('UPDATE notes SET primary_topic_id = NULL WHERE primary_topic_id = ?').run(id);
            // Delete from note_tags
            db.prepare('DELETE FROM note_tags WHERE topic_id = ?').run(id);
            // CASCADE handles child topics
            db.prepare('DELETE FROM topics WHERE id = ?').run(id);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            message: 'Topic deleted successfully',
                            deletedTopic: topicToApiFormat(topic),
                            childTopicsDeleted: childCount,
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error deleting topic:', error);
            return {
                content: [{ type: 'text', text: `Error deleting topic: ${error}` }],
                isError: true,
            };
        }
    });
    // seed_topics - Seed default topics
    server.tool('seed_topics', 'Seed the default topic taxonomy (only works if no topics exist)', {}, async () => {
        try {
            const existingCount = db.prepare('SELECT COUNT(*) as count FROM topics').get().count;
            if (existingCount > 0) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                success: false,
                                message: `Topics already exist (${existingCount} topics). Delete all topics first to reseed.`,
                            }, null, 2),
                        },
                    ],
                };
            }
            // Call the seed API endpoint logic (simplified version)
            const now = new Date().toISOString();
            const createTopic = (name, parentId = null, sortOrder = 0, systematicTagId = null) => {
                const topicId = uuidv4();
                db.prepare(`
            INSERT INTO topics (id, name, parent_id, sort_order, systematic_tag_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(topicId, name, parentId, sortOrder, systematicTagId, now, now);
                return topicId;
            };
            // Create root topics
            const doctrinal = createTopic('Doctrinal', null, 0);
            const pastoral = createTopic('Pastoral', null, 1);
            const resources = createTopic('Sermon Resources', null, 2);
            // Doctrinal sub-topics
            createTopic('Word of God', doctrinal, 0, 'doctrine-word');
            const doctrineGod = createTopic('God', doctrinal, 1, 'doctrine-god');
            createTopic('Trinity', doctrineGod, 0);
            createTopic('Attributes of God', doctrineGod, 1);
            createTopic('Providence', doctrineGod, 2);
            const doctrineMan = createTopic('Man', doctrinal, 2, 'doctrine-man');
            createTopic('Image of God', doctrineMan, 0);
            createTopic('Fall & Original Sin', doctrineMan, 1);
            const doctrineChrist = createTopic('Christ', doctrinal, 3, 'doctrine-christ-spirit');
            createTopic('Incarnation', doctrineChrist, 0);
            createTopic('Atonement', doctrineChrist, 1);
            createTopic('Resurrection of Christ', doctrineChrist, 2);
            const doctrineSalvation = createTopic('Salvation', doctrinal, 5, 'doctrine-salvation');
            createTopic('Justification', doctrineSalvation, 0);
            createTopic('Sanctification', doctrineSalvation, 1);
            createTopic('Perseverance', doctrineSalvation, 2);
            const doctrineChurch = createTopic('Church', doctrinal, 6, 'doctrine-church');
            createTopic('Nature of the Church', doctrineChurch, 0);
            createTopic('Baptism', doctrineChurch, 1);
            createTopic('Communion', doctrineChurch, 2);
            const doctrineFuture = createTopic('Future', doctrinal, 7, 'doctrine-future');
            createTopic('Return of Christ', doctrineFuture, 0);
            createTopic('Resurrection', doctrineFuture, 1);
            createTopic('Judgment', doctrineFuture, 2);
            // Pastoral sub-topics
            const spiritualLife = createTopic('Spiritual Life', pastoral, 0);
            createTopic('Prayer', spiritualLife, 0);
            createTopic('Worship', spiritualLife, 1);
            createTopic('Faith', spiritualLife, 2);
            const relationships = createTopic('Relationships', pastoral, 1);
            createTopic('Marriage', relationships, 0);
            createTopic('Parenting & Family', relationships, 1);
            const ministry = createTopic('Ministry & Service', pastoral, 2);
            createTopic('Evangelism', ministry, 0);
            createTopic('Discipleship', ministry, 1);
            createTopic('Leadership', ministry, 2);
            // Resource types
            createTopic('Illustrations', resources, 0);
            createTopic('Quotes', resources, 1);
            createTopic('Applications', resources, 2);
            createTopic('Outlines', resources, 3);
            const finalCount = db.prepare('SELECT COUNT(*) as count FROM topics').get().count;
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            message: 'Default topics seeded successfully',
                            topicsCreated: finalCount,
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error seeding topics:', error);
            return {
                content: [{ type: 'text', text: `Error seeding topics: ${error}` }],
                isError: true,
            };
        }
    });
    // find_topic_by_name - Fuzzy search for topics
    server.tool('find_topic_by_name', 'Search for topics by name (case-insensitive partial match)', {
        query: z.string().describe('Search query for topic name'),
        limit: z.number().optional().describe('Maximum number of results (default: 10)'),
    }, async ({ query, limit = 10 }) => {
        try {
            const topics = db
                .prepare(`
          SELECT * FROM topics
          WHERE name LIKE ?
          ORDER BY
            CASE WHEN name = ? THEN 0
                 WHEN name LIKE ? THEN 1
                 ELSE 2 END,
            name
          LIMIT ?
        `)
                .all(`%${query}%`, query, `${query}%`, limit);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            query,
                            results: topics.map((t) => ({
                                ...topicToApiFormat(t),
                                noteCount: getTopicNoteCount(t.id),
                            })),
                            count: topics.length,
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            logger.error('Error searching topics:', error);
            return {
                content: [{ type: 'text', text: `Error searching topics: ${error}` }],
                isError: true,
            };
        }
    });
    logger.info('Registered topic tools: list_topics, get_topic, get_topic_notes, create_topic, update_topic, delete_topic, seed_topics, find_topic_by_name');
}
