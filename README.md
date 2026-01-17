# SACRED

A personal Bible study app with rich text notes, commentary, and sermon management.

## Features

- **Bible Reader** — Navigate books and chapters with clean, readable typography
- **Rich Text Notes** — Attach notes to verse ranges using a full-featured editor
- **Note Types** — Organize as notes, commentary, or sermons
- **Dark/Light Theme** — Respects system preference
- **Export/Import** — Backup and restore your notes as JSON
- **Self-Hosted** — Your data stays on your machine

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

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, CSS Modules |
| Editor | Tiptap |
| Backend | Express 5 |
| Database | SQLite (better-sqlite3) |

## Project Structure

```
SACRED/
├── src/           # React frontend
├── server/        # Express backend
├── data/          # SQLite database
└── docs/          # Documentation
```

## Documentation

- [Roadmap](docs/ROADMAP.md) — Planned features
- [Testing](docs/TESTING.md) — Test workflows
- [Changelog](docs/CHANGELOG.md) — Version history

## License

[MIT](LICENSE)
