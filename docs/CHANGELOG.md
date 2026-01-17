# SACRED Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
