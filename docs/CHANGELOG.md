# SACRED Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- **Note Type Indicators in Right Panel**: Visual indicators showing note type (note, commentary, sermon) in NoteCard and NoteEditor
  - NoteCard: Shows type icon badge and colored left border accent
  - NoteEditor: Shows type badge with label in header
  - New reusable `NoteTypeIndicator` component using existing CSS variables
- **Systematic Theology Backup/Restore**: Full data management in Settings
  - Export: Download all doctrine data as JSON (`sacred-systematic-theology-YYYY-MM-DD.json`)
  - Import: Load doctrine data from JSON file (already existed)
  - Delete All: Remove all doctrine data with confirmation (warns about annotation loss)
  - Separate from Notes backup for cleaner data management

### Fixed
- Scripture search now accepts book names without chapter (e.g., "John" → John 1)

---

## [0.0.7] - 2026-01-22

### Added

#### Systematic Theology Integration
- **Doctrine Sidebar Tab**: New "Doctrine" tab in sidebar with hierarchical tree view
  - Parts → Chapters → Sections → Subsections navigation
  - Expandable/collapsible chapters with chevron icons
  - "Expand All | Collapse All" controls
  - Full-text search across all doctrine content
  - Filter by 7 category tags (Doctrine of God, Christ, Holy Spirit, etc.)

- **Doctrine Panel**: Slide-over panel for viewing doctrine content
  - Full chapter content with sections
  - Scripture references with clickable links
  - Related chapters ("See Also") navigation
  - Personal highlight annotations with color picker
  - "Your Highlights" section with delete capability
  - Bidirectional linking: shows notes that reference this doctrine

- **Note ↔ Doctrine Linking**:
  - Insert Doctrine Link modal (`Cmd+Shift+D` or toolbar book icon)
  - Search doctrines by title or content
  - Auto-link syntax: type or paste `[[ST:Ch32]]` → clickable link
  - Link granularity: chapter, section, or subsection (`[[ST:Ch32:A.1]]`)
  - Hover tooltips showing doctrine title

- **Related Doctrines in Notes Panel**: Auto-populated suggestions based on current Bible chapter's scripture index

- **MCP Tools for Claude**: 7 new tools for AI-assisted study
  - `search_systematic_theology` - Full-text search
  - `get_systematic_section` - Get by reference
  - `find_doctrines_for_passage` - Doctrines citing a passage
  - `summarize_doctrine_for_sermon` - Sermon prep summary
  - `extract_doctrines_from_note` - Suggest related doctrines
  - `explain_doctrine_simply` - Jargon-free explanation
  - `get_systematic_summary` - Statistics

#### Note Editor Enhancements
- **Cross-Reference Navigation**: Cross-ref inline tags now navigate to Bible text when clicked
- **Inline Highlight Rendering**: User highlights on doctrine content display inline with saved colors
- **Paste-to-Link**: Pasting `[[ST:ChX]]` syntax auto-converts to clickable link

### Technical
- 8 new database tables for systematic theology (entries, scripture index, annotations, tags, related, FTS5)
- Auto-restore mechanism in Electron: imports bundled JSON on first launch
- `extraResources` build config for bundling data without committing to git
- Foreign key constraint handling for bulk imports
- Debug endpoints for troubleshooting (`/api/debug/systematic-status`, `/api/debug/restore-systematic`)

### Fixed
- Electron build now includes systematic theology routes
- FK constraint errors during data import (disabled during bulk operations)

---

## [0.0.6] - 2026-01-19

### Added
- **Visual Distinction for Note Types**: Color coding and icons to distinguish notes, commentaries, and sermons
  - Sidebar tree: Each note shows a colored icon badge (blue pencil for notes, green book for commentaries, purple microphone for sermons)
  - Section tabs: Active tab displays type-specific color and icon
  - Colors adapt to light/dark theme
  - New CSS variables: `--type-note`, `--type-commentary`, `--type-sermon` with background variants
- **Developer Experience**: `npm run dev:all` script to start both servers with auto port cleanup

### Fixed
- Import failing with "413 Payload Too Large" for larger backup files (increased limit to 100MB)
- Notes now sorted by verse range in NotesPanel (was incorrectly sorted by last updated)
- Sidebar, Bible reader, and Notes panel now scroll independently
- Mac app: Window can now be dragged by header, hamburger menu moved away from traffic lights
- Mac app: Import backup now works (was missing body size limit in Electron server)

---

## [0.0.5] - 2026-01-18

### Added
- **Inline Tagging System**: Highlight text within notes and apply semantic tags
  - 5 default tag types: Illustration, Application, Key Point, Quote, Cross-Reference
  - Custom tag type creation with name, icon (emoji), and color
  - Tag dropdown in editor toolbar for applying/removing tags
  - Visual highlighting with tag-specific colors
- **Browse by Tag**: New section in Topics sidebar
  - View all tagged content grouped by tag type
  - Search within tagged content
  - Click to navigate directly to tagged note
- **Highlight Visibility Toggle**: Eye icon in header to hide/show inline tag highlights for distraction-free reading
- **Test Data Seeding**: Script to populate database with sample data (`scripts/seedTestData.cjs`)

### Fixed
- Note editor content mixing when switching between notes without closing first

### Technical
- New `inline_tag_types` table for tag type definitions
- New `inline_tags` table for extracted tag instances (enables search/browse)
- Tiptap Mark extension (`InlineTagMark.js`) for inline tag rendering
- Server-side HTML parsing with jsdom to extract tags on note save
- New InlineTagsContext for tag state management
- New inline-tags API endpoints (types CRUD, browse, search)
- Highlight visibility preference persisted to localStorage

---

## [0.0.4] - 2025-01-18

### Added
- **Hierarchical Topics System**: Organize notes by theological and practical categories
  - Topics with parent-child hierarchy (fully customizable)
  - Primary topic + secondary tags on notes
  - Default topic seeding (Systematic Theology, Practical, Resources)
- **Redesigned Sidebar Navigation**: 3-tab structure (Books, Notes, Topics)
  - **Notes tab**: Bible-structured view showing all 66 books (empty ones dimmed)
  - **Topics tab**: Tree view with expand/collapse, note counts, inline CRUD
- **New Components**:
  - TopicsTree: Hierarchical topic browser
  - NotesTree: Bible-structured notes navigation
  - TopicSelector: Searchable dropdown with inline topic creation

### Changed
- AddNoteModal now includes topic selection
- NoteEditor has collapsible topic editing section
- Backup export/import format updated to v2 (includes topics)

### Technical
- New `topics` table with parent_id for hierarchy
- New `note_tags` junction table for secondary tags
- Added `primary_topic_id` column to notes table
- New TopicsContext for state management
- New topics API endpoints (CRUD + seeding)

---

## Version History Format

When releasing versions, use this format:

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- New features

### Changed
- Changes to existing functionality

### Deprecated
- Features to be removed in future

### Removed
- Removed features

### Fixed
- Bug fixes

### Security
- Security fixes
```
