# Systematic Theology Feature Implementation Prompt

Use this prompt to start a fresh Claude Code session in **plan mode** to implement the Systematic Theology integration feature for SACRED.

---

## Prompt

```
I need you to implement a major new feature for my SACRED Bible study app: Systematic Theology integration. This is a comprehensive reference system that integrates Wayne Grudem's Systematic Theology into the app for sermon preparation.

**IMPORTANT: Enter plan mode first.** This is a large, multi-phase implementation that requires careful planning before any code is written.

## Project Context

SACRED is a personal Bible study app built with:
- Frontend: React 18, Vite, CSS Modules, Tiptap (rich text editor)
- Backend: Express 5 (CommonJS .cjs files)
- Database: SQLite (better-sqlite3)
- State: React Context + useReducer
- Desktop: Electron for Mac app

Read `CLAUDE.md` for full project conventions and structure.

## Feature Specification

Read the complete, detailed plan at: `myfiles/grudem-plan.md`

This document contains:
- All architectural decisions (10 resolved questions)
- Complete database schema (6 new tables)
- All API endpoints
- All MCP tools for Claude integration
- All UI components with detailed specs
- 8 additional features (summaries, bidirectional linking, annotations, etc.)
- Import script strategy with HTML parsing details
- 7 implementation phases

## Source Content

HTML files exported from Logos Bible Software are located at:
`myfiles/grudem-systematic-theology/`

These files contain the full book content with:
- Structured HTML (parts, chapters, sections, sub-sections)
- Scripture references already linked: `<a href="logosref:Bible.Jn1.1">John 1:1</a>`
- Page markers to strip
- Standard sections (Questions, Bibliography, Hymns, etc.)

## Key Decisions Summary

1. **Separate table** - Not using existing topics system
2. **Slide-over panel** - Overlays notes panel, Bible stays visible
3. **Link syntax** - `[[ST:Ch32]]`, `[[ST:Ch32:A]]`, `[[ST:Ch32:B.1]]`
4. **Maximum granularity** - Sections AND sub-sections as separate entries
5. **Auto-suggest** - Collapsible "Related Doctrines" section at top of Notes panel
6. **Scripture links** - Convert Logos refs to clickable internal links during import
7. **AI summaries** - Generated during import via Claude API
8. **Auto-tags** - Based on Part structure, editable
9. **Primary verses** - Auto-detect first 3-5 per chapter, manual override available
10. **Keyboard shortcut** - Cmd+Shift+D for quick doctrine insert

## Implementation Requirements

### Phase Approach
Implement in discrete, testable phases. After each phase:
1. Run existing tests to ensure no regressions
2. Test the new functionality manually
3. Commit with clear message
4. Only proceed to next phase if current phase is stable

### Phase 1: Database Schema
- Create migration script
- Create all 6 tables with indexes
- Verify schema with test queries
- DO NOT proceed until schema is verified

### Phase 2: Import Script
- Build `scripts/import-systematic-theology.cjs`
- Parse HTML structure (parts, chapters, sections, sub-sections)
- Extract and convert scripture references
- Generate summaries via Claude API
- Auto-assign tags
- Mark primary verses
- Parse "see chapter" cross-references
- Test with sample chapters first before full import

### Phase 3: API Endpoints
- Build all endpoints in `server/routes/systematic.cjs`
- Test each endpoint with curl/Postman
- Ensure proper error handling

### Phase 4: MCP Tools
- Add tools to existing MCP server
- Test each tool independently

### Phase 5: UI - Core Components
- Sidebar tab with tree view
- Slide-over panel component
- "Related Doctrines" collapsible section in NotesPanel
- Test navigation and state management

### Phase 6: Note Editor Integration
- Link syntax parser for `[[ST:ChX]]`
- Render links with tooltips
- Quick insert modal
- Keyboard shortcut (Cmd+Shift+D)

### Phase 7: Enhanced Features
- Bidirectional linking
- Personal annotations (highlight colors: yellow, green, blue, pink)
- "See Also" related chapters
- Tag filtering in sidebar

### Phase 8: Polish & Testing
- End-to-end testing of full workflow
- Performance testing with full content
- Edge case handling
- Documentation updates

## Safety Requirements

1. **Read before write** - Always read existing files before modifying
2. **No breaking changes** - Existing notes, topics, and Bible features must continue working
3. **Incremental commits** - Commit after each working phase
4. **Test coverage** - Run `npm test` after each phase
5. **Build verification** - Run `npm run build` to catch TypeScript/build errors
6. **Electron testing** - Test Mac app build after UI changes

## Files to Read First

Before planning, read these files to understand existing patterns:
1. `CLAUDE.md` - Project conventions
2. `myfiles/grudem-plan.md` - Complete feature specification
3. `server/routes/notes.cjs` - Existing route patterns
4. `server/db.cjs` - Database setup patterns
5. `src/context/NotesContext.jsx` - Context patterns
6. `src/components/Notes/NotesPanel.jsx` - Panel component patterns
7. `src/components/Layout/Sidebar.jsx` - Sidebar tab patterns
8. One sample HTML file from `myfiles/grudem-systematic-theology/` - Import format

## Questions to Consider in Planning

1. How will the slide-over panel state be managed? New context or extend existing?
2. How will scripture link clicks be handled across components?
3. What's the API rate limiting strategy for AI summary generation during import?
4. How to handle import failures gracefully (partial import recovery)?
5. How to ensure Electron build includes new routes?

## Output Expected

After entering plan mode:
1. Read all specified files
2. Create a detailed implementation plan with specific file changes
3. Identify any potential conflicts or risks
4. Propose a testing strategy for each phase
5. Ask clarifying questions if anything in the spec is ambiguous
6. Exit plan mode only when you have a complete, safe implementation strategy

Remember: This is a large feature. Take time to plan thoroughly. Better to spend more time planning than to introduce bugs or regressions.
```

---

## Usage Instructions

1. Start a new Claude Code session
2. Copy the prompt above
3. Paste it as your first message
4. Claude will enter plan mode and read all relevant files
5. Review the proposed plan before approving implementation
6. Implement phase by phase with testing between each

## Files Required

Ensure these exist before starting:
- [x] `CLAUDE.md` - Project documentation
- [x] `myfiles/grudem-plan.md` - Feature specification
- [x] `myfiles/grudem-systematic-theology/` - HTML source files (all chapters)

## Estimated Scope

- **Tables**: 6 new SQLite tables
- **API Endpoints**: ~12 new endpoints
- **MCP Tools**: 6 new tools
- **React Components**: ~8 new components
- **Context**: 1 new context (SystematicTheologyContext)
- **Import Script**: 1 complex parsing script

## Notes

- The import script will make Claude API calls for summaries - budget for API costs
- Full import of 57 chapters with sections/sub-sections may take time
- Test with a few chapters first before full import
- Keep the `myfiles/grudem-systematic-theology/` folder gitignored
