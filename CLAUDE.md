# CLAUDE.md - Sacred Bible Study App

## Project Summary

Sacred is a personal Bible study app with rich text notes, commentary, and sermon management. Notes are attached to verse ranges and stored locally in SQLite.

## Quick Start Commands

```bash
# Development (two terminals)
npm run dev          # Frontend at http://localhost:3000
npm run dev:server   # Backend at http://localhost:3001

# Production
npm run build && npm start

# Docker
docker-compose up
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
Sacred/
├── src/                    # React frontend (ESM)
│   ├── components/         # Organized by feature
│   │   ├── Bible/         # Reader components (BibleReader, ChapterView, Verse)
│   │   ├── Layout/        # Header, Sidebar, VerseSearch, ResizableDivider
│   │   ├── Notes/         # NoteCard, NoteEditor, NotesPanel, AddNoteModal
│   │   └── UI/            # Button, ThemeToggle, SettingsModal
│   ├── context/           # BibleContext, NotesContext, ThemeContext
│   ├── services/          # API calls (bibleApi.js, notesService.js)
│   └── utils/             # Helpers (parseReference, bibleBooks, verseRange)
├── server/                 # Express backend (CommonJS .cjs)
│   ├── routes/            # notes.cjs, backup.cjs
│   ├── db.cjs             # SQLite setup
│   └── index.cjs          # Server entry
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

### Supported Platforms
- **Local:** `npm run dev` for development
- **Docker:** `docker-compose up` (production build)
- **StartOS:** Package as `.s9pk` for self-hosted (planned)
- **Mac App:** Wrapped web app via Electron/Tauri (planned)

### Docker Notes
- Uses Node 20 Alpine (multi-stage build)
- Data persisted in `/app/data` volume
- Single container serves both frontend and API

### Environment Variables
- `PORT`: Server port (default 3000)
- `NODE_ENV`: 'development' or 'production'
- `DB_PATH`: Custom database file location

## Documentation

- `docs/ROADMAP.md` - Planned features and priorities
- `docs/TESTING.md` - Test workflows and future test setup
- `docs/CHANGELOG.md` - Version history

## Important Notes for Claude

- Server uses CommonJS (`.cjs`) because better-sqlite3 requires it
- Vite proxies `/api` to port 3001 in development
- Bible text comes from bible-api.com (rate limited, cached)
- All timestamps are ISO strings
- Note content is HTML (from Tiptap editor)
- When adding features, follow existing patterns in similar components
