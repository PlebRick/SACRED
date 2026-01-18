/**
 * Seed Test Data Script
 *
 * Creates comprehensive test data for the SACRED app including:
 * - Topics hierarchy
 * - Notes with inline tags (illustrations, applications, key points, quotes, cross-refs)
 * - Various books and chapters
 *
 * Usage: node scripts/seedTestData.cjs
 * To clear first: node scripts/seedTestData.cjs --clear
 */

const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/sacred.db');
const db = new Database(dbPath);

const shouldClear = process.argv.includes('--clear');

// ============== Topic Structure ==============
const topicsData = [
  {
    name: 'Systematic Theology',
    children: [
      { name: 'Theology Proper (God)' },
      { name: 'Christology (Christ)' },
      { name: 'Pneumatology (Holy Spirit)' },
      { name: 'Soteriology (Salvation)' },
      { name: 'Ecclesiology (Church)' },
      { name: 'Eschatology (End Times)' },
    ]
  },
  {
    name: 'Biblical Themes',
    children: [
      { name: 'Covenant' },
      { name: 'Kingdom of God' },
      { name: 'Redemption' },
      { name: 'Faith' },
      { name: 'Love' },
      { name: 'Grace' },
    ]
  },
  {
    name: 'Practical',
    children: [
      { name: 'Prayer' },
      { name: 'Discipleship' },
      { name: 'Marriage & Family' },
      { name: 'Leadership' },
      { name: 'Evangelism' },
    ]
  },
  {
    name: 'Sermon Resources',
    children: [
      { name: 'Introductions' },
      { name: 'Conclusions' },
      { name: 'Transitions' },
    ]
  }
];

