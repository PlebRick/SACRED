# SACRED

A personal Bible study app with rich text notes, commentary, and sermon management.

## Features

- **Bible Reader** — Navigate books and chapters with clean, readable typography
- **Rich Text Notes** — Attach notes to verse ranges using a full-featured editor
- **Note Types** — Organize as notes, commentary, or sermons
- **Dark/Light Theme** — Respects system preference
- **Export/Import** — Backup and restore your notes as JSON
- **Self-Hosted** — Your data stays on your machine
- **Claude Integration** — MCP server for AI-assisted Bible study

## Quick Start

```bash
# Install dependencies
npm install

# Development (run in two terminals)
npm run dev          # Frontend at http://localhost:3000
npm run dev:server   # Backend at http://localhost:3001
```

## Production

```bash
# Build and run
npm run build && npm start
```

Or with Docker:

```bash
docker-compose up
```

## Mac App

Build a native Mac app (.dmg):

```bash
npm run electron:build
```

The app will be created at `release/SACRED-*.dmg`. Database is stored at:
```
~/Library/Application Support/sacred/sacred.db
```

## Claude Integration (MCP)

SACRED includes an MCP server that lets Claude read and write your Bible notes directly.

### Setup for Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sacred-bible-notes": {
      "command": "node",
      "args": ["/path/to/Sacred/mcp/build/index.js"],
      "env": {
        "DB_PATH": "/path/to/Library/Application Support/sacred/sacred.db"
      }
    }
  }
}
```

### Setup for Claude Code

Create `.mcp.json` in the Sacred project directory (this file is gitignored):

```json
{
  "mcpServers": {
    "sacred-bible-notes": {
      "command": "node",
      "args": ["/path/to/Sacred/mcp/build/index.js"],
      "env": {
        "DB_PATH": "/path/to/Library/Application Support/sacred/sacred.db"
      }
    }
  }
}
```

See [mcp/README.md](mcp/README.md) for detailed setup, available tools, and example prompts.

### Database Path

- **Mac App**: `~/Library/Application Support/sacred/sacred.db`
- **Development**: `./data/sacred.db`
- **Docker**: `/app/data/sacred.db`

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, CSS Modules |
| Editor | Tiptap |
| Backend | Express 5 |
| Database | SQLite (better-sqlite3) |
| Desktop | Electron |
| AI | MCP Server |

## Project Structure

```
SACRED/
├── src/           # React frontend
├── server/        # Express backend
├── electron/      # Electron main process
├── mcp/           # MCP server for Claude
├── build/         # App icons and entitlements
├── data/          # SQLite database (dev)
└── docs/          # Documentation
```

## Documentation

- [Roadmap](docs/ROADMAP.md) — Planned features
- [Testing](docs/TESTING.md) — Test workflows
- [Changelog](docs/CHANGELOG.md) — Version history

## License

[MIT](LICENSE)
