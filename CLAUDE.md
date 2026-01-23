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
│   │   └── UI/            # Button, ThemeToggle, SettingsModal
│   ├── context/           # BibleContext, NotesContext, SystematicContext
│   ├── extensions/        # Tiptap extensions (InlineTagMark, SystematicLinkMark)
│   ├── services/          # API calls (bibleApi.js, notesService.js, systematicService.js)
│   └── utils/             # Helpers (parseReference, bibleBooks, verseRange)
├── server/                 # Express backend (CommonJS .cjs)
│   ├── routes/            # notes.cjs, backup.cjs, systematic.cjs
│   ├── db.cjs             # SQLite setup (includes systematic theology tables)
│   └── index.cjs          # Server entry
├── electron/               # Electron main process
│   ├── main.cjs           # App entry, server startup, auto-restore
│   └── preload.js         # Context bridge
├── mcp/                    # MCP server for Claude integration
│   └── src/tools/         # systematic.ts (7 Claude tools)
├── myfiles/                # Personal data (gitignored)
│   └── grudem-sys-theo-parsed/
│       └── systematic-theology-complete.json
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
- Custom hooks from context: `useBible()`, `useNotes()`, `useTheme()`
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

No test framework yet. Manual testing only. See `docs/TESTING.md` for test workflows and future plans.

## Deployment

### Mac App
- Build with `npm run electron:build`
- Output: `release/SACRED-*.dmg`
- Database: `~/Library/Application Support/sacred/sacred.db`

### Environment Variables
- `PORT`: Server port (default 3000)
- `NODE_ENV`: 'development' or 'production'
- `DB_PATH`: Custom database file location

## Documentation

- `docs/ROADMAP.md` - Planned features and priorities
- `docs/TESTING.md` - Test workflows and future test setup
- `docs/CHANGELOG.md` - Version history

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

### MCP Tools for Claude

Seven tools available in `mcp/src/tools/systematic.ts`:

| Tool | Description |
|------|-------------|
| `search_systematic_theology` | Full-text search with snippets |
| `get_systematic_section` | Get by ID or reference (Ch32, Ch32:A) |
| `find_doctrines_for_passage` | Find doctrines citing a Bible passage |
| `summarize_doctrine_for_sermon` | Sermon prep summary with key points |
| `extract_doctrines_from_note` | Analyze note and suggest related doctrines |
| `explain_doctrine_simply` | Jargon-free explanation |
| `get_systematic_summary` | Overview statistics |

## Important Notes for Claude

- Server uses CommonJS (`.cjs`) because better-sqlite3 requires it
- Vite proxies `/api` to port 3001 in development
- Bible text comes from bible-api.com (rate limited, cached)
- All timestamps are ISO strings
- Note content is HTML (from Tiptap editor)
- When adding features, follow existing patterns in similar components
- Systematic theology data is NOT in git - must be provided separately for builds
