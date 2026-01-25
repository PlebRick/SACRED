# Systematic Theology Integration Plan

## Overview

Integrate a **Systematic Theology** reference system into SACRED - not a standalone reading experience, but a linkable, searchable resource that integrates into the sermon preparation workflow.

**Important Notes:**
- Schema is designed to match Wayne Grudem's "Systematic Theology" structure exactly (7 parts, 57 chapters, sections)
- UI and code use generic name "Systematic Theology" (not "Grudem") for open source compatibility
- **No copyrighted content is bundled** - users import their own content locally
- Content lives in local database only, never committed to repo
- User plans to rename existing "Systematic Theology" topic tree to "Theology" to avoid confusion

---

## User Workflow Context

The user's sermon preparation process:
1. Read Bible passage
2. Brainstorm, put random thoughts in notes
3. Read commentary (already supported)
4. Refine/add to notes
5. **Identify key doctrines in the passage** ← This is where Grudem is needed
6. Finish sermon

**Key insight**: Grudem is a reference tool, not primary reading material. The goal is quick lookup, linking, and AI-assisted doctrine discovery.

---

## Key Decisions Made

### Decision 1: Separate Table (Not Topics)
**Chosen**: Option B - Dedicated `systematic_theology` table

**Why**:
- Topics remain the user's personal tagging system (unchanged)
- Grudem has its own purpose-built structure
- No confusion between "Grudem's Chapter on Doctrine of God" vs user's "Doctrine of God" tag
- Clean separation of concerns

**Rejected alternatives**:
- Topics as Grudem structure (conflicts with user tagging)
- Virtual "book" (hacky, pollutes Bible navigation)
- Notes with nullable verses (overloads notes concept)

### Decision 2: Content Display - Slide-Over Panel
**Chosen**: Clicking a Grudem link opens a slide-over panel

