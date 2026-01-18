const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db.cjs');

const router = express.Router();

// Convert database row (snake_case) to API format (camelCase)
const toApiFormat = (row) => ({
  id: row.id,
  name: row.name,
  parentId: row.parent_id,
  sortOrder: row.sort_order,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

// Build tree structure from flat list
const buildTree = (topics, parentId = null) => {
  return topics
    .filter(t => t.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map(topic => ({
      ...topic,
      children: buildTree(topics, topic.id)
    }));
};

// Get note count for a topic (including all descendants)
const getTopicNoteCount = (topicId) => {
  // Get all descendant topic IDs
  const getDescendantIds = (id) => {
    const children = db.prepare('SELECT id FROM topics WHERE parent_id = ?').all(id);
    let ids = [id];
    for (const child of children) {
      ids = ids.concat(getDescendantIds(child.id));
    }
    return ids;
  };

  const allIds = getDescendantIds(topicId);
  const placeholders = allIds.map(() => '?').join(',');

  // Count notes with primary_topic_id or in note_tags
  const primaryCount = db.prepare(`
    SELECT COUNT(*) as count FROM notes
    WHERE primary_topic_id IN (${placeholders})
  `).get(...allIds).count;

  const taggedCount = db.prepare(`
    SELECT COUNT(DISTINCT note_id) as count FROM note_tags
    WHERE topic_id IN (${placeholders})
  `).get(...allIds).count;

  // Return combined unique count
  const uniqueCount = db.prepare(`
    SELECT COUNT(*) as count FROM (
      SELECT id FROM notes WHERE primary_topic_id IN (${placeholders})
      UNION
      SELECT note_id FROM note_tags WHERE topic_id IN (${placeholders})
    )
  `).get(...allIds, ...allIds).count;

  return uniqueCount;
};

// Add note counts to tree
const addNoteCounts = (tree) => {
  return tree.map(topic => ({
    ...topic,
    noteCount: getTopicNoteCount(topic.id),
    children: addNoteCounts(topic.children)
  }));
};

// GET /api/topics - Get full topic tree
router.get('/', (req, res) => {
  try {
    const topics = db.prepare('SELECT * FROM topics ORDER BY sort_order, name').all();
    const formattedTopics = topics.map(toApiFormat);
    const tree = buildTree(formattedTopics);
    const treeWithCounts = addNoteCounts(tree);
    res.json(treeWithCounts);
  } catch (error) {
    console.error('Error fetching topics:', error);
    res.status(500).json({ error: 'Failed to fetch topics' });
  }
});

// GET /api/topics/flat - Get flat list of all topics (for dropdowns)
router.get('/flat', (req, res) => {
  try {
    const topics = db.prepare('SELECT * FROM topics ORDER BY name').all();
    res.json(topics.map(toApiFormat));
  } catch (error) {
    console.error('Error fetching topics:', error);
    res.status(500).json({ error: 'Failed to fetch topics' });
  }
});

// GET /api/topics/:id - Get single topic
router.get('/:id', (req, res) => {
  try {
    const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(req.params.id);

    if (!topic) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    res.json(toApiFormat(topic));
  } catch (error) {
    console.error('Error fetching topic:', error);
    res.status(500).json({ error: 'Failed to fetch topic' });
  }
});

// GET /api/topics/:id/notes - Get all notes with this topic (primary or secondary)
router.get('/:id/notes', (req, res) => {
  try {
    const { id } = req.params;

    // Get all descendant topic IDs (for hierarchical counting)
    const getDescendantIds = (topicId) => {
      const children = db.prepare('SELECT id FROM topics WHERE parent_id = ?').all(topicId);
      let ids = [topicId];
      for (const child of children) {
        ids = ids.concat(getDescendantIds(child.id));
      }
      return ids;
    };

    const allIds = getDescendantIds(id);
    const placeholders = allIds.map(() => '?').join(',');

    // Get notes with this topic as primary or secondary, ordered by Bible order
    const notes = db.prepare(`
      SELECT DISTINCT n.* FROM notes n
      LEFT JOIN note_tags nt ON n.id = nt.note_id
      WHERE n.primary_topic_id IN (${placeholders})
         OR nt.topic_id IN (${placeholders})
      ORDER BY n.book, n.start_chapter, n.start_verse
    `).all(...allIds, ...allIds);

    // Format notes for API response
    const formattedNotes = notes.map(row => ({
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
      updatedAt: row.updated_at
    }));

    res.json(formattedNotes);
  } catch (error) {
    console.error('Error fetching notes for topic:', error);
    res.status(500).json({ error: 'Failed to fetch notes for topic' });
  }
});

// POST /api/topics - Create topic
router.post('/', (req, res) => {
  try {
    const { name, parentId = null, sortOrder = 0 } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Topic name is required' });
    }

    // Validate parent exists if provided
    if (parentId) {
      const parent = db.prepare('SELECT id FROM topics WHERE id = ?').get(parentId);
      if (!parent) {
        return res.status(400).json({ error: 'Parent topic not found' });
      }
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO topics (id, name, parent_id, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, name.trim(), parentId, sortOrder, now, now);

    const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(id);
    res.status(201).json(toApiFormat(topic));
  } catch (error) {
    console.error('Error creating topic:', error);
    res.status(500).json({ error: 'Failed to create topic' });
  }
});

// PUT /api/topics/:id - Update topic
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM topics WHERE id = ?').get(id);

    if (!existing) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    const {
      name = existing.name,
      parentId = existing.parent_id,
      sortOrder = existing.sort_order
    } = req.body;

    // Prevent setting self as parent
    if (parentId === id) {
      return res.status(400).json({ error: 'Topic cannot be its own parent' });
    }

    // Prevent circular reference
    if (parentId) {
      let currentParent = parentId;
      while (currentParent) {
        if (currentParent === id) {
          return res.status(400).json({ error: 'Circular reference detected' });
        }
        const parent = db.prepare('SELECT parent_id FROM topics WHERE id = ?').get(currentParent);
        currentParent = parent?.parent_id;
      }
    }

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE topics
      SET name = ?, parent_id = ?, sort_order = ?, updated_at = ?
      WHERE id = ?
    `).run(name.trim(), parentId, sortOrder, now, id);

    const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(id);
    res.json(toApiFormat(topic));
  } catch (error) {
    console.error('Error updating topic:', error);
    res.status(500).json({ error: 'Failed to update topic' });
  }
});

// DELETE /api/topics/:id - Delete topic (cascades to children)
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;

    // Clear primary_topic_id from notes before deleting
    db.prepare('UPDATE notes SET primary_topic_id = NULL WHERE primary_topic_id = ?').run(id);

    // Delete from note_tags
    db.prepare('DELETE FROM note_tags WHERE topic_id = ?').run(id);

    // The CASCADE in the schema will handle child topics
    const result = db.prepare('DELETE FROM topics WHERE id = ?').run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting topic:', error);
    res.status(500).json({ error: 'Failed to delete topic' });
  }
});

// POST /api/topics/seed - Seed default topics
router.post('/seed', (req, res) => {
  try {
    // Check if topics already exist
    const existingCount = db.prepare('SELECT COUNT(*) as count FROM topics').get().count;
    if (existingCount > 0) {
      return res.status(400).json({ error: 'Topics already exist. Delete all topics first to reseed.' });
    }

    const now = new Date().toISOString();

    const createTopic = (name, parentId = null, sortOrder = 0) => {
      const id = uuidv4();
      db.prepare(`
        INSERT INTO topics (id, name, parent_id, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, name, parentId, sortOrder, now, now);
      return id;
    };

    // Seed default topic structure
    const systematic = createTopic('Systematic Theology', null, 0);
    createTopic('Bibliology (Doctrine of Scripture)', systematic, 0);
    createTopic('Theology Proper (Doctrine of God)', systematic, 1);
    createTopic('Christology (Doctrine of Christ)', systematic, 2);
    createTopic('Pneumatology (Doctrine of the Holy Spirit)', systematic, 3);
    createTopic('Anthropology (Doctrine of Man)', systematic, 4);
    createTopic('Hamartiology (Doctrine of Sin)', systematic, 5);
    createTopic('Soteriology (Doctrine of Salvation)', systematic, 6);
    createTopic('Ecclesiology (Doctrine of the Church)', systematic, 7);
    createTopic('Eschatology (Doctrine of Last Things)', systematic, 8);

    const practical = createTopic('Practical', null, 1);
    createTopic('Discipleship', practical, 0);
    createTopic('Marriage & Family', practical, 1);
    createTopic('Leadership', practical, 2);
    createTopic('Prayer', practical, 3);
    createTopic('Evangelism', practical, 4);

    const resources = createTopic('Resources', null, 2);
    createTopic('Illustrations', resources, 0);
    createTopic('Applications', resources, 1);
    createTopic('Quotes', resources, 2);
    createTopic('Word Studies', resources, 3);

    res.status(201).json({ success: true, message: 'Default topics seeded successfully' });
  } catch (error) {
    console.error('Error seeding topics:', error);
    res.status(500).json({ error: 'Failed to seed topics' });
  }
});

module.exports = router;
