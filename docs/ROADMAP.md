# SACRED Roadmap

## High Priority

- [ ] **Full-text search across notes**
  - Search note titles and content
  - Highlight matching terms in results
  - Consider SQLite FTS5 extension

- [x] **Tags/categories for organizing notes** ✓ v0.0.4
  - Hierarchical topics with parent-child relationships
  - Primary topic + secondary tags on notes
  - Bible-structured Notes tab and Topics tab in sidebar

- [x] **Inline tagging system** ✓ v0.0.5
  - Highlight text and apply semantic tags (Illustration, Application, Key Point, Quote, Cross-Ref)
  - Custom tag type creation
  - Browse by Tag section in sidebar
  - Highlight visibility toggle for distraction-free reading

- [x] **Systematic Theology Integration** ✓ v0.0.7
  - Doctrine sidebar with hierarchical tree (Parts → Chapters → Sections)
  - Slide-over panel for viewing doctrine content
  - Note ↔ Doctrine linking with `[[ST:Ch32]]` syntax
  - Scripture-to-doctrine cross-reference index (4800+ refs)
  - Personal highlights and annotations on doctrine text
  - 7 MCP tools for Claude integration
  - Auto-restore mechanism for bundled content

- [x] **Cross-reference linking between verses** ✓ v0.0.7 (partial)
  - Cross-ref inline tags now navigate to Bible text
  - Doctrine links provide bidirectional linking
  - Related doctrines suggestions based on scripture index

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

- [x] **Mac App wrapper** ✓ v0.0.3
  - Electron app with embedded server
  - DMG distribution (arm64)
  - Database in ~/Library/Application Support/sacred/

## Completed

- **v0.0.7** - Systematic Theology integration with note linking, MCP tools, auto-restore
- **v0.0.6** - Visual note type distinction, independent scrolling, Mac app fixes
- **v0.0.5** - Inline tagging system with Browse by Tag
- **v0.0.4** - Hierarchical topics system and sidebar redesign
- **v0.0.3** - Mac App (Electron) with DMG distribution

## Tests

Current: 520 tests, 46.9% line coverage

*Note: Coverage % decreased due to new topics system code. Key new files have excellent coverage.*

### Well Covered (90%+)
- [x] **topicsService.js** - 100%
- [x] **TopicsContext.jsx** - 98.7%
- [x] **BibleContext.jsx** - 95.6%
- [x] **Sidebar.jsx** - 94.4%
- [x] **AddNoteModal.jsx** - 100%
- [x] **NoteEditor.jsx** - 97.4%

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

- [ ] **NotesTree.jsx** (new)
  - Book/chapter expansion
  - Note navigation

- [ ] **TopicsTree.jsx** (new)
  - Topic hierarchy display
  - Inline CRUD operations

- [ ] **TopicSelector.jsx** (new)
  - Search/filter functionality
  - Inline topic creation

### Improve Existing Coverage

- [ ] **SettingsModal.jsx** (78% → 90%+)
  - File import handling
  - Network error scenarios

- [ ] **NotesContext.jsx** (71% → 90%+)
  - Polling for external changes
  - Optimistic updates

- [ ] **ChapterView.jsx** (83% → 95%+)
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
