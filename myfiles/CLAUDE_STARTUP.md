# SACRED Bible Study - Claude Startup Prompt

Copy and paste this prompt into a new Claude chat to get started:

---

## Startup Prompt

```
I'm working on my SACRED Bible study app. Please help me get everything running and ready for Bible study.

1. Start the backend server (port 3001) and frontend dev server (port 3000)
2. Verify the MCP tools are working by listing my current notes
3. Give me a summary of what notes I have

Once everything is running, I'd like to:
- Study the Bible and create notes on passages
- Search my existing notes
- Edit or organize my notes

The app should be at http://localhost:3000 when ready.
```

---

## Quick Commands

**Start servers manually:**
```bash
cd /Users/b1ackswan/code/Sacred
PORT=3001 node server/index.cjs &   # Backend
npm run dev &                        # Frontend
```

**Test MCP is working:**
```bash
cd /Users/b1ackswan/code/Sacred/mcp
node -e "import('./build/index.js')" 2>&1
```

**Rebuild MCP after changes:**
```bash
cd /Users/b1ackswan/code/Sacred/mcp && npm run build
```

---

## Available MCP Tools

| Tool | What it does |
|------|--------------|
| `list_notes` | List all notes (paginated) |
| `get_note` | Get a single note by ID |
| `get_chapter_notes` | Get notes for a book/chapter |
| `get_notes_summary` | Statistics about your notes |
| `create_note` | Create a new note |
| `update_note` | Update an existing note |
| `delete_note` | Delete a note |
| `search_notes` | Full-text search |
| `export_notes` | Export all notes as JSON |
| `import_notes` | Import notes from JSON |
| `get_books_with_notes` | Summary of books with notes |

---

## Example Requests

- "Create a note on Romans 8:28-30 about predestination"
- "What notes do I have in the Gospel of John?"
- "Search my notes for 'grace'"
- "Show me my recent notes"
- "Export all my notes"