**Why**:
- User stays in their note/sermon while viewing reference
- Can read Grudem content alongside their work
- Not a full page navigation (would lose context)
- Not a modal (too disconnected, can't work alongside)

### Decision 3: Link Syntax
**Format**: `[[ST:Ch32]]` or `[[ST:Ch32:A]]` for sections

**Behavior**:
- Rendered as clickable link in note content
- Shows title on hover (e.g., "Chapter 32: Perseverance of the Saints")
- Click opens slide-over panel with content

### Decision 4: Scripture-to-Doctrine Index
A reverse lookup table mapping Bible verses to Grudem chapters.

**Use case**: "What doctrines relate to Romans 8?" → Returns list of relevant Grudem chapters with verse references.

### Decision 5: MCP Tools for Claude Integration
Claude (via Claude Code or Claude Cowork) can:
- Search systematic theology content
- Find doctrines for a given passage
- Return linkable references that user can paste into notes

**Example interaction**:
> User: "What key doctrines are in Romans 8? Find them in my systematic theology."
>
> Claude: "Romans 8 touches on:
> - **Perseverance** - [[ST:Ch32]] (vv. 28-39)
> - **Adoption** - [[ST:Ch37]] (vv. 14-17)
> - **Sanctification** - [[ST:Ch38]] (vv. 1-17)"

### Decision 6: Sidebar Navigation
New tab in sidebar: "Systematic Theology" (alongside Books, Notes, Topics).

- Tree structure matching the systematic theology outline
- Part → Chapter → Section hierarchy
- Click navigates and opens slide-over panel

### Decision 7: Search (Future)
Full-text search is planned but **not yet implemented**. It will be part of the broader app-wide search feature on the roadmap.

### Decision 8: Open Source Compatibility
**Problem**: Can't include copyrighted content or use "Grudem" name in open source repo.

**Solution**:
- Schema designed for Grudem's exact structure, but named generically
- No content bundled in repo - users import their own
- Import via JSON file (user prepares from their Logos export)
- Content stored in local database only
- `.gitignore` any import files
- Documentation explains how to import your own systematic theology

**What ships in open source**:
- Empty schema and tables
- Import functionality (UI + API)
- Link rendering and slide-over panel
- MCP tools (work with whatever content is imported)
- Documentation on import format

---

## Target Book Structure (Grudem's Systematic Theology)

```
Part 1: The Doctrine of the Word of God
  Ch 1: Introduction to Systematic Theology
  Ch 2: The Word of God
  Ch 3: The Canon of Scripture
  Ch 4: The Four Characteristics of Scripture
  Ch 5: The Inerrancy of Scripture
  Ch 6: The Clarity of Scripture
  Ch 7: The Necessity of Scripture
  Ch 8: The Sufficiency of Scripture

Part 2: The Doctrine of God
  Ch 9: The Existence of God
  Ch 10: The Knowability of God
  Ch 11: The Character of God: Incommunicable Attributes
  Ch 12: The Character of God: Communicable Attributes
  Ch 13: The Trinity
  Ch 14: Creation
  Ch 15: God's Providence
  Ch 16: Miracles
  Ch 17: Prayer
  Ch 18: Angels
  Ch 19: Satan and Demons

Part 3: The Doctrine of Man
  Ch 20: The Creation of Man
  Ch 21: Man as Male and Female
  Ch 22: The Essential Nature of Man
  Ch 23: Sin
  Ch 24: The Covenants Between God and Man

Part 4: The Doctrines of Christ and the Holy Spirit
  Ch 25: The Person of Christ
  Ch 26: The Atonement
  Ch 27: Resurrection and Ascension
  Ch 28: The Offices of Christ
  Ch 29: The Work of the Holy Spirit

Part 5: The Doctrine of the Application of Redemption
  Ch 30: Common Grace
  Ch 31: Election and Reprobation
  Ch 32: The Gospel Call and Effective Calling
  Ch 33: Regeneration
  Ch 34: Conversion (Faith and Repentance)
  Ch 35: Justification
  Ch 36: Adoption
  Ch 37: Sanctification
  Ch 38: Baptism and Filling of the Holy Spirit
  Ch 39: The Perseverance of the Saints
  Ch 40: Death, the Intermediate State

Part 6: The Doctrine of the Church
  Ch 41: The Nature of the Church
  Ch 42: The Purity and Unity of the Church
  Ch 43: The Power of the Church
  Ch 44: Church Government
  Ch 45: Means of Grace Within the Church
  Ch 46: Baptism
  Ch 47: The Lord's Supper
  Ch 48: Worship
  Ch 49: Gifts of the Holy Spirit (General)
  Ch 50: Gifts of the Holy Spirit (Specific)

Part 7: The Doctrine of the Future
  Ch 51: The Return of Christ
  Ch 52: The Millennium
  Ch 53: The Final Judgment
  Ch 54: The New Heavens and New Earth
```

*Note: Chapter numbers and titles should be verified against actual book*

---

## Database Schema

### New Tables

```sql
-- Main content table (maximum granularity: sub-sections)
CREATE TABLE systematic_theology (
  id TEXT PRIMARY KEY,           -- UUID
  part_num INTEGER NOT NULL,     -- 1-7
  part_title TEXT NOT NULL,      -- "The Doctrine of God"
  chapter_num INTEGER NOT NULL,  -- 1-57
  chapter_title TEXT NOT NULL,   -- "The Trinity"
  section_id TEXT,               -- "A", "B", "C" or NULL for chapter intro
  section_title TEXT,            -- "The Word of God as a Person"
  subsection_id TEXT,            -- "1", "2", "3" or NULL if no sub-section
  subsection_title TEXT,         -- "God's Decrees"
  content TEXT NOT NULL,         -- Full HTML content for this entry
  summary TEXT,                  -- 2-3 sentence summary (Feature 1)
  sort_order INTEGER NOT NULL,   -- For ordering within chapter
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Link formats supported:
-- [[ST:Ch2]]       → chapter intro (section_id IS NULL)
-- [[ST:Ch2:A]]     → section A (subsection_id IS NULL)
-- [[ST:Ch2:B.1]]   → section B, sub-section 1

CREATE INDEX idx_systematic_chapter ON systematic_theology(chapter_num);
CREATE INDEX idx_systematic_part ON systematic_theology(part_num);

-- Scripture cross-reference index
CREATE TABLE systematic_scripture_index (
  id TEXT PRIMARY KEY,
  systematic_id TEXT NOT NULL REFERENCES systematic_theology(id) ON DELETE CASCADE,
  book TEXT NOT NULL,            -- 3-letter code: "ROM"
  chapter INTEGER NOT NULL,
  start_verse INTEGER,
  end_verse INTEGER,
  is_primary INTEGER DEFAULT 0,  -- 1 = key verse for this chapter (Feature 4)
  created_at TEXT NOT NULL
);

CREATE INDEX idx_systematic_scripture_book ON systematic_scripture_index(book, chapter);
CREATE INDEX idx_systematic_scripture_ref ON systematic_scripture_index(systematic_id);
CREATE INDEX idx_systematic_scripture_primary ON systematic_scripture_index(is_primary);

-- Personal annotations on ST content (Feature 5)
CREATE TABLE systematic_annotations (
  id TEXT PRIMARY KEY,
  systematic_id TEXT NOT NULL REFERENCES systematic_theology(id) ON DELETE CASCADE,
  type TEXT NOT NULL,            -- 'highlight', 'note', 'bookmark'
  content TEXT,                  -- For notes: the annotation text
  start_offset INTEGER,          -- Character offset in content (for highlights)
  end_offset INTEGER,
  color TEXT,                    -- For highlights: color code
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_annotations_systematic ON systematic_annotations(systematic_id);

-- Related chapters / cross-references (Feature 6)
CREATE TABLE systematic_related (
  id TEXT PRIMARY KEY,
  from_chapter INTEGER NOT NULL,
  to_chapter INTEGER NOT NULL,
  context TEXT,                  -- "see also", "discussed in", etc.
  created_at TEXT NOT NULL
);

CREATE INDEX idx_related_from ON systematic_related(from_chapter);

-- Doctrine tags (Feature 7)
CREATE TABLE systematic_tags (
  id TEXT PRIMARY KEY,
  tag TEXT NOT NULL UNIQUE,      -- "Trinity", "Salvation", "Eschatology"
  created_at TEXT NOT NULL
);

CREATE TABLE systematic_chapter_tags (
  chapter_num INTEGER NOT NULL,
  tag_id TEXT NOT NULL REFERENCES systematic_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (chapter_num, tag_id)
);

CREATE INDEX idx_chapter_tags ON systematic_chapter_tags(tag_id);
```

### Existing Tables (No Changes Required)
- `notes` - unchanged, topics remain for user tagging
- `topics` - unchanged, user's personal categorization

### Schema Summary
| Table | Purpose |
|-------|---------|
| `systematic_theology` | Main content (parts, chapters, sections) |
| `systematic_scripture_index` | Bible verse → doctrine mapping |
| `systematic_annotations` | User highlights/notes on ST content |
| `systematic_related` | Chapter cross-references ("see also") |
| `systematic_tags` | Tag definitions |
| `systematic_chapter_tags` | Chapter-to-tag mapping |

---

## API Endpoints

```
GET    /api/systematic                    -- List all (tree structure)
GET    /api/systematic/:id                -- Get single entry by ID
GET    /api/systematic/chapter/:num       -- Get chapter with all sections
GET    /api/systematic/search?q=          -- Full-text search (future)
GET    /api/systematic/for-passage/:book/:chapter  -- Doctrines for a Bible passage
```

---

## MCP Tools (for Claude Integration)

```javascript
// Search systematic theology content
search_systematic_theology(query: string, limit?: number)
// Returns: Array of { id, chapter_num, section_id, title, snippet }

// Get specific section
get_systematic_section(chapter: number, section?: string)
// Returns: { id, title, content, scripture_refs }

// Find doctrines for a passage
find_doctrines_for_passage(book: string, chapter: number, verse?: number)
// Returns: Array of { id, chapter_num, title, relevance, verse_refs }
```

---

## UI Components

### 1. Sidebar Tab: "Systematic Theology" ✅ IMPLEMENTED
- New tab alongside Books, Notes, Topics
- Tree view of systematic theology table of contents
- Expandable: Part → Chapter → Section
- Click opens slide-over panel
- **Enhancement (Jan 20, 2026):** Nested chapter dropdowns
  - Chapters with sections show chevron icon
  - Click chevron to expand/collapse sections (without opening chapter)
  - Click chapter title to open full chapter content
  - "Expand All | Collapse All" controls above tree
  - Sections hidden by default for cleaner view

### 2. Slide-Over Panel
- **Position**: Overlays the notes panel (Option A) - notes hidden behind, Bible stays visible
- **Trigger**: Click doctrine link, sidebar item, or auto-suggest item
- Shows systematic theology content for the specific section/sub-section
- Header with chapter/section/sub-section title + breadcrumb navigation
- Close button (X) returns to notes panel
- **Bidirectional links section**: Shows "Your notes referencing this doctrine" at bottom
- **Personal annotations**: User can add highlights/notes to ST content (see Feature 5)
- **See Also section**: Related chapters parsed from content (see Feature 6)
- **Navigation**: Prev/Next arrows to move through sections within chapter

### 3. Note Editor: Insert Link Button
- Toolbar button: "Insert Doctrine Link" or similar
- Opens modal to search/browse systematic theology
- Inserts `[[ST:Ch32]]` syntax
- Auto-renders as clickable link
- **Keyboard shortcut**: `Cmd+Shift+D` (or `Ctrl+Shift+D`) for quick insert without toolbar

### 4. Link Rendering in Notes
- `[[ST:Ch32]]` renders as styled link
- Hover shows tooltip with title + summary (if available)
- Click opens slide-over panel

### 4b. Scripture Link Rendering
Clickable scripture references that navigate to Bible passages.

**In ST Content (handled during import)**:
- Logos refs `<a href="logosref:Bible.Jn1.1">John 1:1</a>` converted to internal links
- Click navigates to that Bible book + chapter
- Verse highlighted or scrolled into view (if verse-level navigation supported)
- Format: `<a href="#" data-scripture="JHN.1.1">John 1:1</a>` or similar

**In Notes (future enhancement)**:
- Auto-detect patterns: "John 3:16", "Romans 8:28-30", "1 Cor. 13:4-7"
- Render as clickable links
- Same navigation behavior as ST scripture links
- Can be implemented after core ST features

### 5. Auto-Suggest Doctrines Panel (Option A)
Collapsible section at TOP of the Notes panel, always visible regardless of active tab:

```
┌─────────────────────────────────┐
│ 📖 Related Doctrines        [−] │
│ ─────────────────────────────── │
│ Ch39: Perseverance (vv.28-39)   │
│ Ch36: Adoption (vv.14-17)       │
│ Ch37: Sanctification (vv.1-17)  │
└─────────────────────────────────┘
│ [Notes] [Commentary] [Sermons]  │
│ ─────────────────────────────── │
│ Your notes here...              │
```

**Behavior**:
- Automatically populated from `systematic_scripture_index` based on current Bible chapter
- Shows chapter title and relevant verse range
- Clicking a doctrine opens the slide-over panel
- Collapsible to save space (state persisted)
- Shows "No related doctrines" or hides entirely if none found
- Updates when user navigates to different Bible chapter

---

## Additional Features

### Feature 1: Chapter/Section Summaries
A 2-3 sentence summary for each entry, displayed in tree view hover and search results.

**Schema addition**:
```sql
ALTER TABLE systematic_theology ADD COLUMN summary TEXT;
```

**Generation**: AI-generated during import
- Claude API call for each section/sub-section
- Prompt: "Summarize this theological content in 2-3 sentences for quick reference"
- Can be manually edited later via admin UI

**Display locations**:
- Sidebar tree: hover tooltip shows summary
- Search results: summary shown below title
- Auto-suggest panel: summary on hover
- Slide-over panel header: summary below title

### Feature 2: Bidirectional Linking
ST slide-over panel shows all user notes that reference the current doctrine.

**Implementation**:
- Query notes table for content containing `[[ST:ChX]]`
- Display as "Your notes referencing this doctrine" section at bottom of slide-over
- Each link shows: note title, verse range, note type (note/commentary/sermon)
- Clicking navigates to that note

**No schema change needed** - query existing notes table.

### Feature 3: Quick Insert Keyboard Shortcut
`Cmd+Shift+D` (Mac) / `Ctrl+Shift+D` (Windows) opens quick doctrine search while editing.

**Behavior**:
- Opens lightweight search modal (not full browse modal)
- Type to search by chapter title or keywords
- Arrow keys to navigate results
- Enter to insert `[[ST:ChX]]` at cursor
- Escape to cancel

### Feature 4: Key Verses (Primary Scripture References)
Mark 3-5 scripture references per chapter as "primary" for better indexing.

**Schema addition**:
```sql
ALTER TABLE systematic_scripture_index ADD COLUMN is_primary BOOLEAN DEFAULT 0;
```

**Use cases**:
- Auto-suggest panel prioritizes primary refs
- Search results show primary refs first
- "Key passages" section in slide-over panel

**Population**:
- Import script marks first N refs in each chapter as primary (heuristic)
- Can be manually curated later via admin/settings

### Feature 5: Personal Annotations on ST Content
User can add their own notes/highlights to systematic theology content.

**Schema addition**:
```sql
CREATE TABLE systematic_annotations (
  id TEXT PRIMARY KEY,
  systematic_id TEXT NOT NULL REFERENCES systematic_theology(id) ON DELETE CASCADE,
  type TEXT NOT NULL,              -- 'highlight', 'note', 'bookmark'
  content TEXT,                    -- For notes: the annotation text
  start_offset INTEGER,            -- Character offset in content (for highlights)
  end_offset INTEGER,
  color TEXT,                      -- For highlights: 'yellow', 'green', 'blue', 'pink'
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_annotations_systematic ON systematic_annotations(systematic_id);
```

**Highlight colors**:
- Yellow (`#fef08a`) - general highlights
- Green (`#bbf7d0`) - key points / agree
- Blue (`#bfdbfe`) - questions / study further
- Pink (`#fbcfe8`) - sermon ideas / quotes

**UI**:
- Select text in slide-over panel → color picker appears
- Highlights persist and show on re-open
- Notes show as margin icons, click to expand
- "My annotations" section in slide-over panel

### Feature 6: Related Chapters ("See Also")
Parse and display cross-references between ST chapters.

**Schema addition**:
```sql
CREATE TABLE systematic_related (
  id TEXT PRIMARY KEY,
  from_chapter INTEGER NOT NULL,
  to_chapter INTEGER NOT NULL,
  context TEXT,                    -- "see also", "discussed in", etc.
  created_at TEXT NOT NULL
);

CREATE INDEX idx_related_from ON systematic_related(from_chapter);
```

**Population**:
- Import script parses "see chapter X" or "see pp. XXX" references
- Maps page numbers to chapters

**UI**:
- "See Also" section in slide-over panel
- Shows related chapter titles as clickable links

### Feature 7: Doctrine Tags
Tag chapters with keywords for better filtering and search.

**Schema addition**:
```sql
CREATE TABLE systematic_tags (
  id TEXT PRIMARY KEY,
  tag TEXT NOT NULL UNIQUE,        -- "Trinity", "Salvation", "Eschatology"
  created_at TEXT NOT NULL
);

CREATE TABLE systematic_chapter_tags (
  chapter_num INTEGER NOT NULL,
  tag_id TEXT NOT NULL REFERENCES systematic_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (chapter_num, tag_id)
);

CREATE INDEX idx_chapter_tags ON systematic_chapter_tags(tag_id);
```

**Auto-assigned tags** (based on Part structure during import):
| Part | Auto-assigned Tag |
|------|-------------------|
| Part 1 | Scripture |
| Part 2 | God |
| Part 3 | Humanity |
| Part 4 | Christ, Holy Spirit |
| Part 5 | Salvation |
| Part 6 | Church |
| Part 7 | Eschatology |

**Additional tags** (available for manual assignment):
- Trinity, Creation, Providence
- Sin, Covenant
- Atonement
- Justification, Sanctification
- Sacraments, Worship
- Heaven, Judgment

**UI**:
- Tags shown as chips in sidebar tree
- Filter tree by tag
- Search by tag
- Edit tags in slide-over panel or admin UI
- Add custom tags as needed

### Feature 8: AI-Enhanced Features (via MCP)

**8a. Summarize for Sermon**
Claude reads ST chapter + user's current sermon notes, generates contextual summary.

```javascript
// MCP Tool
summarize_doctrine_for_sermon(chapter: number, sermon_note_id: string)
// Returns: Contextual summary relating doctrine to sermon passage
```

**8b. Doctrine Extraction from Notes**
Claude analyzes sermon draft and suggests relevant ST chapters.

```javascript
// MCP Tool
extract_doctrines_from_note(note_id: string)
// Returns: Array of { chapter_num, title, relevance_explanation, suggested_link }
```

**8c. Explain Simply**
Claude provides a simplified explanation of a doctrine.

```javascript
// MCP Tool
explain_doctrine_simply(chapter: number, audience?: string)
// Returns: Plain-language explanation suitable for teaching
```

---

## Import Process

### Source Files
- **Location**: `myfiles/grudem-systematic-theology/`
- **Format**: HTML files exported from Logos Bible Software
- **Naming**: `XX_Title_Systematic Theology_An Introduction to Bible Doctrine.html`
- **Content**: All 57 chapters + Analytical Outline + Appendix
- **Note**: This folder is gitignored - content stays local only

### HTML Structure (from Logos export)

The HTML files have consistent, parseable structure:

```html
<!-- Part header -->
<p style="font-weight:bold; font-size:24pt; ...">Part 1</p>
<p style="font-weight:bold; font-size:36pt; ...">The Doctrine of the Word of God</p>

<!-- Chapter header -->
<p style="font-weight:bold; font-size:18pt; ...">Chapter 2</p>
<p style="font-weight:bold; font-size:24pt; ...">The Word of God</p>

<!-- Section headers -->
<p style="font-weight:bold; font-size:14pt; ...">A. "The Word of God" as a Person</p>

<!-- Sub-sections (inline bold) -->
<span style="font-weight:bold;">1. God's Decrees.</span>

<!-- Scripture references (already linked!) -->
<a href="logosref:Bible.Jn1.1">John 1:1</a>
<a href="logosref:Bible.Ge2.16-17">Gen. 2:16–17</a>

<!-- Page markers (to be stripped) -->
<span style="color:rgb(255, 128, 23); ...">  p 47  </span>

<!-- Standard sections (uppercase) -->
"EXPLANATION AND SCRIPTURAL BASIS"
"QUESTIONS FOR PERSONAL APPLICATION"
"SPECIAL TERMS"
"BIBLIOGRAPHY"
"SCRIPTURE MEMORY PASSAGE"
"HYMN"
```

### Import Script Strategy

**Location**: `scripts/import-systematic-theology.cjs`

**Parsing steps**:
1. Read all HTML files from `myfiles/grudem-systematic-theology/`
2. Sort by filename prefix (01, 02, 03...) to maintain order
3. For each file:
   - Extract part number and title from 24pt/36pt headers
   - Extract chapter number and title from 18pt/24pt headers
   - Extract sections (A, B, C) from 14pt bold headers
   - Extract sub-sections (1, 2, 3) from inline bold spans
   - Strip page markers (orange colored spans)
   - Clean up Logos-specific formatting
4. Parse all `<a href="logosref:Bible.XXX">` links:
   - Convert `logosref:Bible.Jn1.1` → `{ book: "JHN", chapter: 1, verse: 1 }`
   - Handle verse ranges: `Ge2.16-17` → `{ startVerse: 16, endVerse: 17 }`
   - Build scripture index entries automatically
   - **Convert to clickable internal links**: `<a data-scripture="JHN.1.1">John 1:1</a>`
5. Generate UUIDs for each entry
6. Call Claude API to generate summary for each entry
7. Auto-assign tags based on Part number
8. Mark first 3-5 scripture refs per chapter as primary
9. Parse "see chapter X" references for related chapters table
10. Insert into `systematic_theology` table
11. Insert scripture refs into `systematic_scripture_index` table
12. Insert tag assignments into `systematic_chapter_tags` table
13. Insert related chapters into `systematic_related` table
14. Report: chapters imported, sections created, scripture refs indexed, summaries generated

**Scripture reference format conversion**:
```
logosref:Bible.Jn1.1      → JHN 1:1
logosref:Bible.Ge2.16-17  → GEN 2:16-17
logosref:Bible.Re19.13    → REV 19:13
logosref:Bible.1Jn1.1     → 1JN 1:1
logosref:Bible.2Ti3.16    → 2TI 3:16
```

### One-Time Setup
- This is a one-time import, not ongoing sync
- Content is static (the book doesn't change)
- Re-running import will upsert (update existing, insert new)
- Updates would be manual if needed

---

## Implementation Phases

### Phase 1: Database & Import
- [ ] Create schema migration (all tables)
- [ ] Create systematic_theology table (with summary column)
- [ ] Create systematic_scripture_index table (with is_primary column)
- [ ] Create systematic_annotations table
- [ ] Create systematic_related table
- [ ] Create systematic_tags + systematic_chapter_tags tables
- [ ] Build import script (`scripts/import-systematic-theology.cjs`)
- [ ] Parse HTML, extract content, build scripture index
- [ ] Parse "see chapter X" for related chapters
- [ ] Generate initial summaries (AI or first paragraph)

### Phase 2: API Endpoints
- [ ] GET /api/systematic - List all (tree structure)
- [ ] GET /api/systematic/:id - Get single entry
- [ ] GET /api/systematic/chapter/:num - Get chapter with sections
- [ ] GET /api/systematic/for-passage/:book/:chapter - Doctrines for passage
- [ ] GET /api/systematic/tags - List all tags
- [ ] GET /api/systematic/by-tag/:tag - Chapters by tag
- [ ] POST /api/systematic/:id/annotations - Add annotation
- [ ] GET /api/systematic/:id/annotations - Get annotations
- [ ] DELETE /api/systematic/annotations/:id - Delete annotation
- [ ] GET /api/systematic/:id/referencing-notes - Notes that link to this chapter

### Phase 3: MCP Tools
- [ ] search_systematic_theology
- [ ] get_systematic_section
- [ ] find_doctrines_for_passage
- [ ] summarize_doctrine_for_sermon
- [ ] extract_doctrines_from_note
- [ ] explain_doctrine_simply

### Phase 4: UI - Core Components
- [x] Add "Systematic Theology" tab to sidebar
- [x] Build tree view component with tag filtering
- [x] Build slide-over panel component
- [x] Add "Related Doctrines" collapsible section to NotesPanel
- [x] Wire up navigation and state management
- [x] **Enhancement:** Nested chapter dropdowns with expand/collapse controls

### Phase 5: Note Editor Integration
- [ ] Add link syntax parser for `[[ST:ChX]]`
- [ ] Render links with hover tooltip (title + summary)
- [ ] Add "Insert Doctrine Link" toolbar button
- [ ] Build quick search modal
- [ ] Implement `Cmd+Shift+D` keyboard shortcut

### Phase 6: Enhanced Features
- [ ] Bidirectional linking in slide-over panel
- [ ] Personal annotations (highlight, note, bookmark)
- [ ] "See Also" related chapters section
- [ ] Tag chips in sidebar tree

### Phase 7: Search (Future - Part of App Search)
- [ ] Full-text search of systematic theology content
- [ ] Search by tag
- [ ] Integrated with app-wide search feature

---

## Open Questions

### Resolved
1. ~~**Link syntax**: Is `[[ST:Ch32]]` the right format?~~ **Decided**: Yes, `[[ST:Ch32]]` for chapters, `[[ST:Ch32:A]]` for sections, `[[ST:Ch32:B.1]]` for sub-sections
2. ~~**Import format**: What format does Logos export?~~ **Decided**: HTML - ideal format with tagged scripture refs
3. ~~**Auto-suggest location**: Where should related doctrines appear?~~ **Decided**: Option A - collapsible section at top of Notes panel
4. ~~**Slide-over panel position**~~ **Decided**: Option A - overlay on notes panel (notes hidden behind, Bible stays visible)
5. ~~**Section granularity**~~ **Decided**: Maximum granularity - import sections (A, B, C) AND sub-sections (1, 2, 3) as separate linkable entries. Hierarchy preserved for rollup queries. Links target most specific location.
6. ~~**Primary verse selection**~~ **Decided**: Auto-detect (first 3-5 refs per chapter) with manual override via admin UI

### Resolved (continued)
7. ~~**Summary generation**~~ **Decided**: AI-generated during import (Claude API call per entry)
8. ~~**Tag assignment**~~ **Decided**: Auto-assign based on Part structure, editable with ability to add more tags
9. ~~**Annotation colors**~~ **Decided**: Yellow, Green, Blue, Pink
10. ~~**Keyboard shortcut**~~ **Decided**: `Cmd+Shift+D` (Mac) / `Ctrl+Shift+D` (Windows) for quick doctrine insert

---

## Content Data Model

### Hierarchical Content Structure

The systematic theology content follows a **dual-purpose structure**:

```
Part (e.g., "Part 2: The Doctrine of God")
  └── Chapter (e.g., "Chapter 14: God in Three Persons: The Trinity")
        └── Section (e.g., "A. The Doctrine of the Trinity Is Progressively Revealed")
              └── Subsection (e.g., "1. Partial Revelation in the Old Testament")
```

### Two Ways to View Content

**1. Full Reading Mode (Main Header Link)** ✅ IMPLEMENTED
- Clicking the chapter/section header in the sidebar shows ALL content
- **Section headers rendered inline** with accent color and border separator (e.g., "A. Section Title")
- Content flows naturally with subsection headers embedded in the text
- Example: Clicking "Chapter 54" shows:
  ```
  [Chapter intro]

  A. The New Testament's Teaching on Christ's Return  ← styled section header
  [Section A content]

  B. Could Christ Have Returned at Any Hour?  ← styled section header
  [Section B content]

  ...

  F. Could Christ Come Back at Any Time?  ← styled section header
  [Section F intro]

  1. Verses Predicting a Sudden and Unexpected Coming of Christ.  ← embedded bold header
  [All F.1 content - Scripture quotations, commentary, etc.]

  2. Signs That Precede Christ's Return.  ← embedded bold header
  [All F.2 content - signs a through g with verses]

  3. Can These Two Sets of Passages Be Reconciled?  ← embedded bold header
  [All F.3 content - three possible solutions]
  ```

**2. Fine-Grained Mode (Subsection Links)**
- Clicking a subsection link in the tree shows ONLY that subsection's content
- Used for targeted search results and focused reading
- Example: Clicking "F.1 Verses Predicting a Sudden Coming" shows just the ~20 Scripture quotations

### Content Storage Rules ✅ IMPLEMENTED

| Entry Type | Content Field Contains |
|------------|----------------------|
| Chapter | Chapter intro only (sections rendered separately with inline headers) |
| Section | Full section content INCLUDING all subsection content with embedded bold headers |
| Subsection | Just that subsection's extracted content (for fine-grained lookup) |

**Note**: Section content is aggregated via `scripts/aggregate-section-content.cjs`. This script concatenates the section intro with all subsection content, preserving embedded `<span style="font-weight:bold;">` headers for natural reading flow.

### Why Both Are Needed

- **Full reading**: User wants to read Chapter 54 from start to finish → click chapter header
- **Quick lookup**: User searches for "signs before Christ's return" → lands on F.2 subsection directly
- **Sermon prep**: User wants context → reads full section; wants specific point → clicks subsection

### Import Script Responsibility

The import script must:
1. **Extract subsection content** - Each subsection gets its specific paragraphs
2. **Build parent content** - Sections/chapters contain the full text WITH subsection headers embedded
3. **Not duplicate awkwardly** - The subsection headers in parent content are part of the natural flow

---

## Notes

- Search is on the roadmap but not yet built - systematic theology search will be part of that
- Topics remain unchanged - user's personal tagging system
- This is reference material, not a reading experience
- Primary use case: linking from notes, AI-assisted doctrine lookup
- All ST content is user-imported, never bundled in repo