// ============== Notes with Inline Tags ==============
const notesData = [
  // John 3:16 - Famous salvation verse
  {
    book: 'JHN',
    startChapter: 3,
    endChapter: 3,
    startVerse: 16,
    endVerse: 17,
    title: "God's Love and Salvation",
    topicPath: ['Systematic Theology', 'Soteriology (Salvation)'],
    content: `<p>This is the most famous verse in the Bible, summarizing the gospel message.</p>
<p><span data-inline-tag="keypoint">God's love is the motivation for salvation</span> - not our merit or works.</p>
<p><span data-inline-tag="illustration">Like a father who runs to embrace his returning prodigal son, God's love reaches out to us before we even turn to Him.</span></p>
<p>The word "whosoever" indicates <span data-inline-tag="application">the universal offer of salvation - anyone can receive eternal life through faith</span>.</p>
<p><span data-inline-tag="crossref">Compare with Romans 5:8 - "God demonstrates his own love for us in this: While we were still sinners, Christ died for us."</span></p>`
  },

  // John 1:1-5 - The Logos
  {
    book: 'JHN',
    startChapter: 1,
    endChapter: 1,
    startVerse: 1,
    endVerse: 5,
    title: 'The Divine Logos',
    topicPath: ['Systematic Theology', 'Christology (Christ)'],
    content: `<p>John opens his Gospel with a profound theological statement about Christ's deity.</p>
<p><span data-inline-tag="keypoint">Jesus is eternal - "In the beginning was the Word" places Christ before creation itself.</span></p>
<p><span data-inline-tag="keypoint">Jesus is distinct from yet equal to the Father - "the Word was with God"</span></p>
<p><span data-inline-tag="keypoint">Jesus is fully divine - "the Word was God"</span></p>
<p><span data-inline-tag="illustration">Consider how words reveal the invisible thoughts of our minds. In the same way, Jesus reveals the invisible God to us.</span></p>
<p><span data-inline-tag="quote">"The light shines in the darkness, and the darkness has not overcome it."</span></p>`
  },

  // Romans 8:28-30 - Golden Chain
  {
    book: 'ROM',
    startChapter: 8,
    endChapter: 8,
    startVerse: 28,
    endVerse: 30,
    title: 'The Golden Chain of Salvation',
    topicPath: ['Systematic Theology', 'Soteriology (Salvation)'],
    content: `<p>This passage presents what theologians call the "Golden Chain" of salvation.</p>
<p><span data-inline-tag="keypoint">God works ALL things for good - not just some things, but everything in the believer's life.</span></p>
<p>The chain: <span data-inline-tag="keypoint">Foreknew → Predestined → Called → Justified → Glorified</span></p>
<p><span data-inline-tag="illustration">Like links in an unbreakable chain, each element of salvation is connected. You cannot have one without the others.</span></p>
<p><span data-inline-tag="application">When facing trials, remember that God is sovereignly working even through difficulties to conform you to Christ's image.</span></p>
<p><span data-inline-tag="crossref">See also Ephesians 1:3-14 for another description of God's eternal plan.</span></p>`
  },

  // Genesis 1:1-3 - Creation
  {
    book: 'GEN',
    startChapter: 1,
    endChapter: 1,
    startVerse: 1,
    endVerse: 3,
    title: 'In the Beginning',
    topicPath: ['Systematic Theology', 'Theology Proper (God)'],
    content: `<p>The Bible opens with the fundamental truth: God is Creator.</p>
<p><span data-inline-tag="keypoint">God exists before and independent of creation - He is eternal and self-sufficient.</span></p>
<p><span data-inline-tag="keypoint">Creation was ex nihilo (out of nothing) - God spoke and it came into being.</span></p>
<p><span data-inline-tag="illustration">An artist creates from existing materials, but God created the very materials themselves. He is the ultimate Artist.</span></p>
<p><span data-inline-tag="crossref">John 1:1-3 connects this to Christ: "Through him all things were made."</span></p>
<p><span data-inline-tag="application">As Creator, God has authority over all creation - including your life. Submit to His lordship.</span></p>`
  },

  // Ephesians 2:8-9 - Grace through Faith
  {
    book: 'EPH',
    startChapter: 2,
    endChapter: 2,
    startVerse: 8,
    endVerse: 10,
    title: 'Saved by Grace',
    topicPath: ['Biblical Themes', 'Grace'],
    content: `<p>This is the clearest statement of salvation by grace through faith.</p>
<p><span data-inline-tag="keypoint">Salvation is a gift - not earned, not deserved, freely given.</span></p>
<p><span data-inline-tag="keypoint">Even faith itself is a gift from God - we cannot boast in anything.</span></p>
<p><span data-inline-tag="illustration">Imagine a drowning man. He cannot save himself. Someone must reach down and pull him out. That's grace.</span></p>
<p><span data-inline-tag="quote">"For we are God's handiwork, created in Christ Jesus to do good works."</span></p>
<p><span data-inline-tag="application">Good works are the result of salvation, not the cause. Live out your new identity in Christ!</span></p>`
  },

  // Matthew 6:9-13 - Lord's Prayer
  {
    book: 'MAT',
    startChapter: 6,
    endChapter: 6,
    startVerse: 9,
    endVerse: 13,
    title: "The Lord's Prayer",
    topicPath: ['Practical', 'Prayer'],
    content: `<p>Jesus teaches His disciples HOW to pray with this model prayer.</p>
<p><span data-inline-tag="keypoint">"Our Father" - Prayer is relational, not ritualistic. We approach God as children to a loving Father.</span></p>
<p><span data-inline-tag="keypoint">The prayer moves from God's glory (name, kingdom, will) to our needs (bread, forgiveness, protection).</span></p>
<p><span data-inline-tag="illustration">Like a child asking their father for help, we can come to God with both worship and requests.</span></p>
<p><span data-inline-tag="application">Use this as a template: Start with worship, align with God's purposes, then bring your needs.</span></p>
<p><span data-inline-tag="crossref">Luke 11:1-4 gives another version of this prayer.</span></p>`
  },

  // 1 Corinthians 13:4-7 - Love Chapter
  {
    book: '1CO',
    startChapter: 13,
    endChapter: 13,
    startVerse: 4,
    endVerse: 7,
    title: 'The Nature of Love',
    topicPath: ['Biblical Themes', 'Love'],
    content: `<p>Paul defines love not by feelings but by actions and character.</p>
<p><span data-inline-tag="keypoint">Love is patient and kind - it's characterized by how it treats others.</span></p>
<p><span data-inline-tag="keypoint">Love is defined by what it does NOT do: envy, boast, dishonor, self-seek, anger, keep records.</span></p>
<p><span data-inline-tag="illustration">Read this passage replacing "love" with "Jesus" - He perfectly embodies each quality.</span></p>
<p><span data-inline-tag="application">Read this passage replacing "love" with your own name. Where do you fall short? That's where to grow.</span></p>
<p><span data-inline-tag="quote">"Love never fails."</span></p>`
  },

  // Acts 2:42-47 - Early Church
  {
    book: 'ACT',
    startChapter: 2,
    endChapter: 2,
    startVerse: 42,
    endVerse: 47,
    title: 'The Early Church Community',
    topicPath: ['Systematic Theology', 'Ecclesiology (Church)'],
    content: `<p>This passage shows us the DNA of the early church.</p>
<p><span data-inline-tag="keypoint">Four pillars: Apostles' teaching, fellowship, breaking of bread, prayer.</span></p>
<p><span data-inline-tag="illustration">Like a four-legged stool, a healthy church needs all four elements. Remove one and it becomes unstable.</span></p>
<p><span data-inline-tag="keypoint">They shared everything - radical generosity was the norm, not the exception.</span></p>
<p><span data-inline-tag="application">Evaluate your church involvement: Are you engaged in teaching, fellowship, communion, and prayer?</span></p>
<p><span data-inline-tag="quote">"The Lord added to their number daily those who were being saved."</span></p>`
  },

  // Hebrews 11:1 - Faith Definition
  {
    book: 'HEB',
    startChapter: 11,
    endChapter: 11,
    startVerse: 1,
    endVerse: 6,
    title: 'The Definition of Faith',
    topicPath: ['Biblical Themes', 'Faith'],
    content: `<p>The "Hall of Faith" chapter begins with a definition.</p>
<p><span data-inline-tag="keypoint">Faith is substance and evidence - it's not wishful thinking but confident trust in God's promises.</span></p>
<p><span data-inline-tag="illustration">Faith is like sitting in a chair. You don't see the internal structure, but you trust it will hold you.</span></p>
<p><span data-inline-tag="keypoint">"Without faith it is impossible to please God" - faith is not optional for the Christian life.</span></p>
<p><span data-inline-tag="application">Faith requires action. What step of faith is God calling you to take today?</span></p>
<p><span data-inline-tag="crossref">James 2:17 reminds us that "faith without works is dead."</span></p>`
  },

  // Revelation 21:1-4 - New Heaven and Earth
  {
    book: 'REV',
    startChapter: 21,
    endChapter: 21,
    startVerse: 1,
    endVerse: 4,
    title: 'The New Creation',
    topicPath: ['Systematic Theology', 'Eschatology (End Times)'],
    content: `<p>John's vision of the ultimate future for believers.</p>
<p><span data-inline-tag="keypoint">God will make ALL things new - not just improve the old, but create a completely new reality.</span></p>
<p><span data-inline-tag="keypoint">"God himself will be with them" - perfect, unhindered fellowship with God forever.</span></p>
<p><span data-inline-tag="quote">"He will wipe every tear from their eyes. There will be no more death or mourning or crying or pain."</span></p>
<p><span data-inline-tag="illustration">Every funeral, every hospital, every broken relationship - all temporary. The best is yet to come.</span></p>
<p><span data-inline-tag="application">Let this future hope shape how you face present suffering. It's not the end of the story.</span></p>`
  },

  // Philippians 4:6-7 - Anxiety
  {
    book: 'PHP',
    startChapter: 4,
    endChapter: 4,
    startVerse: 6,
    endVerse: 7,
    title: 'The Antidote to Anxiety',
    topicPath: ['Practical', 'Prayer'],
    content: `<p>Paul gives practical instruction for dealing with worry.</p>
<p><span data-inline-tag="keypoint">The command is clear: "Do not be anxious about anything." Not some things - ANYTHING.</span></p>
<p><span data-inline-tag="keypoint">The remedy: prayer + petition + thanksgiving. All three are necessary.</span></p>
<p><span data-inline-tag="illustration">Anxiety is like a rocking chair - it gives you something to do but gets you nowhere. Prayer actually moves things.</span></p>
<p><span data-inline-tag="application">Next time anxiety hits: Stop. Pray specifically. Thank God for past faithfulness. Experience His peace.</span></p>
<p><span data-inline-tag="quote">"The peace of God, which transcends all understanding, will guard your hearts and minds."</span></p>`
  },

  // Psalm 23 - The Shepherd
  {
    book: 'PSA',
    startChapter: 23,
    endChapter: 23,
    startVerse: 1,
    endVerse: 6,
    title: 'The Lord is My Shepherd',
    topicPath: ['Biblical Themes', 'Faith'],
    content: `<p>David's beloved psalm of trust and comfort.</p>
<p><span data-inline-tag="keypoint">"I shall not want" - the sheep lacks nothing because the Shepherd provides everything.</span></p>
<p><span data-inline-tag="illustration">Ancient shepherds would literally lie across the entrance of the sheep pen at night, becoming the door. Jesus is our door.</span></p>
<p><span data-inline-tag="keypoint">"Even though I walk through the valley" - notice it's THROUGH, not stuck in. Valleys are for passing through.</span></p>
<p><span data-inline-tag="application">Which phrase speaks most to your current situation? Meditate on that aspect of God's care.</span></p>
<p><span data-inline-tag="crossref">Jesus calls Himself the "Good Shepherd" in John 10:11.</span></p>`
  }
];

