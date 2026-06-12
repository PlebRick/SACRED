# SACRED v0.4.0 — "The Study" Overhaul

## Vision

SACRED's defensible value is not Bible/doctrine content retrieval (AI commoditizes that) —
it is the **personal corpus** (notes, sermons, illustrations, annotations, study history)
combined with AI workflows grounded in that corpus. v0.4.0 turns SACRED from a note-taking
app into a personal ministry intelligence platform.

## Features

### 1. Pulpit Coverage Dashboard
A full-screen view answering "what has my congregation heard?"

- **Scripture heatmap**: all 66 books × chapters, colored by note/sermon density
- **Doctrine coverage**: Grudem's 57 chapters — which doctrines have linked notes/sermons, which are untouched
- **Topic frequency**: most/least visited topics
- **Illustration reuse**: duplicate illustrations across sermons
- **Series timeline**: sermon series over time

Server: `GET /api/coverage` (single aggregated payload, pure SQL).
Client: `src/components/Dashboard/CoverageDashboard.jsx`, reachable via Header button + Cmd+K.
View switching: lightweight `view` state in `App.jsx` (`reader` | `dashboard`), no router.

### 2. Command Palette (Cmd+K)
One keystroke to anything:

- Jump to book/chapter ("rom 8" → Romans 8)
- Search notes (FTS) and doctrines inline
- Actions: new note, open dashboard, toggle theme, open assistant, open settings, manage connectors

`src/components/CommandPalette/CommandPalette.jsx`, modeled on NoteSearch overlay pattern.
Action registry so new features self-register.

### 3. MCP Connector System
User writes an MCP server (with Claude's help), drops it in, SACRED picks it up.

- `connectors` table: id, name, description, transport (`stdio`|`http`), command/args or url, enabled
- `server/connectors/manager.cjs`: MCP **client host** using `@modelcontextprotocol/sdk`
  - spawn/connect on demand, cache clients, list tools, invoke tool, health status
- Routes: `GET/POST/PUT/DELETE /api/connectors`, `GET /api/connectors/:id/tools`,
  `POST /api/connectors/:id/tools/:tool` (invoke)
- UI: Settings → Connectors tab (add/edit/test/enable), tool browser with invoke + insert-into-note
- `docs/CONNECTORS.md`: a guide written *for Claude* — paste it into a Claude chat and say
  "build me a connector that does X", get back a compatible server
- `connectors/examples/`: a working sample connector (public-domain commentary lookup style)

### 4. In-App AI Study Assistant
Claude inside SACRED, grounded in the corpus, extensible via connectors.

- `server/routes/assistant.cjs`: Anthropic Messages API with tool use + SSE streaming
- Tools: internal (search notes, get chapter notes, search doctrine, similar sermons,
  illustrations, study sessions, create/update note) + all enabled connector tools
- UI: slide-over Assistant panel (chat, streaming, tool-call activity shown inline,
  "save as note/sermon" on any response)
- Requires `ANTHROPIC_API_KEY` in `.env`; without it the panel shows setup instructions
- `GET /api/assistant/status` reports availability

### 5. Auto-Enrichment on Save
The corpus compounds without manual effort.

- On sermon/commentary save (when API key present): async job suggests
  untagged illustrations/applications, doctrine links, topics
- `note_suggestions` table; suggestions surface in NoteEditor as accept/dismiss chips
- Without API key: feature silently absent

### 6. UI Polish
- Persisted panel widths (localStorage)
- Reader typography options, smoother transitions, better empty states
- Keyboard navigation improvements

## Sequencing

1. Coverage dashboard (no new deps, immediate value)
2. Command palette
3. Connector system
4. Assistant (depends on connectors for tool surface)
5. Enrichment (depends on assistant infra)
6. Polish, tests, docs

## New Dependencies

- `@modelcontextprotocol/sdk` (server, CJS build)
- `@anthropic-ai/sdk` (server)

## Compatibility

- All features additive; schema changes via existing migration pattern in `db.cjs`
- App fully functional without `ANTHROPIC_API_KEY` (assistant/enrichment degrade gracefully)
- Electron + Docker + dev all supported
