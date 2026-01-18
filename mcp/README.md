# SACRED MCP Server

An MCP (Model Context Protocol) server that enables Claude to read, create, and manage your SACRED Bible study notes directly.

## What is MCP?

MCP allows Claude to interact with external tools and data sources. With the SACRED MCP server, Claude can:

- **Read your notes** — Search and retrieve notes by book, chapter, or keyword
- **Create notes** — Write study notes, commentary, or sermon outlines attached to verse ranges
- **Update notes** — Edit existing notes with new insights
- **Organize** — Help you categorize and summarize your Bible study material

## Setup

### 1. Build the MCP Server

```bash
cd mcp
npm install
npm run build
```

### 2. Configure Claude

#### For Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sacred-bible-notes": {
      "command": "node",
      "args": ["/full/path/to/Sacred/mcp/build/index.js"],
      "env": {
        "DB_PATH": "/Users/YOURUSERNAME/Library/Application Support/sacred/sacred.db"
      }
    }
  }
}
```

#### For Claude Code

Create `.mcp.json` in the Sacred project root:

```json
{
  "mcpServers": {
    "sacred-bible-notes": {
      "command": "node",
      "args": ["/full/path/to/Sacred/mcp/build/index.js"],
      "env": {
        "DB_PATH": "/Users/YOURUSERNAME/Library/Application Support/sacred/sacred.db"
      }
    }
  }
}
```

> **Note:** Replace `/full/path/to/Sacred` and `YOURUSERNAME` with your actual paths.

### 3. Restart Claude

Restart Claude Desktop or Claude Code for the MCP server to connect.

## Database Paths

| Environment | Database Location |
|-------------|-------------------|
| Mac App | `~/Library/Application Support/sacred/sacred.db` |
| Development | `./data/sacred.db` |

## Available Tools

| Tool | Description |
|------|-------------|
| `create_note` | Create a new note attached to a verse range |
| `get_note` | Retrieve a single note by ID |
| `update_note` | Update an existing note |
| `delete_note` | Delete a note |
| `list_notes` | List all notes with pagination |
| `get_chapter_notes` | Get all notes for a specific chapter |
| `search_notes` | Full-text search across titles and content |
| `get_notes_summary` | Statistics about your notes collection |
| `get_books_with_notes` | List books that have notes |
| `export_notes` | Export all notes as JSON |
| `import_notes` | Import notes from JSON |

## Example Prompts

Copy and use these prompts with Claude to enhance your Bible study:

---

### Study Note Creation

```
Create a study note on Romans 8:28-30 exploring the golden chain of salvation.
Include cross-references and explain how each link (foreknew, predestined,
called, justified, glorified) connects to the others.
```

```
Write a note on John 1:1-14 examining the theological significance of "the Word
became flesh." Compare this with Old Testament theophanies and explain what
makes the Incarnation unique.
```

```
Create a character study note on the Apostle Peter covering his journey from
Matthew 16:16-23 through John 21:15-19. Attach it to Matthew 16:16.
```

---

### Sermon Preparation

```
Help me prepare a sermon outline on Ephesians 2:1-10. Structure it with:
- Introduction hook
- 3 main points with supporting verses
- Illustrations for each point
- Application questions
- Conclusion

Save it as a sermon note attached to Ephesians 2:1-10.
```

```
I'm preaching on the Beatitudes (Matthew 5:3-12). Create a sermon note that
explains each beatitude's meaning in its original context and how it applies
to believers today.
```

---

### Research & Analysis

```
Search my notes for everything related to "justification" and create a summary
note that synthesizes my previous thoughts on this doctrine.
```

```
Look at all my notes in the book of Romans and identify recurring themes.
Create a new note that maps out the theological structure of my Romans study.
```

```
Find my notes on prayer across all books and compile them into a topical
study note on "Biblical Principles of Prayer."
```

---

### Comparative Study

```
Create a note comparing the resurrection accounts in all four Gospels
(Matthew 28, Mark 16, Luke 24, John 20). Highlight unique details each
Gospel writer includes and explain their theological significance.
```

```
Write a study note on Psalm 22 that traces how each section is fulfilled
in the crucifixion narratives. Include verse-by-verse connections.
```

---

### Daily Devotional

```
I'm reading through Philippians. Read my existing notes on Philippians
and suggest what themes I should focus on in chapter 3. Then create a
devotional note on Philippians 3:7-11 about knowing Christ.
```

```
What books do I have the most notes on? Show me a summary of my study
patterns and suggest which books might benefit from deeper study.
```

---

### Commentary Integration

```
Create a detailed commentary note on Hebrews 11:1 that includes:
- Original Greek word study on "faith" (pistis), "substance" (hypostasis),
  and "evidence" (elegchos)
- How this verse introduces the "Hall of Faith" chapter
- Practical applications for modern believers

Mark it as type "commentary" rather than a regular note.
```

---

## Tips for Best Results

1. **Be specific about verse ranges** — Claude can attach notes to exact verses (e.g., "Romans 8:28-30" not just "Romans 8")

2. **Specify note type** — Ask for "commentary," "sermon," or "note" to categorize properly

3. **Reference existing notes** — Ask Claude to search your notes first to build on previous study

4. **Request cross-references** — Claude can suggest related passages to enhance your study

5. **Export regularly** — Ask Claude to export your notes as backup

## Troubleshooting

### "Notes table not found"
Run the SACRED app at least once to initialize the database.

### MCP not connecting
- Check that the paths in your config are absolute paths (start with `/`)
- Verify the database file exists at the specified `DB_PATH`
- Restart Claude after config changes

### Notes not syncing
The app polls for changes every 30 seconds. Create or update a note and wait for the sync indicator to appear.

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Watch mode (rebuild on changes)
npm run watch
```

## License

[MIT](../LICENSE)
