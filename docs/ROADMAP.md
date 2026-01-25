# SACRED Roadmap

## High Priority

- [x] **Full-text search across notes** ✓ v0.0.5
  - SQLite FTS5 with ranked results
  - Highlighted snippets in search modal
  - Cmd+K keyboard shortcut

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

- [x] **Multiple Bible translations** ✓ v0.0.10
  - ESV (English Standard Version) via api.esv.org with API key
  - WEB (World English Bible) via bible-api.com (public domain)
  - Translation selector in Settings modal
  - Per-translation caching in localStorage
  - Clear Bible Cache button for troubleshooting

- [x] **Offline Bible support** ✓ v0.1.0
  - Complete WEB Bible (~6MB) bundled with Electron app
  - All 1,189 chapters available offline
  - Local-first loading with API fallback
  - ESV remains online-only (copyright)

- [x] **AI integration API** ✓ v0.1.0
  - 72 MCP tools for Claude integration
  - Token-efficient metadata-only tools
  - Sermon preparation bundle tools
  - Study session tracking

- [x] **Scroll-to-Match Navigation** ✓ v0.2.0
  - Scroll to verse when navigating from search
  - Temporary highlight animation on matched verse
  - Focus editor when opening note from search

- [x] **Sermon Series Management** ✓ v0.2.0
  - Group sermons into named series
  - Series selector dropdown in NoteEditor for sermon type
  - Series browser in Topics sidebar under Browse by Tag
  - Edit and delete series directly from sidebar
  - Full CRUD API and 5 MCP tools

- [x] **Illustration Duplicate Detection** ✓ v0.2.0
  - MD5-based text signatures for illustration matching
  - MCP tools to check for and find duplicates

- [x] **Inline Clear Buttons** ✓ v0.2.0
  - Remove primary topic with × button
  - Remove secondary tags with removable tag chips
  - Remove series assignment with × button

- [x] **Alphabetical Topic Sorting** ✓ v0.2.0
  - Topics sorted A-Z in sidebar tree
  - Locale-aware sorting for internationalization

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

- **v0.2.0** - Scroll-to-match navigation, sermon series management, inline clear buttons, alphabetical topic sorting, illustration duplicate detection, token-efficient MCP tools
- **v0.1.0** - Offline WEB Bible support, illustrations browser in sidebar
- **v0.0.10** - ESV Bible translation support with translation selector in Settings
- **v0.0.8** - Note type indicators in right panel, systematic theology backup, resizable sidebar
- **v0.0.7** - Systematic Theology integration with note linking, MCP tools, auto-restore
- **v0.0.6** - Visual note type distinction, independent scrolling, Mac app fixes
- **v0.0.5** - Inline tagging system with Browse by Tag
- **v0.0.4** - Hierarchical topics system and sidebar redesign
- **v0.0.3** - Mac App (Electron) with DMG distribution

## Tests

Current: 1171 tests | Run `npm run test:coverage` for latest metrics

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
