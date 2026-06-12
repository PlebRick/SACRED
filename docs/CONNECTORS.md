# SACRED Connectors — Write Your Own Tools with Claude

SACRED can load any [MCP](https://modelcontextprotocol.io) server as a **connector**.
A connector adds tools to SACRED: they appear in **Settings → Connectors**, can be
invoked from the app, and are automatically available to the in-app AI Study
Assistant during sermon prep.

You don't need to know how to code. **Copy this entire document into a Claude
conversation** and say what you want, for example:

> "Using the guide I pasted, build me a SACRED connector that looks up
> Matthew Henry's commentary from my JSON file at ~/commentaries/henry.json"

Claude will generate a single file you drop into the `connectors/` folder.

---

## What Claude needs to know (the spec)

### Requirements for a SACRED connector

1. It is an **MCP server over stdio**: a single Node.js script using
   `@modelcontextprotocol/sdk`. SACRED spawns it on demand and talks MCP to it.
2. Use the **`.cjs` extension** and CommonJS (`require`) — the SACRED repo is
   ESM at the root, so `.cjs` avoids module-type conflicts.
3. The SDK and `zod` are already installed in the SACRED repo. If the file lives
   anywhere under the SACRED folder, `require('@modelcontextprotocol/sdk/...')`
   and `require('zod')` resolve with no install step.
4. Tools should return **text content** (markdown welcome — SACRED renders it).
5. Never write to stdout except via the MCP transport (no `console.log`;
   use `console.error` for debugging — it goes to stderr).

### Template

```javascript
#!/usr/bin/env node
// <name>: <what this connector does>
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');

const server = new McpServer({ name: '<connector-name>', version: '1.0.0' });

server.tool(
  '<tool_name>',                          // snake_case
  '<one-line description Claude/SACRED shows the user>',
  { query: z.string().describe('<what to pass>') },   // zod params
  async ({ query }) => {
    // ... do the work: read a local file, call a public API, compute ...
    return { content: [{ type: 'text', text: 'result here' }] };
  }
);

// Add more server.tool(...) calls as needed

const transport = new StdioServerTransport();
server.connect(transport);
```

A complete working example ships at
`connectors/examples/hymn-suggestions/index.cjs` (hymn suggestions by sermon
topic). Read it for the exact style.

### Things connectors are great at

- **Local resources**: search a folder of PDFs/EPUBs/JSON (commentaries,
  lexicons, old sermon manuscripts) — Node has full filesystem access
- **Public APIs**: fetch from web APIs (use global `fetch`, available in Node 18+)
- **Reference data**: embed small datasets directly in the file (hymns,
  liturgical calendar, Greek/Hebrew word lists)
- **Computations**: reading-time estimates, scripture-reference parsing, text stats

---

## Installing a connector in SACRED

1. Save the file under the SACRED folder, e.g. `connectors/my-connector/index.cjs`
2. Open SACRED → **Settings → Connectors → Add Connector**
   - **Name**: anything you like
   - **Transport**: `stdio`
   - **Command**: `node`
   - **Args**: `connectors/my-connector/index.cjs`
     (one arg per line in the UI; paths are relative to the SACRED folder, or absolute)
3. Click **Test** — you should see the tool list
4. The tools are now available in the Connectors panel and to the AI assistant

### HTTP connectors

If you run a long-lived MCP server elsewhere (another machine, a Docker
container), choose transport `http` and give SACRED the URL. SACRED uses the
MCP Streamable HTTP transport.

### Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| Test fails instantly | Wrong path in Args, or syntax error — run `node <path>` manually and check stderr |
| "Connect timed out" | The script printed to stdout before the MCP handshake (remove `console.log`) |
| Tools list but calls fail | The tool threw — wrap the handler body in try/catch and return the error as text |
| Works in terminal, not in the Mac app | Use absolute paths; the app's working directory differs from your shell |

### Security note

Connectors run as local processes with your user's permissions. Only install
connectors you wrote or reviewed.
