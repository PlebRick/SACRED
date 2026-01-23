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
  systematicTagId: row.systematic_tag_id,
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
    const { name, parentId = null, sortOrder = 0, systematicTagId = null } = req.body;

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

    // Validate systematic tag exists if provided
    if (systematicTagId) {
      const tag = db.prepare('SELECT id FROM systematic_tags WHERE id = ?').get(systematicTagId);
      if (!tag) {
        return res.status(400).json({ error: 'Systematic tag not found' });
      }
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO topics (id, name, parent_id, sort_order, systematic_tag_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, name.trim(), parentId, sortOrder, systematicTagId, now, now);

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
      sortOrder = existing.sort_order,
      systematicTagId = existing.systematic_tag_id
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

    // Validate systematic tag exists if provided
    if (systematicTagId) {
      const tag = db.prepare('SELECT id FROM systematic_tags WHERE id = ?').get(systematicTagId);
      if (!tag) {
        return res.status(400).json({ error: 'Systematic tag not found' });
      }
    }

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE topics
      SET name = ?, parent_id = ?, sort_order = ?, systematic_tag_id = ?, updated_at = ?
      WHERE id = ?
    `).run(name.trim(), parentId, sortOrder, systematicTagId, now, id);

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

    // Helper to create a topic with optional systematic_tag_id
    const createTopic = (name, parentId = null, sortOrder = 0, systematicTagId = null) => {
      const id = uuidv4();
      db.prepare(`
        INSERT INTO topics (id, name, parent_id, sort_order, systematic_tag_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, name, parentId, sortOrder, systematicTagId, now, now);
      return id;
    };

    // ===========================================
    // DOCTRINAL - Maps to Grudem's 7 Parts with Sub-topics
    // ===========================================
    const doctrinal = createTopic('Doctrinal', null, 0);

    // Word of God
    createTopic('Word of God', doctrinal, 0, 'doctrine-word');

    // God with sub-topics
    const doctrineGod = createTopic('God', doctrinal, 1, 'doctrine-god');
    createTopic('Trinity', doctrineGod, 0);
    createTopic('Attributes of God', doctrineGod, 1);
    createTopic('Providence', doctrineGod, 2);

    // Man with sub-topics
    const doctrineMan = createTopic('Man', doctrinal, 2, 'doctrine-man');
    createTopic('Image of God', doctrineMan, 0);
    createTopic('Fall & Original Sin', doctrineMan, 1);
    createTopic('Human Nature', doctrineMan, 2);

    // Christ with sub-topics
    const doctrineChrist = createTopic('Christ', doctrinal, 3, 'doctrine-christ-spirit');
    createTopic('Incarnation', doctrineChrist, 0);
    createTopic('Atonement', doctrineChrist, 1);
    createTopic('Resurrection of Christ', doctrineChrist, 2);
    createTopic('Ascension', doctrineChrist, 3);

    // Holy Spirit with sub-topics
    const doctrineSpirit = createTopic('Holy Spirit', doctrinal, 4);
    createTopic('Baptism of the Spirit', doctrineSpirit, 0);
    createTopic('Filling of the Spirit', doctrineSpirit, 1);
    createTopic('Fruit of the Spirit', doctrineSpirit, 2);

    // Salvation (Ordo Salutis) with sub-topics
    const doctrineSalvation = createTopic('Salvation', doctrinal, 5, 'doctrine-salvation');
    createTopic('Election', doctrineSalvation, 0);
    createTopic('Calling', doctrineSalvation, 1);
    createTopic('Regeneration', doctrineSalvation, 2);
    createTopic('Conversion', doctrineSalvation, 3);
    createTopic('Justification', doctrineSalvation, 4);
    createTopic('Adoption', doctrineSalvation, 5);
    createTopic('Sanctification', doctrineSalvation, 6);
    createTopic('Perseverance', doctrineSalvation, 7);
    createTopic('Glorification', doctrineSalvation, 8);
    createTopic('Union with Christ', doctrineSalvation, 9);

    // Church with sub-topics
    const doctrineChurch = createTopic('Church', doctrinal, 6, 'doctrine-church');
    createTopic('Nature of the Church', doctrineChurch, 0);
    createTopic('Marks of the Church', doctrineChurch, 1);
    createTopic('Offices & Governance', doctrineChurch, 2);

    // Future with sub-topics
    const doctrineFuture = createTopic('Future', doctrinal, 7, 'doctrine-future');
    createTopic('Return of Christ', doctrineFuture, 0);
    createTopic('Resurrection', doctrineFuture, 1);
    createTopic('Judgment', doctrineFuture, 2);
    createTopic('Heaven', doctrineFuture, 3);
    createTopic('Hell', doctrineFuture, 4);
    createTopic('New Creation', doctrineFuture, 5);

    // ===========================================
    // PASTORAL - Comprehensive sermon prep topics
    // ===========================================
    const pastoral = createTopic('Pastoral', null, 1);

    // Spiritual Life
    const spiritualLife = createTopic('Spiritual Life', pastoral, 0);
    createTopic('Prayer', spiritualLife, 0);
    createTopic('Worship', spiritualLife, 1);
    createTopic('Faith', spiritualLife, 2);
    createTopic('Obedience', spiritualLife, 3);
    createTopic('Spiritual Disciplines', spiritualLife, 4);
    createTopic('Fasting', spiritualLife, 5);

    // Relationships
    const relationships = createTopic('Relationships', pastoral, 1);
    createTopic('Marriage', relationships, 0);
    createTopic('Parenting & Family', relationships, 1);
    createTopic('Singleness', relationships, 2);
    createTopic('Friendship', relationships, 3);
    createTopic('Community & Fellowship', relationships, 4);

    // Ministry & Service
    const ministry = createTopic('Ministry & Service', pastoral, 2);
    createTopic('Evangelism', ministry, 0);
    createTopic('Discipleship', ministry, 1);
    createTopic('Leadership', ministry, 2);
    createTopic('Spiritual Gifts', ministry, 3);
    createTopic('Missions', ministry, 4);
    createTopic('Giving & Stewardship', ministry, 5);
    createTopic('Hospitality', ministry, 6);

    // Life Challenges
    const challenges = createTopic('Life Challenges', pastoral, 3);
    createTopic('Suffering & Trials', challenges, 0);
    createTopic('Grief & Loss', challenges, 1);
    createTopic('Anxiety & Fear', challenges, 2);
    createTopic('Healing', challenges, 3);
    createTopic('Forgiveness', challenges, 4);
    createTopic('Temptation & Sin', challenges, 5);
    createTopic('Death & Dying', challenges, 6);

    // Christian Character
    const character = createTopic('Christian Character', pastoral, 4);
    createTopic('Holiness', character, 0);
    createTopic('Humility', character, 1);
    createTopic('Patience', character, 2);
    createTopic('Gratitude', character, 3);
    createTopic('Love', character, 4);
    createTopic('Joy', character, 5);
    createTopic('Peace', character, 6);
    createTopic('Hope', character, 7);

    // Work & World
    const workWorld = createTopic('Work & World', pastoral, 5);
    createTopic('Work & Vocation', workWorld, 0);
    createTopic('Rest & Sabbath', workWorld, 1);
    createTopic('Money & Finances', workWorld, 2);
    createTopic('Culture & Society', workWorld, 3);
    createTopic('Justice & Compassion', workWorld, 4);
    createTopic('Creation Care', workWorld, 5);

    // Church Life
    const churchLife = createTopic('Church Life', pastoral, 6);
    createTopic('Unity', churchLife, 0);
    createTopic('Church Membership', churchLife, 1);
    createTopic('Baptism', churchLife, 2);
    createTopic('Communion', churchLife, 3);
    createTopic('Accountability', churchLife, 4);

    // ===========================================
    // SERMON RESOURCES - Material types
    // ===========================================
    const resources = createTopic('Sermon Resources', null, 2);
    createTopic('Illustrations', resources, 0);
    createTopic('Quotes', resources, 1);
    createTopic('Word Studies', resources, 2);
    createTopic('Applications', resources, 3);
    createTopic('Outlines', resources, 4);
    createTopic('Series', resources, 5);

    res.status(201).json({ success: true, message: 'Default topics seeded successfully' });
  } catch (error) {
    console.error('Error seeding topics:', error);
    res.status(500).json({ error: 'Failed to seed topics' });
  }
});

module.exports = router;