// ============== Helper Functions ==============

function clearData() {
  console.log('Clearing existing data...');
  db.exec('DELETE FROM inline_tags');
  db.exec('DELETE FROM note_tags');
  db.exec('DELETE FROM notes');
  db.exec('DELETE FROM topics');
  console.log('Data cleared.');
}

function createTopics() {
  console.log('Creating topics...');
  const now = new Date().toISOString();
  const topicMap = {};

  const insertTopic = db.prepare(`
    INSERT INTO topics (id, name, parent_id, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  let sortOrder = 0;

  for (const parent of topicsData) {
    const parentId = uuidv4();
    insertTopic.run(parentId, parent.name, null, sortOrder++, now, now);
    topicMap[parent.name] = parentId;

    if (parent.children) {
      let childOrder = 0;
      for (const child of parent.children) {
        const childId = uuidv4();
        insertTopic.run(childId, child.name, parentId, childOrder++, now, now);
        topicMap[child.name] = childId;
      }
    }
  }

  console.log(`Created ${Object.keys(topicMap).length} topics.`);
  return topicMap;
}

function getTopicId(topicMap, path) {
  // Path is like ['Systematic Theology', 'Soteriology (Salvation)']
  // Return the ID of the last (most specific) topic
  const topicName = path[path.length - 1];
  return topicMap[topicName] || null;
}

function createNotes(topicMap) {
  console.log('Creating notes with inline tags...');
  const now = new Date().toISOString();

  const insertNote = db.prepare(`
    INSERT INTO notes (id, book, start_chapter, end_chapter, start_verse, end_verse, title, content, type, primary_topic_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'note', ?, ?, ?)
  `);

  const insertInlineTag = db.prepare(`
    INSERT INTO inline_tags (id, note_id, tag_type, text_content, html_fragment, position_start, position_end, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let noteCount = 0;
  let tagCount = 0;

  for (const note of notesData) {
    const noteId = uuidv4();
    const topicId = getTopicId(topicMap, note.topicPath);

    insertNote.run(
      noteId,
      note.book,
      note.startChapter,
      note.endChapter,
      note.startVerse || null,
      note.endVerse || null,
      note.title,
      note.content,
      topicId,
      now,
      now
    );
    noteCount++;

    // Extract and insert inline tags
    const tagRegex = /<span data-inline-tag="([^"]+)">([^<]+)<\/span>/g;
    let match;
    let position = 0;

    while ((match = tagRegex.exec(note.content)) !== null) {
      const tagType = match[1];
      const textContent = match[2];
      const htmlFragment = match[0];

      insertInlineTag.run(
        uuidv4(),
        noteId,
        tagType,
        textContent,
        htmlFragment,
        position,
        position + textContent.length,
        now
      );
      tagCount++;
      position += textContent.length + 1;
    }
  }

  console.log(`Created ${noteCount} notes with ${tagCount} inline tags.`);
}

