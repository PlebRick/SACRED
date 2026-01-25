# CLAUDE.md - SACRED Bible Study App

## Project Summary

SACRED is a personal Bible study app with rich text notes, commentary, and sermon management. Notes are attached to verse ranges and stored locally in SQLite.

## Quick Start Commands

```bash
# Development (two terminals)
npm run dev          # Frontend at http://localhost:3000
npm run dev:server   # Backend at http://localhost:3001

# Mac App
npm run electron:build   # Creates release/SACRED-*.dmg
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, CSS Modules |
| Editor | Tiptap (rich text) |
| Backend | Express 5 (CommonJS) |
| Database | SQLite (better-sqlite3) |
| State | React Context + useReducer |

## Project Structure

```
SACRED/
├── src/                    # React frontend (ESM)
│   ├── components/         # Organized by feature
│   │   ├── Bible/         # Reader components (BibleReader, ChapterView, Verse)
│   │   ├── Layout/        # Header, Sidebar, VerseSearch, SystematicTree
│   │   ├── Notes/         # NoteCard, NoteEditor, NotesPanel, InsertDoctrineModal
│   │   ├── Systematic/    # SystematicPanel (doctrine viewer)
│   │   └── UI/            # Button, ThemeToggle, SettingsModal, NoteTypeIndicator
│   ├── context/           # BibleContext, NotesContext, SystematicContext, SettingsContext
│   ├── extensions/        # Tiptap extensions (InlineTagMark, SystematicLinkMark)
│   ├── services/          # API calls (bibleApi.js, notesService.js, systematicService.js)
│   └── utils/             # Helpers (parseReference, bibleBooks, verseRange)
├── server/                 # Express backend (CommonJS .cjs)
│   ├── routes/            # notes.cjs, backup.cjs, systematic.cjs, bible.cjs
│   ├── db.cjs             # SQLite setup (includes systematic theology tables)
│   └── index.cjs          # Server entry
├── electron/               # Electron main process
│   ├── main.cjs           # App entry, server startup, auto-restore
│   └── preload.js         # Context bridge
├── mcp/                    # MCP server for Claude integration
│   └── src/tools/         # systematic.ts (7 Claude tools)
├── myfiles/                # Personal data (gitignored)
│   ├── grudem-sys-theo-parsed/
│   │   └── systematic-theology-complete.json
│   └── web-bible-complete.json  # Offline WEB Bible (~6MB)
└── data/                   # SQLite database storage
```

## Key Conventions

### Files
- React components: `.jsx` (PascalCase)
- Server files: `.cjs` (CommonJS required for better-sqlite3)
- Styles: `.module.css` (co-located with component)

### Naming
- Components: PascalCase (`NoteCard.jsx`)
- Functions/variables: camelCase
- CSS classes: camelCase in modules
- Database columns: snake_case
- API response fields: camelCase

### Patterns
- Custom hooks from context: `useBible()`, `useNotes()`, `useTheme()`, `useSettings()`
- API format conversion in routes: `toApiFormat()` converts snake_case to camelCase
- Modal pattern: See `AddNoteModal.jsx` and `SettingsModal.jsx`

## Database Schema

```sql
CREATE TABLE notes (
  id TEXT PRIMARY KEY,           -- UUID
  book TEXT NOT NULL,            -- 3-letter code: 'JHN', 'ROM'
  start_chapter INTEGER NOT NULL,
  start_verse INTEGER,
  end_chapter INTEGER NOT NULL,
  end_verse INTEGER,
  title TEXT DEFAULT '',
  content TEXT DEFAULT '',       -- HTML from Tiptap
  type TEXT DEFAULT 'note',      -- 'note', 'commentary', 'sermon'
  primary_topic_id TEXT,         -- FK to topics table
  series_id TEXT,                -- FK to series table (for sermons)
  created_at TEXT NOT NULL,      -- ISO timestamp
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_notes_book_chapter ON notes(book, start_chapter, end_chapter);
```

## API Reference

### Notes API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notes` | All notes |
| GET | `/api/notes/:id` | Single note |
| GET | `/api/notes/chapter/:book/:chapter` | Notes for chapter |
| POST | `/api/notes` | Create note |
| PUT | `/api/notes/:id` | Update note |
| DELETE | `/api/notes/:id` | Delete note |
| GET | `/api/notes/export` | Export all as JSON |
| POST | `/api/notes/import` | Import (upsert) |
| DELETE | `/api/notes` | Delete all notes |
| GET | `/api/notes/count` | Get total note count |

### Systematic Theology API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/systematic` | Tree structure of all entries |
| GET | `/api/systematic/flat` | Flat list of all entries |
| GET | `/api/systematic/:id` | Single entry with children & scripture refs |
| GET | `/api/systematic/chapter/:num` | Chapter with sections, tags, related |
| GET | `/api/systematic/for-passage/:book/:chapter` | Doctrines for Bible passage |
| GET | `/api/systematic/tags` | All tags with chapter counts |
| GET | `/api/systematic/by-tag/:tagId` | Chapters filtered by tag |
| GET | `/api/systematic/search?q=term` | Full-text search with snippets |
| GET | `/api/systematic/summary` | Statistics (counts by type) |
| POST | `/api/systematic/:id/annotations` | Add highlight/note annotation |
| GET | `/api/systematic/:id/annotations` | Get annotations for entry |
| DELETE | `/api/systematic/annotations/:id` | Delete annotation |
| GET | `/api/systematic/:id/referencing-notes` | Notes linking to entry |

### Study Sessions API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sessions` | Log a study session |
| GET | `/api/sessions` | Get recent sessions (supports `type`, `startDate`, `endDate` filters) |
| GET | `/api/sessions/summary` | Aggregated statistics (top chapters, doctrines, daily activity) |
| GET | `/api/sessions/related` | Find sessions related to book/doctrine |
| DELETE | `/api/sessions` | Clear old sessions (requires `olderThan` date) |

### Bible API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/bible/:translation/:book/:chapter` | Fetch chapter text |
| GET | `/api/bible/status` | Report offline availability |

**Translations:**
- `esv` - English Standard Version (requires `ESV_API_KEY` in `.env`, online only)
- `web` - World English Bible (public domain, offline supported in Electron app)

**Offline Support:**
- WEB Bible (~6MB) is bundled with Electron app for true offline access
- Local data checked first, falls back to API if unavailable
- ESV cannot be stored offline due to Crossway API terms

**Response format:**
```json
{
  "reference": "John 1",
  "translation": "ESV",
  "verses": [
    { "verse": 1, "text": "In the beginning was the Word..." }
  ]
}
```

**Status response:**
```json
{
  "translations": {
    "web": { "available": true, "offline": true, "source": "local" },
    "esv": { "available": true, "offline": false, "source": "api" }
  }
}
```

## Styling Guide

### CSS Variables (defined in `src/index.css`)
- `--bg-primary`, `--bg-secondary`, `--bg-tertiary` - Background colors
- `--text-primary`, `--text-secondary` - Text colors
- `--accent` - Warm accent (amber/brown: `#d4a574` dark, `#92400e` light)
- `--accent-subtle`, `--note-highlight` - Translucent accent variants
- `--border`, `--shadow`, `--shadow-warm` - Borders and shadows

### Theme
Dark theme is default. Light theme available. Respects system preference via ThemeContext.

## Common Tasks

### Add a new component
1. Create `ComponentName.jsx` in appropriate folder under `src/components/`
2. Create `ComponentName.module.css` alongside it
3. Use existing CSS variables for consistency

### Add a new API endpoint
1. Add route in `server/routes/notes.cjs` or create new route file
2. Use `toApiFormat()` helper for response
3. Mount in `server/index.cjs` if new file

### Add new context state
1. Add to reducer in context file (e.g., `src/context/NotesContext.jsx`)
2. Create action handler
3. Add to Provider value object
4. Export via custom hook

## Testing

Full test suite using Vitest with React Testing Library.

```bash
npm test              # Run all tests
npm run test:coverage # Run with coverage
```

Structure: `tests/unit/`, `tests/component/`, `tests/integration/`

Current: **522 tests** | See `docs/TESTING.md` for patterns and coverage details.

## Deployment

### Mac App
- Build with `npm run electron:build`
- Output: `release/SACRED-*.dmg`
- Database: `~/Library/Application Support/sacred/sacred.db`

### Native Module Architecture (IMPORTANT)

This project uses `better-sqlite3`, a native C++ module that must be compiled for a specific:
1. **CPU Architecture** (ARM64 vs x64)
2. **Node.js version** (system Node vs Electron's bundled Node)

There is only ONE copy of the compiled module in `node_modules/`, so **building for different targets overwrites it**.

**Build targets and their requirements:**

| Environment | Node Runtime | Architecture | Command to Prepare |
|-------------|--------------|--------------|-------------------|
| Dev server (`npm run dev:server`) | System Node | Your CPU (ARM on M1/M2/M3) | `npm rebuild better-sqlite3` |
| Electron dev (`npm run electron:dev`) | Electron's Node | Your CPU | `npx electron-rebuild -f -w better-sqlite3` |
| Electron build ARM | Electron's Node | ARM64 | `npx electron-rebuild -f -w better-sqlite3 --arch=arm64` |
| Electron build Intel | Electron's Node | x64 | `npx electron-rebuild -f -w better-sqlite3 --arch=x64` |

**Common issue: White screen after building for different architecture**

If you build for x64 (Intel) then try to run dev or ARM build, you'll get a white screen because the native module is compiled for the wrong architecture.

**Fix:** Rebuild for your current environment:
```bash
# After building x64, restore ARM for local dev:
npm rebuild better-sqlite3

# Or for Electron dev:
npx electron-rebuild -f -w better-sqlite3
```

**Recommended workflow for releases:**

Use GitHub Actions (`.github/workflows/build.yml`) to build both architectures in CI. This avoids the need to switch locally:
- macos-14 runner builds ARM64 natively
- macos-13 runner builds x64 natively

**Symptoms of version/architecture mismatch:**
- White screen on app launch
- Error: "NODE_MODULE_VERSION X. This version of Node.js requires NODE_MODULE_VERSION Y"
- Error: "was compiled against a different Node.js version"

**Nuclear option:** Delete everything and reinstall:
```bash
rm -rf node_modules && npm install
```

### Environment Variables
- `PORT`: Server port (default 3000)
- `NODE_ENV`: 'development' or 'production'
- `DB_PATH`: Custom database file location
- `ESV_API_KEY`: API key for ESV Bible translation (get one at https://api.esv.org/)

## Documentation

- `docs/ROADMAP.md` - Planned features and priorities
- `docs/TESTING.md` - Test workflows and future test setup
- `docs/CHANGELOG.md` - Version history
- `docs/SYSTEMATIC-THEOLOGY-SCHEMA.md` - JSON format for importing custom theology content

## Systematic Theology Feature

### Overview

SACRED includes an optional Systematic Theology module for studying doctrine alongside Scripture. The feature provides:

- **Sidebar Tree View**: Hierarchical navigation (Parts → Chapters → Sections → Subsections)
- **Doctrine Panel**: Slide-over panel displaying doctrine content with highlights
- **Note Integration**: Link notes to doctrine chapters with `[[ST:Ch32]]` syntax
- **Scripture Index**: 4800+ verse references mapped to doctrines
- **Related Doctrines**: Auto-populated suggestions based on current Bible chapter
- **Personal Annotations**: Highlight text with colors, add notes

### Architecture

The systematic theology content is **separated from code**:

- **Code** (public): All React components, API routes, database schema
- **Content** (private): JSON data file with actual doctrine text

This allows the code to be open source while keeping copyrighted content private.

### Database Tables

```sql
-- Main entries (parts, chapters, sections, subsections)
systematic_theology (id, entry_type, part_number, chapter_number, ...)

-- Scripture verse references
systematic_scripture_index (systematic_id, book, chapter, start_verse, ...)

-- User highlights and notes
systematic_annotations (systematic_id, annotation_type, text_selection, color, ...)

-- Cross-references between chapters
systematic_related (source_chapter, target_chapter, relationship_type)

-- Category tags (7 Grudem parts)
systematic_tags (id, name, color)
systematic_chapter_tags (chapter_number, tag_id)

-- Full-text search
systematic_theology_fts (FTS5 virtual table)
```

### Building with Systematic Theology Data

The JSON data file is **not committed to git** (personal license). To build a Mac app with data:

1. **Place your JSON data file** at:
   ```
   myfiles/grudem-sys-theo-parsed/systematic-theology-complete.json
   ```

2. **Build the DMG**:
   ```bash
   npm run electron:build
   ```

3. **How it works**:
   - `electron-builder` copies the JSON to `Contents/Resources/` via `extraResources`
   - On first app launch, `electron/main.cjs` detects empty database
   - Auto-restore imports all data (776 entries, 4800+ scripture refs, tags)
   - Foreign key constraints disabled during bulk import

### JSON Data Format

```json
{
  "systematic_theology": [
    {
      "id": "uuid",
      "entry_type": "chapter",
      "chapter_number": 1,
      "title": "Introduction to Systematic Theology",
      "content": "<p>HTML content...</p>",
      "summary": "AI-generated summary",
      "parent_id": "parent-uuid",
      "sort_order": 1
    }
  ],
  "scripture_index": [
    { "systematic_id": "uuid", "book": "JHN", "chapter": 1, "start_verse": 1 }
  ],
  "tags": [
    { "id": "uuid", "name": "Doctrine of God", "color": "#4a90d9" }
  ],
  "chapter_tags": [
    { "chapter_number": 1, "tag_id": "uuid" }
  ],
  "related": [
    { "source_chapter": 1, "target_chapter": 2, "relationship_type": "see_also" }
  ]
}
```

### Linking Notes to Doctrines

In the note editor:
- **Toolbar button**: Click book icon or press `Cmd+Shift+D` to open Insert Doctrine modal
- **Type syntax**: Type `[[ST:Ch32]]` and it auto-converts to a clickable link
- **Paste syntax**: Paste `[[ST:Ch32:A.1]]` and it auto-converts

Link formats:
- `[[ST:Ch32]]` - Link to chapter 32
- `[[ST:Ch32:A]]` - Link to section A of chapter 32
- `[[ST:Ch32:A.1]]` - Link to subsection A.1 of chapter 32

## MCP Tools for Claude

SACRED provides 72 MCP tools for Bible study assistance. **Always prefer MCP tools over file/database access** when working with SACRED data.

### When to Use MCP Tools

| User Request | Tools to Use |
|--------------|--------------|
| "What notes do I have on Romans?" | `get_chapter_notes`, `search_notes` |
| "Help me prepare a sermon on John 3" | `sermon_prep_bundle`, `generate_sermon_structure`, `get_similar_sermons` |
| "What does the Bible say about justification?" | `search_systematic_theology`, `get_systematic_section` |
| "Create a note on this passage" | `create_note` |
| "Explain election simply" | `explain_doctrine_simply` |
| "Export my notes" | `export_notes` or `full_export` |
| "What have I been studying?" | `get_recent_sessions`, `get_study_summary` |
| "When did I last look at Romans 3?" | `get_last_studied` |
| "What sermons have I done on faith?" | `get_similar_sermons` |
| "Find illustrations about grace" | `compile_illustrations_for_topic` |
| "Have I used this illustration before?" | `check_illustration_duplicates` |
| "Which illustrations have I reused?" | `get_duplicate_illustrations` |
| "Create a sermon series" | `create_series`, `add_sermon_to_series` |
| "What series do I have?" | `list_series`, `get_series` |

### Tool Categories

**Notes - Reading:**
- `list_notes` - Get all notes (paginated)
- `get_note` - Get single note by ID
- `get_note_metadata` - Get note metadata without content (token-efficient)
- `list_notes_metadata` - List notes without content, with filtering (token-efficient)
- `get_chapter_notes` - Notes overlapping a Bible chapter
- `get_notes_summary` - Statistics (counts by book, type)
- `search_notes` - Full-text search
- `get_books_with_notes` - Which books have notes
- `export_notes` - Export all notes as JSON

**Notes - Writing:**
- `create_note` - Create new note (supports `primaryTopicId`, `tags[]`)
- `update_note` - Update existing note
- `delete_note` - Delete note by ID
- `import_notes` - Bulk import (upsert)

**Systematic Theology:**
- `search_systematic_theology` - Search doctrine content
- `get_systematic_section` - Get by reference (`Ch32`, `Ch32:A`, `Ch32:A.1`)
- `get_systematic_summary` - Statistics (776 entries, 57 chapters)
- `find_doctrines_for_passage` - Doctrines citing a Bible passage
- `summarize_doctrine_for_sermon` - Sermon prep bundle
- `explain_doctrine_simply` - Jargon-free explanation
- `extract_doctrines_from_note` - Suggest doctrines for a note

**Backup:**
- `full_export` - Export everything (notes, topics, inline tags)
- `full_import` - Import backup data
- `get_last_modified` - Last modification timestamp

**Study Sessions:**
- `get_recent_sessions` - Get recent study sessions (Bible chapters, doctrines, notes viewed)
- `get_study_summary` - Aggregated stats (top chapters, most viewed doctrines, daily activity)
- `find_related_sessions` - Find sessions related to a Bible book or doctrine chapter
- `get_last_studied` - When user last studied a specific reference

**Sermon Preparation:**
- `sermon_prep_bundle` - Comprehensive data for a passage (notes, doctrines, illustrations, applications)
- `get_similar_sermons` - Find past sermons by book, chapter, topic, or keyword
- `compile_illustrations_for_topic` - Gather illustrations by topic keyword or doctrine chapter
- `generate_sermon_structure` - Generate a structured sermon outline scaffold with resources
- `check_illustration_duplicates` - Check if an illustration has been used before
- `get_duplicate_illustrations` - Find illustrations that appear in multiple sermons

**Sermon Series:**
- `list_series` - List all sermon series with sermon counts
- `get_series` - Get a series with its sermons
- `create_series` - Create a new sermon series
- `add_sermon_to_series` - Link a sermon note to a series
- `remove_sermon_from_series` - Unlink a sermon from a series

### Best Practices

1. **Start with summaries**: Use `get_notes_summary` or `get_systematic_summary` to understand the data scope
2. **Use specific queries**: `get_chapter_notes(book, chapter)` is faster than filtering `list_notes`
3. **Reference syntax**: Use `[[ST:Ch32]]` format when linking notes to doctrines
4. **Book codes**: Use 3-letter codes: `GEN`, `EXO`, `ROM`, `JHN`, `REV`, etc.
5. **HTML content**: Note content is HTML from Tiptap editor - preserve formatting

### Token-Efficient Tool Usage

Use metadata-only tools to minimize token consumption when full content isn't needed:

| Need | Tool | Token Cost |
|------|------|------------|
| Browse notes | `list_notes_metadata` | Low |
| Check note exists | `get_note_metadata` | Low |
| Read full content | `get_note` | High |

**Pattern:** Use metadata tools first to identify relevant notes, then fetch full content only when needed.

```
1. list_notes_metadata(book="ROM", type="sermon") - get list of sermons in Romans (no content)
2. get_note(id) - fetch specific sermon content when user wants details
```

### Example Workflows

**Sermon Preparation:**
```
1. generate_sermon_structure("JHN", 3, 16, 21) - get outline scaffold
2. get_similar_sermons(book="JHN") - check what you've preached before
3. compile_illustrations_for_topic("regeneration") - find illustrations
4. sermon_prep_bundle("JHN", 3, 16, 3, 21) - gather all related data
5. create_note(type="sermon", ...) - save completed sermon
```

**Doctrine Study:**
```
1. search_systematic_theology("justification")
2. get_systematic_section("Ch36") - full chapter
3. get_systematic_section("Ch36:C") - specific section
4. explain_doctrine_simply(36) - simple explanation
```

**Understanding Study Patterns:**
```
1. get_study_summary(30) - what's been studied in last 30 days
2. get_recent_sessions(type="bible") - recent Bible chapters viewed
3. find_related_sessions(book="ROM") - all Romans study sessions
4. get_last_studied("JHN:3") - when John 3 was last viewed
```

## Important Notes for Claude

- Server uses CommonJS (`.cjs`) because better-sqlite3 requires it
- Vite proxies `/api` to port 3001 in development
- Bible text fetched via backend proxy (`/api/bible`) supporting ESV and WEB translations
- ESV requires API key in `.env`; WEB is public domain (no key needed)
- Translation preference stored in localStorage (`sacred_translation`)
- All timestamps are ISO strings
- Note content is HTML (from Tiptap editor)
- When adding features, follow existing patterns in similar components
- Systematic theology data is NOT in git - must be provided separately for builds
- **Always use MCP tools** to read/write SACRED data - never access the database directly
- See `docs/MCP-GUIDE.md` for comprehensive tool documentation
