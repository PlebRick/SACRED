# SACRED

A personal Bible study app with rich text notes, commentary, and sermon management.

## Features

- **Bible Reader** — Navigate books and chapters with clean, readable typography
- **Rich Text Notes** — Attach notes to verse ranges using a full-featured editor
- **Note Types** — Organize as notes, commentary, or sermons
- **Hierarchical Topics** — Organize notes with parent-child topic categories
- **Inline Tagging** — Highlight text and tag as Illustration, Application, Key Point, Quote, or Cross-Reference
- **Browse by Tag** — View all tagged content across notes from the sidebar
- **Dark/Light Theme** — Respects system preference with highlight visibility toggle
- **Mac App** — Native desktop app with local database
- **Web Hosting** — Deploy with Docker to Railway, Render, or self-host
- **Export/Import** — Backup and restore notes, topics, and tag types as JSON
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

## Mac App

Build a native Mac app (.dmg):

```bash
npm run electron:build
```

The app will be created at `release/SACRED-*.dmg`. Database is stored at:
```
~/Library/Application Support/sacred/sacred.db
```

## Web Hosting (Docker)

Deploy SACRED as a web app on Railway, Render, or any Docker host.

### Quick Deploy to Railway

1. Fork this repo (or use a private copy with your data)
2. Connect Railway to your GitHub repo
3. Add environment variables:
   - `AUTH_PASSWORD` — Required, your login password
   - `ESV_API_KEY` — Optional, for ESV translation
4. Add a volume mounted at `/app/data`
5. Railway auto-deploys on push

### Local Docker

```bash
# Build image
npm run docker:build

# Run container
docker run -p 3000:3000 \
  -e AUTH_PASSWORD=your-password \
  -v sacred-data:/app/data \
  sacred
```

Visit http://localhost:3000 and log in with your password.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH_PASSWORD` | Yes | Password for web access |
| `ESV_API_KEY` | No | ESV Bible API key ([get one](https://api.esv.org/)) |
| `PORT` | No | Server port (default: 3000) |
| `DB_PATH` | No | Database path (default: /app/data/sacred.db) |

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
- **Docker**: `/app/data/sacred.db` (mount a volume here)
- **Development**: `./data/sacred.db`

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