// ============== Main ==============

function main() {
  console.log('=== SACRED Test Data Seeder ===\n');

  if (shouldClear) {
    clearData();
  }

  // Check if topics already exist
  const existingTopics = db.prepare('SELECT COUNT(*) as count FROM topics').get().count;
  let topicMap;

  if (existingTopics > 0 && !shouldClear) {
    console.log(`Found ${existingTopics} existing topics. Loading...`);
    const topics = db.prepare('SELECT id, name FROM topics').all();
    topicMap = {};
    for (const t of topics) {
      topicMap[t.name] = t.id;
    }
  } else {
    topicMap = createTopics();
  }

  // Check if notes already exist
  const existingNotes = db.prepare('SELECT COUNT(*) as count FROM notes').get().count;

  if (existingNotes > 0 && !shouldClear) {
    console.log(`Found ${existingNotes} existing notes. Skipping note creation.`);
    console.log('Use --clear flag to reset all data.');
  } else {
    createNotes(topicMap);
  }

  // Print summary
  console.log('\n=== Summary ===');
  const topicCount = db.prepare('SELECT COUNT(*) as count FROM topics').get().count;
  const noteCount = db.prepare('SELECT COUNT(*) as count FROM notes').get().count;
  const tagCount = db.prepare('SELECT COUNT(*) as count FROM inline_tags').get().count;

  console.log(`Topics: ${topicCount}`);
  console.log(`Notes: ${noteCount}`);
  console.log(`Inline Tags: ${tagCount}`);

  // Print tag breakdown
  const tagBreakdown = db.prepare(`
    SELECT itt.name, itt.icon, COUNT(it.id) as count
    FROM inline_tag_types itt
    LEFT JOIN inline_tags it ON itt.id = it.tag_type
    GROUP BY itt.id
    ORDER BY itt.sort_order
  `).all();

  console.log('\nInline Tags by Type:');
  for (const t of tagBreakdown) {
    console.log(`  ${t.icon || '•'} ${t.name}: ${t.count}`);
  }

  console.log('\nDone!');
}

main();
