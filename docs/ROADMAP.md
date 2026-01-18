# SACRED Roadmap

## High Priority

- [ ] **Full-text search across notes**
  - Search note titles and content
  - Highlight matching terms in results
  - Consider SQLite FTS5 extension

- [ ] **Tags/categories for organizing notes**
  - Add tags table with many-to-many relationship
  - Tag filtering in notes panel
  - Color-coded tag chips

- [ ] **Cross-reference linking between verses**
  - Link notes to multiple verse ranges
  - "Related notes" suggestions
  - Bidirectional linking

## Medium Priority

- [ ] **Multiple Bible translations**
  - Currently using WEB (World English Bible) via bible-api.com
  - Add translation selector in UI
  - Consider local Bible text storage for offline use

- [ ] **AI integration API**
  - Endpoint for Claude Cowork / external tools
  - Structured access to notes and verse context
  - Query interface for study assistance

- [ ] **UI refresh and improvements**
  - Improved mobile experience
  - Keyboard navigation
  - Better note organization views

## Packaging & Distribution

- [ ] **StartOS `.s9pk` package**
  - Self-hosted deployment option
  - Automatic backups
  - Service discovery

- [ ] **Mac App wrapper**
  - Electron or Tauri
  - Menu bar integration
  - Native notifications

## Completed

_None yet_

## Tests

Current: 480 tests, 60.7% coverage

### 0% Coverage (Need Tests)

- [ ] **ThemeContext.jsx**
  - Theme persistence to localStorage
  - System preference detection
  - Toggle between light/dark

- [ ] **ResizableDivider.jsx**
  - Mouse drag to resize
  - Min/max constraints
  - Touch support

- [ ] **bibleApi.js service**
  - Fetch chapter from API
  - Caching behavior
  - Error handling / retry logic
  - Rate limiting

- [ ] **notesService.js**
  - All CRUD operations
  - Error handling

- [ ] **App.jsx**
  - Component composition
  - Provider wrapping

### Improve Existing Coverage

- [ ] **SettingsModal.jsx** (74.5% → 90%+)
  - File import handling
  - Network error scenarios

- [ ] **NotesContext.jsx** (71.6% → 90%+)
  - Polling for external changes
  - Optimistic updates

- [ ] **ChapterView.jsx** (84% → 95%+)
  - IntersectionObserver callbacks
  - Scroll behavior

### E2E Tests (Playwright)

- [ ] **Web workflow tests**
  - Navigate chapters
  - Create/edit/delete notes
  - Search functionality
  - Theme toggle

- [ ] **Electron app tests**
  - App launches correctly
  - Embedded server responds
  - Database in correct location

- [ ] **Mac build verification**
  - DMG installs properly
  - App runs from /Applications

---

## Ideas / Backlog

- Verse highlighting/bookmarking
- Reading plans
- Note templates
- Export to PDF/Word
- Collaborative notes (multi-user)
- Audio Bible integration
