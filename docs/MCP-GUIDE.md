# SACRED MCP Guide: Using Claude with Your Bible Study App

This guide provides a comprehensive tutorial on using Claude (via MCP - Model Context Protocol) to enhance your Bible study, sermon preparation, and theological research in SACRED.

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Core Concepts](#core-concepts)
4. [Tool Reference](#tool-reference)
5. [Common Workflows](#common-workflows)
6. [Advanced Usage](#advanced-usage)
7. [Tips & Best Practices](#tips--best-practices)

---

## Overview

SACRED's MCP server gives Claude direct access to your Bible study notes, topics, systematic theology content, and inline tags. This enables powerful AI-assisted workflows:

- **Sermon Preparation**: Gather all relevant notes, doctrines, illustrations, and applications for a passage
- **Doctrine Study**: Explore systematic theology with scripture connections and cross-references
- **Note Organization**: Auto-categorize notes with topics and doctrine links
- **Research**: Search across your entire library of notes and theological content

### What Claude Can Do

| Capability | Description |
|------------|-------------|
| Read notes | Access all your Bible study notes, search by passage, topic, or keyword |
| Create/edit notes | Write new notes or update existing ones with topic assignments |
| Browse topics | Navigate your topic taxonomy, see note counts, find related topics |
| Access systematic theology | Search doctrines, get chapter summaries, find scripture connections |
| Extract tagged content | Pull all illustrations, applications, key points from your notes |
| Auto-enrich content | Suggest topics and doctrine links based on Bible passages |

---

## Getting Started

### Prerequisites

1. SACRED app running with the backend server active
2. Claude Code or another MCP-compatible Claude client
3. MCP server configured to connect to SACRED

### Configuring the MCP Server

Add the SACRED MCP server to your Claude configuration:

```json
{
  "mcpServers": {
    "sacred-bible-notes": {
      "command": "node",
      "args": ["/path/to/Sacred/mcp/dist/index.js"],
      "env": {
        "DB_PATH": "/path/to/sacred.db"
      }
    }
  }
}
```

### Verifying the Connection

Ask Claude to check the connection:

```
Can you list my Bible study notes?
```

Claude should respond with notes from your SACRED database.

---

## Core Concepts

### Notes

Notes are the primary content in SACRED, attached to Bible verse ranges:

```
{
  "id": "uuid",
  "book": "ROM",           // 3-letter book code
  "startChapter": 3,
  "startVerse": 21,
  "endChapter": 3,
  "endVerse": 26,
  "title": "Justification by Faith",
  "content": "<p>HTML content...</p>",
  "type": "sermon",        // note, commentary, or sermon
  "primaryTopicId": "uuid" // optional topic
}
```

### Topics

Topics form a hierarchical taxonomy for organizing notes:

```
Doctrinal/
├── God/
│   ├── Trinity
│   ├── Attributes of God
│   └── Providence
├── Salvation/
│   ├── Justification
│   ├── Sanctification
│   └── Perseverance
└── ...
Pastoral/
├── Spiritual Life/
├── Relationships/
└── ...
```

### Inline Tags

Inline tags mark specific content within notes:

| Tag Type | Purpose | Icon |
|----------|---------|------|
| `illustration` | Stories, examples, analogies | 💡 |
| `application` | Practical life applications | ✅ |
| `keypoint` | Main ideas, important concepts | ⭐ |
| `quote` | Citations, references | 💬 |
| `crossref` | Cross-references to other passages | 🔗 |

### Systematic Theology Links

Notes can link to systematic theology chapters using the syntax:

```
[[ST:Ch32]]       → Links to Chapter 32
[[ST:Ch32:A]]     → Links to Section A of Chapter 32
[[ST:Ch32:A.1]]   → Links to Subsection A.1 of Chapter 32
```

### Bible Book Codes

Use 3-letter codes for Bible books:

| Old Testament | | New Testament | |
|---------------|---|---------------|---|
| GEN, EXO, LEV, NUM, DEU | Genesis-Deuteronomy | MAT, MRK, LUK, JHN | Gospels |
| JOS, JDG, RUT, 1SA, 2SA | Joshua-2 Samuel | ACT | Acts |
| 1KI, 2KI, 1CH, 2CH | Kings & Chronicles | ROM, 1CO, 2CO, GAL, EPH | Paul's Letters |
| EZR, NEH, EST | Ezra-Esther | PHP, COL, 1TH, 2TH | More Paul |
| JOB, PSA, PRO, ECC, SNG | Wisdom Literature | 1TI, 2TI, TIT, PHM | Pastoral Letters |
| ISA, JER, LAM, EZK, DAN | Major Prophets | HEB, JAS, 1PE, 2PE | General Letters |
| HOS-MAL | Minor Prophets | 1JN, 2JN, 3JN, JUD, REV | John & Revelation |

---

## Tool Reference

### Notes Tools

#### Reading Notes

| Tool | Purpose | Example |
|------|---------|---------|
| `list_notes` | Get all notes with pagination | "Show me my recent notes" |
| `get_note` | Get single note by ID | "Get note abc-123" |
| `get_note_metadata` | Get note without content (token-efficient) | "Check if note exists" |
| `list_notes_metadata` | List notes without content (token-efficient) | "List sermon titles in Romans" |
| `get_chapter_notes` | Get notes for a Bible chapter | "Show notes for Romans 3" |
| `search_notes` | Full-text search | "Search notes for 'justification'" |
| `get_notes_summary` | Statistics about notes | "How many notes do I have?" |
| `get_books_with_notes` | Books with note counts | "Which books have notes?" |

**Token-efficient pattern:** Use `list_notes_metadata` to browse notes without fetching full HTML content, then use `get_note` only when you need the actual content.

#### Creating & Editing Notes

| Tool | Purpose | Example |
|------|---------|---------|
| `create_note` | Create new note | "Create a note on John 3:16" |
| `update_note` | Update existing note | "Update note title to X" |
| `delete_note` | Delete a note | "Delete note abc-123" |
| `set_note_topics` | Assign topics to note | "Set primary topic to Justification" |

**Creating a note with topics:**

```
Create a sermon note on Romans 8:28-30 with:
- Title: "The Golden Chain of Redemption"
- Primary topic: Salvation
- Tags: Election, Perseverance
```

### Topics Tools

| Tool | Purpose | Example |
|------|---------|---------|
| `list_topics` | Get topic tree or flat list | "Show topic hierarchy" |
| `get_topic` | Get single topic with children | "Get details for Salvation topic" |
| `get_topic_notes` | Get notes under a topic | "Show all notes about Prayer" |
| `create_topic` | Create new topic | "Create topic 'Covenant' under Doctrinal" |
| `update_topic` | Update topic | "Move topic X under topic Y" |
| `delete_topic` | Delete topic | "Delete topic abc-123" |
| `seed_topics` | Seed default taxonomy | "Initialize default topics" |
| `find_topic_by_name` | Search topics by name | "Find topics matching 'grace'" |

### Inline Tags Tools

| Tool | Purpose | Example |
|------|---------|---------|
| `list_inline_tag_types` | Get tag type definitions | "Show tag types" |
| `list_inline_tags` | Get tags with filters | "Show all illustrations" |
| `get_inline_tags_by_type` | Counts by type | "How many of each tag type?" |
| `search_inline_tags` | Search tagged content | "Search illustrations for 'shepherd'" |
| `create_inline_tag_type` | Create custom type | "Create 'Warning' tag type" |
| `seed_inline_tag_types` | Reset default types | "Restore default tag types" |

### Systematic Theology Tools

#### Searching & Reading

| Tool | Purpose | Example |
|------|---------|---------|
| `search_systematic_theology` | Full-text search | "Search theology for 'imputation'" |
| `get_systematic_section` | Get by ID or reference | "Get chapter 32" or "Get Ch32:A" |
| `get_systematic_chapter` | Full chapter with sections | "Get complete chapter 25" |
| `find_doctrines_for_passage` | Doctrines citing a verse | "What doctrines cite Romans 3:21?" |
| `list_systematic_tags` | Category tags | "Show doctrine categories" |
| `get_chapters_by_tag` | Chapters by category | "Show Christology chapters" |

#### For Sermon Prep

| Tool | Purpose | Example |
|------|---------|---------|
| `summarize_doctrine_for_sermon` | Sermon-ready summary | "Summarize justification for sermon" |
| `explain_doctrine_simply` | Jargon-free explanation | "Explain sanctification simply" |
| `extract_doctrines_from_note` | Suggest doctrines for note | "What doctrines relate to this note?" |

#### Annotations

| Tool | Purpose | Example |
|------|---------|---------|
| `add_systematic_annotation` | Add highlight/note | "Highlight this text in yellow" |
| `get_systematic_annotations` | Get annotations | "Show my annotations for chapter 32" |
| `delete_systematic_annotation` | Remove annotation | "Delete annotation xyz" |
| `get_referencing_notes` | Notes linking to doctrine | "Which notes link to chapter 32?" |

### Backup Tools

| Tool | Purpose | Example |
|------|---------|---------|
| `full_export` | Export all data as JSON | "Export my SACRED backup" |
| `full_import` | Import backup (upsert) | "Import this backup data" |
| `delete_all_notes` | Clear all notes (requires confirm) | "Delete all notes (confirm=true)" |
| `get_last_modified` | Last modification time | "When was my last edit?" |

### Study Session Tools

SACRED tracks what you study (Bible chapters, doctrines, notes) to help Claude understand your study patterns and make relevant suggestions.

| Tool | Purpose | Example |
|------|---------|---------|
| `get_recent_sessions` | Get recent study sessions | "What have I been studying lately?" |
| `get_study_summary` | Aggregated statistics | "Show my study summary for the last 30 days" |
| `find_related_sessions` | Sessions for a book/doctrine | "When have I studied Romans?" |
| `get_last_studied` | When a reference was last viewed | "When did I last study John 3?" |

**Session types tracked:**
- `bible` - Bible chapters viewed (reference: "ROM:3")
- `doctrine` - Systematic theology viewed (reference: "ch32")
- `note` - Notes opened for editing

### Sermon Preparation Tools

Specialized tools for sermon writing and research:

| Tool | Purpose | Example |
|------|---------|---------|
| `generate_sermon_structure` | Generate outline scaffold | "Create sermon structure for John 3:16-21" |
| `get_similar_sermons` | Find past sermons | "Find sermons similar to Romans 8" |
| `compile_illustrations_for_topic` | Gather illustrations | "Find illustrations about grace" |
| `sermon_prep_bundle` | All resources for a passage | "Get sermon prep bundle for Ephesians 2:1-10" |
| `check_illustration_duplicates` | Check if illustration was used before | "Have I used this illustration?" |
| `get_duplicate_illustrations` | Find all duplicated illustrations | "Which illustrations have I reused?" |

**`generate_sermon_structure` parameters:**
- `book` - 3-letter Bible book code (required)
- `startChapter` - Starting chapter (required)
- `startVerse` - Starting verse (optional)
- `endChapter` - Ending chapter (optional, defaults to startChapter)
- `endVerse` - Ending verse (optional)
- `sermonTitle` - Custom title (optional)
- `mainTheme` - Central thesis (optional)

**`get_similar_sermons` filters:**
- `book` - Bible book to search in
- `chapter` - Find sermons near this chapter (±3 chapters)
- `topic` - Search by topic tag name
- `keyword` - Full-text search in content/title
- `limit` - Max results (default: 20)

**`compile_illustrations_for_topic` filters:**
- `topic` - Keyword to search in illustration text
- `doctrineChapter` - Find illustrations from passages citing this doctrine
- `limit` - Max results (default: 30)

### Sermon Series Tools

Organize sermons into named series:

| Tool | Purpose | Example |
|------|---------|---------|
| `list_series` | List all series with sermon counts | "What sermon series do I have?" |
| `get_series` | Get series with its sermons | "Show the Romans series" |
| `create_series` | Create new series | "Create a series called 'Life of David'" |
| `add_sermon_to_series` | Link sermon to series | "Add this sermon to the Romans series" |
| `remove_sermon_from_series` | Unlink sermon from series | "Remove sermon from series" |

**Creating and populating a series:**
```
1. create_series(name="Romans: Life in the Spirit", description="Series through Romans 5-8")
2. add_sermon_to_series(seriesId="<returned-id>", noteId="<sermon-note-id>")
3. list_series() to verify
```

### AI-Enhanced Composite Tools

These tools combine multiple operations for common workflows:

| Tool | Purpose | Example |
|------|---------|---------|
| `parse_verse_reference` | Parse "Romans 3:21-26" to structured format | "Parse 'John 3:16'" |
| `sermon_prep_bundle` | All data for sermon prep | "Prepare sermon bundle for Romans 8" |
| `doctrine_study_bundle` | All data for doctrine study | "Get study bundle for chapter 32" |
| `suggest_topics_for_passage` | Suggest topics for passage | "What topics fit Romans 5?" |
| `extract_illustrations` | Get all illustrations | "Show all illustrations in Romans" |
| `extract_applications` | Get all applications | "Show applications for John" |
| `find_related_notes` | Find similar notes | "Find notes related to this one" |
| `summarize_topic_notes` | Summary of topic's notes | "Summarize my Prayer notes" |
| `create_enriched_note` | Create with suggestions | "Create enriched note on John 1:1" |
| `auto_tag_note` | Auto-assign topics | "Auto-tag this note" |
| `insert_doctrine_links` | Add doctrine links | "Insert doctrine links in note" |

---

## Common Workflows

### Workflow 1: Sermon Preparation (Complete Guide)

**Scenario:** Preparing a sermon on Romans 8:28-30

The sermon preparation workflow uses multiple tools to gather resources, check for repetition, find illustrations, and generate an outline scaffold.

#### Step 1: Generate a Sermon Structure

Start by generating an outline scaffold with all available resources:

```
Generate a sermon structure for Romans 8:28-30 with:
- Title: "The Golden Chain of Redemption"
- Main theme: "God's sovereign plan guarantees our salvation from start to finish"
```

**What you get back:**
- **Metadata**: Passage reference, title, theme, date
- **Outline scaffold**: Introduction (hook, context, thesis, preview), main points with illustration/application slots, conclusion
- **Resources**: Your existing notes on this passage, related doctrine chapters, key points from your notes, similar past sermons
- **Next steps**: Instructions for completing the sermon

#### Step 2: Check What You've Preached Before

Avoid repetition by searching your sermon history:

```
Find similar sermons to Romans 8 - show me anything I've preached on election or perseverance
```

Or more specifically:
```
Get similar sermons for:
- Book: ROM
- Topic: election
- Keyword: predestination
```

**Match types returned:**
- `same_book` - Sermons from the same Bible book
- `topic_match` - Sermons with matching topic tags
- `title_match` - Sermons with the keyword in the title
- `content_match` - Sermons containing the keyword in content

#### Step 3: Find Illustrations

Gather illustrations for your sermon points:

```
Compile illustrations for the topic "perseverance"
```

Or find illustrations related to a specific doctrine:
```
Compile illustrations for doctrine chapter 40 (Perseverance of the Saints)
```

**Results include:**
- Illustration text from your notes
- Source passage reference
- How the match was found (keyword_match, doctrine reference, etc.)

#### Step 4: Get the Full Prep Bundle

Now gather all contextual data:

```
Get a sermon prep bundle for Romans 8:28-30
```

This returns:
- All existing notes on this passage
- Related systematic theology doctrines with summaries
- Illustrations from nearby passages
- Applications you've written
- Key points you've marked

#### Step 5: Deep Dive into Relevant Doctrines

Explore the theology behind your passage:

```
Show me the doctrine study bundle for chapter 32 (Election and Reprobation)
```

This provides:
- Full chapter content with sections
- All scripture references (primary and secondary)
- Related chapters (e.g., Providence, Predestination)
- Your annotations/highlights
- Notes that link to this chapter

#### Step 6: Create Your Sermon Note

Save your completed sermon:

```
Create a sermon note on Romans 8:28-30 titled "The Golden Chain of Redemption" with:
- Type: sermon
- Primary topic: Salvation/Perseverance
- Content: [your sermon outline in HTML]
```

#### Step 7: Add Doctrine Links

Connect your sermon to systematic theology:

```
Insert doctrine links into my new sermon note
```

This adds links like `[[ST:Ch32]]` (Election), `[[ST:Ch40]]` (Perseverance) to the end of your note.

---

#### Sermon Prep Tools Summary

| Tool | What It Does | When to Use |
|------|--------------|-------------|
| `generate_sermon_structure` | Creates outline scaffold with resources | First - start your sermon |
| `get_similar_sermons` | Finds past sermons by book/topic/keyword | Check what you've preached |
| `compile_illustrations_for_topic` | Gathers illustrations by keyword/doctrine | Find stories and examples |
| `sermon_prep_bundle` | All notes, doctrines, illustrations for a passage | Get full context |
| `doctrine_study_bundle` | Deep dive into a doctrine chapter | Understand the theology |
| `create_note` (type: sermon) | Save your sermon | Store completed work |
| `insert_doctrine_links` | Add theology connections | Link to systematic theology |

---

### Workflow 2: Topical Study

**Scenario:** Studying everything you have on "Prayer"

**Step 1: Find the topic**
```
Find topics matching "prayer"
```

**Step 2: Get notes under this topic**
```
Show all notes under the Prayer topic
```

**Step 3: Get a summary**
```
Summarize my Prayer topic notes
```

**Step 4: Find related doctrines**
```
Search systematic theology for "prayer"
```

---

### Workflow 3: Finding Illustrations

**Scenario:** Need an illustration for a sermon on faith

**Step 1: Search illustrations**
```
Search illustrations for "faith"
```

**Step 2: Or get all illustrations from a book**
```
Extract all illustrations from Hebrews
```

**Step 3: Browse by tag type**
```
Show inline tag counts by type
```

---

### Workflow 4: Organizing Notes

**Scenario:** You have untagged notes that need organization

**Step 1: Find unorganized notes**
```
List notes without a primary topic
```

**Step 2: Auto-tag a note**
```
Auto-tag note abc-123 and apply the primary topic
```

**Step 3: Manually set topics**
```
Set the primary topic of note abc-123 to "Justification" and add secondary tags "Grace", "Faith"
```

---

### Workflow 5: Doctrine Research

**Scenario:** Understanding what the systematic theology says about a topic

**Step 1: Search for the doctrine**
```
Search systematic theology for "atonement"
```

**Step 2: Get the full chapter**
```
Get doctrine study bundle for chapter 27 (The Atonement)
```

**Step 3: Find related notes**
```
Which of my notes link to chapter 27?
```

**Step 4: Find Scripture passages**
```
What Bible passages does chapter 27 cite?
```

---

### Workflow 6: Creating a Study Series

**Scenario:** Planning a sermon series through Ephesians

**Step 1: See existing notes**
```
Get notes for Ephesians, organized by chapter
```

**Step 2: Find doctrines relevant to Ephesians**
```
What systematic theology doctrines reference Ephesians 1?
```

**Step 3: Create series notes with topics**
```
Create a sermon series note for Ephesians 1:1-14 titled "Spiritual Blessings" with:
- Type: sermon
- Primary topic: Salvation/Election
- Content: [your outline]
```

---

### Workflow 7: Understanding Your Study Patterns

**Scenario:** You want to see what you've been studying and identify gaps

**Step 1: Get your recent study sessions**
```
What have I been studying in the last 7 days?
```

Returns a list of sessions with:
- Session type (bible, doctrine, note)
- Reference (e.g., "ROM:3", "ch32", note UUID)
- Reference label (e.g., "Romans 3", "Election", note title)
- Timestamp

**Step 2: Get aggregated statistics**
```
Show my study summary for the last 30 days
```

Returns:
- Total sessions by type (bible, doctrine, note)
- Unique references by type (how many different chapters/doctrines/notes)
- Top 10 most studied Bible chapters
- Top 10 most viewed doctrines
- Top 10 most accessed notes
- Daily activity (sessions per day)

**Step 3: Check when you last studied something**
```
When did I last study Romans 8?
```

Returns:
- Last session timestamp
- Total times you've studied this reference

**Step 4: Find related sessions**
```
Find all my study sessions related to Romans
```

Or for doctrine:
```
Find study sessions related to doctrine chapter 32 (Election)
```

---

### Workflow 8: Backup and Restore

**Step 1: Export your data**
```
Export my full SACRED backup
```

Save the JSON output to a file.

**Step 2: Check last modified**
```
When was my database last modified?
```

**Step 3: Import data (from another backup)**
```
Import this backup data: [paste JSON]
```

---

## Advanced Usage

### Combining Tools for Complex Queries

**Example: "Show me all my applications about grace from Paul's letters"**

```
Search applications for "grace" filtered to ROM, 1CO, 2CO, GAL, EPH, PHP, COL
```

**Example: "Find notes that discuss both justification and sanctification"**

```
1. Get notes under the Justification topic
2. Get notes under the Sanctification topic
3. Find the intersection
```

### Using Verse Reference Parsing

For natural language references:

```
Parse "First Corinthians 13:4-7"
→ { book: "1CO", startChapter: 13, startVerse: 4, endChapter: 13, endVerse: 7 }
```

This is useful when working with user-provided references.

### Creating Enriched Notes

When creating notes, use `create_enriched_note` to get automatic suggestions:

```
Create an enriched note on Philippians 2:5-11
```

Returns the note plus:
- Suggested topics based on passage
- Relevant doctrine chapters to link
- Instructions for applying suggestions

### Batch Operations

For processing multiple notes:

```
1. List all notes in Romans
2. For each note without a primary topic:
   - Run auto_tag_note with applyPrimary=true
```

---

## Tips & Best Practices

### 1. Use Specific Book Codes

Always use 3-letter codes (ROM, JHN, 1CO) rather than full names for reliable results.

### 2. Leverage the Topic Hierarchy

Organize notes under specific sub-topics rather than broad categories:
- ✅ Salvation/Justification
- ❌ Just "Doctrinal"

### 3. Tag Your Content

Mark illustrations, applications, and key points as you write. This makes them searchable later.

### 4. Link to Systematic Theology

Use `[[ST:ChX]]` links in your notes to connect to doctrinal content. Claude can auto-insert these with `insert_doctrine_links`.

### 5. Use Sermon Prep Bundles

Before writing a sermon, always pull the `sermon_prep_bundle` - it gathers everything relevant in one request.

### 6. Regular Backups

Run `full_export` periodically to backup your data. The JSON can be reimported anytime.

### 7. Let Claude Suggest Topics

When unsure how to categorize a note, use `suggest_topics_for_passage` or `auto_tag_note` for AI-powered suggestions.

### 8. Explore Related Content

After creating a note, use `find_related_notes` to discover connections you might have missed.

---

## Quick Reference Card

### Most Common Commands

| Task | Ask Claude |
|------|------------|
| Find notes | "Show notes for Romans 3" |
| Search notes | "Search notes for 'grace'" |
| Create note | "Create a note on John 3:16 titled X" |
| Set topic | "Set primary topic of note X to Justification" |
| Find illustrations | "Search illustrations for 'shepherd'" |
| Find applications | "Show applications in Hebrews" |
| **Start a sermon** | "Generate sermon structure for Romans 8:28-30" |
| **Find past sermons** | "Find sermons similar to Romans 8" |
| **Gather illustrations** | "Compile illustrations about grace" |
| Sermon prep bundle | "Get sermon prep bundle for Romans 8:28-30" |
| Doctrine search | "Search theology for 'atonement'" |
| Doctrine details | "Get doctrine study bundle for chapter 32" |
| **Study history** | "What have I been studying lately?" |
| **Study stats** | "Show my study summary for the last 30 days" |
| Export backup | "Export my SACRED backup" |
| Auto-organize | "Auto-tag note X and apply suggestions" |

### Tool Count Summary

| Category | Tools |
|----------|-------|
| Notes (read) | 6 |
| Notes (write) | 4 |
| Topics | 8 |
| Inline Tags | 8 |
| Systematic Theology | 15 |
| Backup | 4 |
| Study Sessions | 4 |
| Sermon Preparation | 4 |
| AI-Enhanced | 11 |
| **Total** | **63** |

---

## Troubleshooting

### "Note not found" errors
- Verify the note ID is correct
- Use `list_notes` to find valid IDs

### "Topic not found" errors
- Run `list_topics` to see available topics
- Topics may need to be seeded: `seed_topics`

### Empty search results
- Try broader search terms
- Check book codes are correct (use 3-letter codes)
- Verify the data exists with `get_notes_summary`

### Systematic theology not working
- The systematic theology data must be imported separately
- Check `get_systematic_summary` for current data status

---

## Appendix: Complete Tool List

### Notes Query Tools
- `list_notes`
- `get_note`
- `get_chapter_notes`
- `get_notes_summary`
- `search_notes`
- `get_books_with_notes`

### Notes CRUD Tools
- `create_note`
- `update_note`
- `delete_note`
- `set_note_topics`

### Notes Bulk Tools
- `export_notes`
- `import_notes`

### Topics Tools
- `list_topics`
- `get_topic`
- `get_topic_notes`
- `create_topic`
- `update_topic`
- `delete_topic`
- `seed_topics`
- `find_topic_by_name`

### Inline Tags Tools
- `list_inline_tag_types`
- `create_inline_tag_type`
- `update_inline_tag_type`
- `delete_inline_tag_type`
- `list_inline_tags`
- `get_inline_tags_by_type`
- `search_inline_tags`
- `seed_inline_tag_types`

### Systematic Theology Tools
- `search_systematic_theology`
- `get_systematic_section`
- `get_systematic_chapter`
- `find_doctrines_for_passage`
- `summarize_doctrine_for_sermon`
- `extract_doctrines_from_note`
- `explain_doctrine_simply`
- `get_systematic_summary`
- `list_systematic_tags`
- `get_chapters_by_tag`
- `add_systematic_annotation`
- `get_systematic_annotations`
- `delete_systematic_annotation`
- `get_referencing_notes`
- `export_systematic_theology`

### Backup Tools
- `full_export`
- `full_import`
- `delete_all_notes`
- `get_last_modified`

### Study Session Tools
- `get_recent_sessions`
- `get_study_summary`
- `find_related_sessions`
- `get_last_studied`

### Sermon Preparation Tools
- `generate_sermon_structure`
- `get_similar_sermons`
- `compile_illustrations_for_topic`
- `sermon_prep_bundle`

### AI-Enhanced Tools
- `parse_verse_reference`
- `doctrine_study_bundle`
- `suggest_topics_for_passage`
- `extract_illustrations`
- `extract_applications`
- `find_related_notes`
- `summarize_topic_notes`
- `create_enriched_note`
- `auto_tag_note`
- `insert_doctrine_links`

---

*This guide is for SACRED MCP Server v1.1.0 (63 tools)*
