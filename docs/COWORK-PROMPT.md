# SACRED MCP Tools - Complete Reference for Claude

Paste this at the start of your Cowork session to give Claude full knowledge of your SACRED Bible study tools.

---

## SACRED MCP Tools Reference

You have access to my SACRED Bible study app via MCP. This app stores my Bible notes, topics/taxonomy, systematic theology (57 chapters), and inline tags. Always use these tools for Bible study requests.

### Notes Tools

| Tool | Parameters | Purpose |
|------|------------|---------|
| `list_notes` | `limit?`, `offset?` | Get all notes (paginated) |
| `get_note` | `id` | Get single note by UUID |
| `get_chapter_notes` | `book`, `chapter` | Get notes overlapping a Bible chapter |
| `get_notes_summary` | - | Statistics: counts by book, type, recent notes |
| `search_notes` | `query`, `limit?` | Full-text search across title and content |
| `get_books_with_notes` | - | List books that have notes with counts |
| `export_notes` | - | Export all notes as JSON |
| `create_note` | `book`, `startChapter`, `endChapter`, `startVerse?`, `endVerse?`, `title?`, `content?`, `type?`, `primaryTopicId?`, `tags?` | Create new note |
| `update_note` | `id`, + any create fields | Update existing note |
| `delete_note` | `id` | Delete note by ID |
| `import_notes` | `notes[]` | Bulk import (upsert) |

**Note types:** `"note"`, `"commentary"`, `"sermon"`

**Example - Get notes on Romans 8:**
```
get_chapter_notes(book: "ROM", chapter: 8)
```

**Example - Create a sermon note:**
```
create_note(
  book: "JHN",
  startChapter: 3,
  endChapter: 3,
  startVerse: 16,
  endVerse: 21,
  title: "God's Love for the World",
  content: "<p>Sermon content here...</p>",
  type: "sermon"
)
```

### Topics Tools

Topics form a hierarchical taxonomy (Doctrinal, Pastoral, Biblical Studies, etc.)

| Tool | Parameters | Purpose |
|------|------------|---------|
| `list_topics` | `flat?` | Get topic tree (or flat list if flat=true) |
| `get_topic` | `id` | Get topic with children and note count |
| `get_topic_notes` | `id`, `includeDescendants?` | Get notes under a topic |
| `create_topic` | `name`, `parentId?`, `sortOrder?` | Create new topic |
| `update_topic` | `id`, `name?`, `parentId?`, `sortOrder?` | Update topic |
| `delete_topic` | `id` | Delete topic (must have no children/notes) |
| `find_topic_by_name` | `name` | Fuzzy search topics by name |
| `seed_topics` | - | Initialize default topic taxonomy |
| `set_note_topics` | `noteId`, `primaryTopicId?`, `addTags?`, `removeTags?` | Assign topics to a note |

**Example - Find and assign a topic:**
```
find_topic_by_name(name: "justification")
set_note_topics(noteId: "abc-123", primaryTopicId: "topic-uuid")
```

### Inline Tags Tools

Inline tags mark content within notes: illustrations, applications, key points, quotes, cross-references.

| Tool | Parameters | Purpose |
|------|------------|---------|
| `list_inline_tag_types` | - | Get tag type definitions (illustration, application, etc.) |
| `list_inline_tags` | `type?`, `book?`, `limit?` | Get tagged content with filters |
| `get_inline_tags_by_type` | - | Counts of each tag type |
| `search_inline_tags` | `query`, `type?`, `limit?` | Search within tagged content |
| `create_inline_tag_type` | `name`, `color`, `icon?` | Create custom tag type |
| `update_inline_tag_type` | `id`, `name?`, `color?`, `icon?` | Update tag type |
| `delete_inline_tag_type` | `id` | Delete tag type (not defaults) |
| `seed_inline_tag_types` | - | Reset to default tag types |

**Default tag types:**
- `illustration` - Stories, examples, analogies
- `application` - Practical life applications
- `keypoint` - Main ideas, important concepts
- `quote` - Citations, references
- `crossref` - Cross-references to other passages

**Example - Find all illustrations about faith:**
```
search_inline_tags(query: "faith", type: "illustration")
```

### Systematic Theology Tools

57 chapters of systematic theology with 4800+ scripture references.

| Tool | Parameters | Purpose |
|------|------------|---------|
| `get_systematic_summary` | - | Statistics: 776 entries, 57 chapters, counts |
| `search_systematic_theology` | `query`, `limit?` | Full-text search with snippets |
| `get_systematic_section` | `reference` | Get by "Ch32", "Ch32:A", or "Ch32:A.1" |
| `get_systematic_chapter` | `chapterNumber` | Full chapter with all sections |
| `find_doctrines_for_passage` | `book`, `chapter`, `verse?` | Doctrines that cite a Bible passage |
| `list_systematic_tags` | - | Category tags (7 Grudem parts) |
| `get_chapters_by_tag` | `tagId` | Chapters filtered by category |
| `summarize_doctrine_for_sermon` | `chapterNumber` | Sermon-ready summary with key points |
| `explain_doctrine_simply` | `chapterNumber` | Jargon-free explanation |
| `extract_doctrines_from_note` | `noteId` | Suggest doctrines based on note's scriptures |
| `add_systematic_annotation` | `systematicId`, `type`, `content`, `color?` | Add highlight or note |
| `get_systematic_annotations` | `systematicId` | Get annotations for an entry |
| `delete_systematic_annotation` | `id` | Delete annotation |
| `get_referencing_notes` | `systematicId` | Notes that link to this doctrine |
| `export_systematic_theology` | - | Export all systematic data |

