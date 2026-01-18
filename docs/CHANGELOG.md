# SACRED Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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

## [Unreleased]

### Added
- Initial release of SACRED Bible study app
- Bible reader with chapter navigation
- Rich text note editor (Tiptap)
- Notes attached to verse ranges (single verse, multi-verse, multi-chapter)
- Note types: note, commentary, sermon
- Dark/light theme with system preference detection
- Export/import notes as JSON
- Docker deployment support
- Resizable sidebar panel

### Technical
- React 18 frontend with Vite
- Express 5 backend (CommonJS)
- SQLite database with better-sqlite3
- CSS Modules for styling
- Context-based state management

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