**Key chapters:**
- Ch2: Word of God | Ch3: Canon | Ch5: Inerrancy
- Ch9: Existence of God | Ch11-13: Attributes | Ch14: Trinity
- Ch15: Creation | Ch16: Providence | Ch20: Satan/Demons
- Ch21: Creation of Man | Ch24: Sin | Ch25: Covenants
- Ch26: Person of Christ | Ch27: Atonement | Ch28: Resurrection
- Ch32: Election | Ch33: Calling | Ch34: Regeneration
- Ch35: Conversion | Ch36: Justification | Ch37: Adoption
- Ch38: Sanctification | Ch40: Perseverance | Ch43: Union with Christ
- Ch44-47: Church | Ch49: Baptism | Ch50: Lord's Supper
- Ch52-53: Spiritual Gifts | Ch54-57: End Times

**Example - Research justification:**
```
search_systematic_theology(query: "justification")
get_systematic_section(reference: "Ch36")
get_systematic_section(reference: "Ch36:C")  // Section on imputation
```

**Example - Find doctrines for a passage:**
```
find_doctrines_for_passage(book: "ROM", chapter: 3, verse: 23)
```

### Backup Tools

| Tool | Parameters | Purpose |
|------|------------|---------|
| `full_export` | - | Export everything (notes, topics, inline tags) |
| `full_import` | `notes`, `topics?`, `inlineTagTypes?` | Import backup (upsert) |
| `delete_all_notes` | `confirm` | Delete all notes (requires confirm=true) |
| `get_last_modified` | - | Timestamp of most recent note change |

### AI-Enhanced Composite Tools

These combine multiple operations for common workflows.

| Tool | Parameters | Purpose |
|------|------------|---------|
| `parse_verse_reference` | `text` | Parse "Romans 3:21-26" → structured format |
| `sermon_prep_bundle` | `book`, `startChapter`, `endChapter?`, `startVerse?`, `endVerse?` | All sermon prep data at once |
| `doctrine_study_bundle` | `chapterNumber` | All data for studying a doctrine |
| `suggest_topics_for_passage` | `book`, `chapter`, `verse?` | Suggest topics for a passage |
| `extract_illustrations` | `book?` | Get all illustration tags |
| `extract_applications` | `book?` | Get all application tags |
| `find_related_notes` | `noteId`, `limit?` | Find similar notes |
| `summarize_topic_notes` | `topicId` | Summarize all notes under a topic |
| `create_enriched_note` | same as create_note | Create note with auto-suggested topics |
| `auto_tag_note` | `noteId`, `apply?` | Auto-suggest and optionally apply topics |
| `insert_doctrine_links` | `noteId`, `preview?` | Add [[ST:ChX]] links to note content |

**Example - Full sermon prep workflow:**
```
sermon_prep_bundle(book: "JHN", startChapter: 3, startVerse: 1, endVerse: 21)
```
Returns: existing notes, relevant doctrines, illustrations, applications, key points.

**Example - Auto-organize a note:**
```
auto_tag_note(noteId: "abc-123", apply: true)
```

### Bible Book Codes

Always use 3-letter codes:

**Old Testament:**
GEN, EXO, LEV, NUM, DEU, JOS, JDG, RUT, 1SA, 2SA, 1KI, 2KI, 1CH, 2CH, EZR, NEH, EST, JOB, PSA, PRO, ECC, SNG, ISA, JER, LAM, EZK, DAN, HOS, JOL, AMO, OBA, JON, MIC, NAM, HAB, ZEP, HAG, ZEC, MAL

**New Testament:**
MAT, MRK, LUK, JHN, ACT, ROM, 1CO, 2CO, GAL, EPH, PHP, COL, 1TH, 2TH, 1TI, 2TI, TIT, PHM, HEB, JAS, 1PE, 2PE, 1JN, 2JN, 3JN, JUD, REV

### Doctrine Link Syntax

Link notes to systematic theology with: `[[ST:Ch32]]`, `[[ST:Ch32:A]]`, `[[ST:Ch32:A.1]]`

### Workflow Examples

**"Help me prepare a sermon on Romans 8:28-30"**
1. `sermon_prep_bundle(book: "ROM", startChapter: 8, startVerse: 28, endVerse: 30)`
2. `get_systematic_section(reference: "Ch32")` - Election
3. `get_systematic_section(reference: "Ch33")` - Calling
4. Create sermon note with findings

**"What does systematic theology say about the Trinity?"**
1. `search_systematic_theology(query: "trinity")`
2. `get_systematic_section(reference: "Ch14")`
3. `explain_doctrine_simply(chapterNumber: 14)`

**"Find all my illustrations about grace"**
1. `search_inline_tags(query: "grace", type: "illustration")`

**"Organize my note on John 3"**
1. `get_note(id: "note-uuid")`
2. `auto_tag_note(noteId: "note-uuid", apply: true)`
3. `insert_doctrine_links(noteId: "note-uuid")`

---

Start by calling `get_notes_summary()` to see what data I have.
