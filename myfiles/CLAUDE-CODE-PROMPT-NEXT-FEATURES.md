# Claude Code Implementation Prompt: SACRED Next Features

## Overview

You are working on SACRED, a personal Bible study app built with React 18, Express 5, SQLite, and Electron. The codebase is well-structured with MCP (Model Context Protocol) integration for AI assistance.

**Before making any changes**, read these files to understand the codebase:
- `CLAUDE.md` — Project overview, structure, conventions
- `docs/ROADMAP.md` — Current feature status
- `server/db.cjs` — Database schema
- `mcp/src/tools/ai-enhanced.ts` — MCP tool patterns

**Important conventions:**
- Server files use CommonJS (`.cjs`) due to better-sqlite3
- React components use `.jsx` with co-located `.module.css`
- Database columns: `snake_case` → API responses: `camelCase`
- Always use `toApiFormat()` helper for API responses
- MCP tools return JSON stringified with 2-space indent

---

## Feature 1: Scroll-to-Match Navigation

### Problem
When searching Bible text, notes, or systematic theology, selecting a result navigates to the document/chapter but does NOT scroll to the matched text. Users must manually hunt for the match.

### Requirements

#### 1.1 Note Search → Scroll to Match
**File:** `src/components/Layout/NoteSearch.jsx`

Current `selectNote` function:
```javascript
const selectNote = (note) => {
  navigate(note.book, note.startChapter);
  setSelectedNote(note.id);
  setEditingNote(note.id);
  onClose?.();
};
```

Changes needed:
1. Pass the search query to the note editor context
2. After the Tiptap editor mounts with content, find and scroll to the matched text
3. Temporarily highlight the match (2-3 second fade)

**Add to NotesContext.jsx:**
```javascript
const [highlightQuery, setHighlightQuery] = useState(null);
```

**Create new hook:** `src/hooks/useScrollToMatch.js`
```javascript
import { useEffect, useRef } from 'react';

/**
 * Scrolls to and highlights matched text within a scrollable container
 * @param {string} query - Text to find and scroll to
 * @param {HTMLElement} containerRef - Scrollable container element
 * @param {boolean} isReady - Whether content is loaded and ready
 */
export function useScrollToMatch(query, containerRef, isReady) {
  const highlightRef = useRef(null);

  useEffect(() => {
    if (!query || !isReady || !containerRef?.current) return;

    // Wait for DOM to settle
    const timer = setTimeout(() => {
      const container = containerRef.current;

      // Find text node containing the query
      const walker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );

      let node;
      while ((node = walker.nextNode())) {
        const index = node.textContent.toLowerCase().indexOf(query.toLowerCase());
        if (index !== -1) {
          // Found the match - wrap in highlight span
          const range = document.createRange();
          range.setStart(node, index);
          range.setEnd(node, index + query.length);

          const highlight = document.createElement('mark');
          highlight.className = 'search-highlight';
          highlight.style.cssText = 'background: #fbbf24; padding: 2px; border-radius: 2px; transition: background 2s ease;';

          range.surroundContents(highlight);
          highlightRef.current = highlight;

          // Scroll into view
          highlight.scrollIntoView({ behavior: 'smooth', block: 'center' });

          // Fade out highlight after 2 seconds
          setTimeout(() => {
            if (highlightRef.current) {
              highlightRef.current.style.background = 'transparent';
              // Remove the mark element after fade
              setTimeout(() => {
                if (highlightRef.current && highlightRef.current.parentNode) {
                  const parent = highlightRef.current.parentNode;
                  parent.replaceChild(
                    document.createTextNode(highlightRef.current.textContent),
                    highlightRef.current
                  );
                  parent.normalize();
                }
              }, 2000);
            }
          }, 2000);

          break; // Only highlight first match
        }
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [query, isReady]);
}
```

**Integrate into NoteEditor.jsx:**
- Accept `highlightQuery` prop from context
- Pass editor container ref and ready state to `useScrollToMatch`
- Clear `highlightQuery` after highlighting completes

#### 1.2 Bible Verse Search → Scroll to Verse
**File:** `src/components/Layout/VerseSearch.jsx` (if exists, or create)

When user searches for a verse reference (e.g., "Romans 3:23"):
1. Parse the reference to book/chapter/verse
2. Navigate to the chapter
3. Scroll to the specific verse element
4. Highlight the verse briefly

**Add to BibleContext.jsx:**
```javascript
const [highlightVerse, setHighlightVerse] = useState(null); // { chapter, verse }
```

**Modify ChapterView.jsx:**
- Each verse should have `data-verse="N"` attribute
- When `highlightVerse` is set and matches current chapter, scroll to that verse
- Apply temporary highlight class

#### 1.3 Systematic Theology Search → Scroll to Match
**File:** `src/components/Systematic/SystematicPanel.jsx`

When user searches systematic theology and selects a result:
1. Open the doctrine panel with that entry
2. Scroll to the matched text within the content
3. Highlight temporarily

**Add to SystematicContext.jsx:**
```javascript
const [highlightQuery, setHighlightQuery] = useState(null);
```

### Testing Requirements
- [ ] Search for text in a long note → scrolls to match
- [ ] Search for verse reference → scrolls to verse in chapter
- [ ] Search systematic theology → scrolls to match in panel
- [ ] Highlight fades after 2 seconds
- [ ] Works with multiple search results (each selection scrolls correctly)
- [ ] No memory leaks from highlight elements

---

## Feature 2: Sermon Series Linking

### Problem
Sermons exist as individual notes with no way to group them into series (e.g., "Romans: The Gospel Explained" series with 16 sermons).

### Requirements

#### 2.1 Database Schema
**File:** `server/db.cjs`

Add new table and column:
```sql
-- Sermon series
CREATE TABLE IF NOT EXISTS series (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  book TEXT,                    -- Optional: primary book for this series
  start_date TEXT,              -- When series started
  end_date TEXT,                -- When series ended (null if ongoing)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_series_book ON series(book);

-- Add series_id to notes
ALTER TABLE notes ADD COLUMN series_id TEXT REFERENCES series(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_notes_series ON notes(series_id);
```

**Migration:** Check if column exists before adding (follow existing pattern in db.cjs).

#### 2.2 API Endpoints
**File:** `server/routes/series.cjs` (new file)

```javascript
// GET /api/series - List all series
// GET /api/series/:id - Get series with its sermons
// POST /api/series - Create new series
// PUT /api/series/:id - Update series
// DELETE /api/series/:id - Delete series (sermons become unlinked, not deleted)
// GET /api/series/:id/sermons - Get all sermons in a series (ordered by date or chapter)
// PUT /api/notes/:id/series - Assign/unassign note to series
```

**Mount in server/index.cjs:**
```javascript
const seriesRoutes = require('./routes/series.cjs');
app.use('/api/series', seriesRoutes);
```

#### 2.3 MCP Tools
**File:** `mcp/src/tools/series.ts` (new file)

Create these tools:
```typescript
// list_series - Get all sermon series
// get_series - Get series by ID with sermon list
// create_series - Create new series
// update_series - Update series metadata
// add_sermon_to_series - Link a sermon note to a series
// remove_sermon_from_series - Unlink sermon from series
// get_series_for_book - Get all series that cover a Bible book
```

Register in `mcp/src/index.ts`.

#### 2.4 Frontend Components
**Files to create:**
- `src/components/Layout/SeriesTree.jsx` — Sidebar tree showing series
- `src/components/Layout/SeriesTree.module.css`
- `src/components/UI/SeriesSelector.jsx` — Dropdown/modal to assign note to series
- `src/components/UI/SeriesModal.jsx` — Create/edit series modal

**Context:** `src/context/SeriesContext.jsx`
```javascript
// State: series list, selected series
// Actions: fetchSeries, createSeries, updateSeries, deleteSeries
// Custom hook: useSeries()
```

**Service:** `src/services/seriesService.js`

#### 2.5 UI Integration
- Add "Series" section to sidebar (collapsible, like Topics)
- In NoteEditor, show series badge if note belongs to a series
- In AddNoteModal, add optional series selector for sermon type
- Series detail view showing all sermons in order

### Testing Requirements
- [ ] Create a new series
- [ ] Assign existing sermon to series
- [ ] Create new sermon directly in series
- [ ] View all sermons in a series
- [ ] Remove sermon from series (sermon not deleted)
- [ ] Delete series (sermons become unlinked)
- [ ] MCP tools work correctly

---

## Feature 3: User Voice Profile

### Problem
Claude cannot remember the user's preaching style, theological emphases, or preferences between sessions. Each conversation starts fresh.

### Requirements

#### 3.1 Database Schema
**File:** `server/db.cjs`

```sql
-- Key-value store for user profile/preferences
CREATE TABLE IF NOT EXISTS user_profile (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,           -- JSON string for complex values
  category TEXT DEFAULT 'general', -- 'style', 'theology', 'preferences', 'general'
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_profile_category ON user_profile(category);
```

**Predefined keys to seed:**
```javascript
const defaultProfile = [
  { key: 'preaching_style', value: '""', category: 'style' },
  { key: 'illustration_preferences', value: '""', category: 'style' },
  { key: 'application_approach', value: '""', category: 'style' },
  { key: 'theological_tradition', value: '""', category: 'theology' },
  { key: 'theological_emphases', value: '[]', category: 'theology' },
  { key: 'phrases_to_use', value: '[]', category: 'preferences' },
  { key: 'phrases_to_avoid', value: '[]', category: 'preferences' },
  { key: 'sermon_length_minutes', value: '""', category: 'preferences' },
  { key: 'congregation_context', value: '""', category: 'general' },
];
```

#### 3.2 API Endpoints
**File:** `server/routes/profile.cjs` (new file)

```javascript
// GET /api/profile - Get all profile entries
// GET /api/profile/:key - Get single profile value
// PUT /api/profile/:key - Update single profile value
// GET /api/profile/category/:category - Get all entries in category
// POST /api/profile/bulk - Update multiple entries at once
```

#### 3.3 MCP Tools
**File:** `mcp/src/tools/profile.ts` (new file)

```typescript
// get_user_profile - Get complete profile (call at session start)
// get_profile_value - Get specific key
// set_profile_value - Update specific key
// suggest_profile_updates - Analyze sermons and suggest profile values
```

**The `suggest_profile_updates` tool should:**
1. Analyze recent sermons (type='sermon')
2. Extract patterns: average length, common themes, illustration types
3. Return suggested values for profile keys
4. NOT auto-apply — return suggestions for user confirmation

#### 3.4 Frontend Components
**Files:**
- `src/components/UI/ProfileModal.jsx` — Settings-style modal for editing profile
- `src/components/UI/ProfileModal.module.css`

**Integration:**
- Add "Preaching Profile" button in Settings modal or Header
- Display current profile values with edit capability
- "Analyze My Sermons" button that calls MCP tool and shows suggestions

#### 3.5 Session Summary Tool
**Add to** `mcp/src/tools/ai-enhanced.ts`:

```typescript
// save_session_summary - Store a summary of the current session
server.tool(
  'save_session_summary',
  'Save a summary of the current working session for future reference',
  {
    summary: z.string().describe('Brief summary of what was accomplished'),
    decisions: z.array(z.string()).optional().describe('Key decisions made'),
    preferences_learned: z.array(z.object({
      key: z.string(),
      value: z.string(),
      confidence: z.enum(['low', 'medium', 'high'])
    })).optional().describe('User preferences discovered during session'),
    next_steps: z.array(z.string()).optional().describe('Suggested follow-up tasks'),
  },
  async ({ summary, decisions, preferences_learned, next_steps }) => {
    // Store in a session_summaries table or as a special note type
  }
);

// get_recent_session_summaries - Retrieve past session summaries
server.tool(
  'get_recent_session_summaries',
  'Get summaries from recent working sessions to restore context',
  {
    limit: z.number().optional().describe('Number of sessions to retrieve (default: 5)'),
  },
  async ({ limit = 5 }) => {
    // Retrieve and return recent summaries
  }
);
```

**Add table:**
```sql
CREATE TABLE IF NOT EXISTS session_summaries (
  id TEXT PRIMARY KEY,
  summary TEXT NOT NULL,
  decisions TEXT,              -- JSON array
  preferences_learned TEXT,    -- JSON array
  next_steps TEXT,             -- JSON array
  created_at TEXT NOT NULL
);
```

### Testing Requirements
- [ ] View and edit profile values
- [ ] "Analyze My Sermons" returns meaningful suggestions
- [ ] MCP tool `get_user_profile` returns complete profile
- [ ] Session summaries are saved and retrievable
- [ ] Profile values persist across app restarts

---

## Feature 4: MCP Token Efficiency

### Problem
MCP tool responses include full note content, consuming excessive tokens for large sermons/commentaries. Users hit context limits faster than necessary.

### Requirements

#### 4.1 Add Field Selection to Note Tools
**File:** `mcp/src/tools/notes-crud.ts`

Modify `get_note` tool:
```typescript
server.tool(
  'get_note',
  'Get a single Bible study note by its ID',
  {
    id: z.string().describe('The UUID of the note'),
    fields: z.array(z.string()).optional().describe(
      'Specific fields to return. Options: id, book, startChapter, startVerse, endChapter, endVerse, title, content, type, primaryTopicId, tags, createdAt, updatedAt. Default: all fields.'
    ),
    contentPreview: z.number().optional().describe(
      'If set, return only first N characters of content instead of full content'
    ),
  },
  async ({ id, fields, contentPreview }) => {
    // Implementation: filter response to only requested fields
    // If contentPreview is set, truncate content and add "...(truncated)" indicator
  }
);
```

Apply same pattern to:
- `list_notes`
- `get_chapter_notes`
- `search_notes`

#### 4.2 Create Metadata-Only Tool
**File:** `mcp/src/tools/notes-query.ts`

```typescript
// get_note_metadata - Get note without content (fast, low-token)
server.tool(
  'get_note_metadata',
  'Get note metadata without content. Use this for listing/browsing when you don\'t need the full text.',
  {
    id: z.string().describe('The UUID of the note'),
  },
  async ({ id }) => {
    // Return: id, book, chapters, verses, title, type, primaryTopicId, tags, dates
    // Explicitly exclude: content
  }
);

// list_notes_metadata - List all notes without content
server.tool(
  'list_notes_metadata',
  'List all notes with metadata only (no content). Much faster and lower token usage.',
  {
    book: z.string().optional(),
    type: z.enum(['note', 'commentary', 'sermon']).optional(),
    limit: z.number().optional(),
    offset: z.number().optional(),
  },
  async ({ book, type, limit = 50, offset = 0 }) => {
    // Return array of note metadata without content
  }
);
```

#### 4.3 Update CLAUDE.md
Add guidance for Claude on when to use which tools:
```markdown
### Token-Efficient Tool Usage

| Need | Tool to Use | Token Cost |
|------|-------------|------------|
| List notes for browsing | `list_notes_metadata` | Low |
| Check if note exists | `get_note_metadata` | Low |
| Read full note content | `get_note` | High |
| Search with preview | `search_notes` with `contentPreview: 200` | Medium |

**Best Practice:** Use metadata tools first to identify relevant notes, then fetch full content only for the specific notes needed.
```

### Testing Requirements
- [ ] `get_note` with `fields` parameter returns only requested fields
- [ ] `get_note` with `contentPreview` truncates content correctly
- [ ] `get_note_metadata` returns everything except content
- [ ] `list_notes_metadata` works with filters
- [ ] Token usage measurably reduced for browse/search operations

---

## Feature 5: Illustration Duplicate Detection

### Problem
Users may accidentally reuse the same illustration in multiple sermons without realizing it.

### Requirements

#### 5.1 Add Signature Column
**File:** `server/db.cjs`

```sql
ALTER TABLE inline_tags ADD COLUMN text_signature TEXT;
CREATE INDEX IF NOT EXISTS idx_inline_tags_signature ON inline_tags(text_signature);
```

**Generate signature in `syncInlineTags`:**
```javascript
// Normalize text: lowercase, remove punctuation, first 100 chars
const generateSignature = (text) => {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 100);
};
```

#### 5.2 MCP Tool for Similarity Check
**File:** `mcp/src/tools/ai-enhanced.ts`

```typescript
// check_illustration_similarity - Find similar illustrations
server.tool(
  'check_illustration_similarity',
  'Check if an illustration has been used before. Returns similar existing illustrations.',
  {
    text: z.string().describe('The illustration text to check'),
    threshold: z.number().optional().describe('Similarity threshold 0-1 (default: 0.7)'),
  },
  async ({ text, threshold = 0.7 }) => {
    // 1. Generate signature from input text
    // 2. Query inline_tags where tag_type = 'illustration'
    // 3. Compare signatures (simple: exact match; advanced: Levenshtein distance)
    // 4. Return matches with similarity score and source note info
  }
);
```

#### 5.3 Frontend Integration (Optional)
In NoteEditor, when user tags text as illustration:
- Call similarity check API
- If matches found, show warning: "Similar illustration found in [Sermon Title]"
- User can proceed or cancel

### Testing Requirements
- [ ] Signature generated correctly for new inline tags
- [ ] Exact duplicate detected
- [ ] Similar (not exact) illustration detected
- [ ] Warning shown in editor (if frontend implemented)

---

## Implementation Order

Recommended sequence based on dependencies and impact:

1. **MCP Token Efficiency** (Feature 4) — Quick win, improves all MCP interactions
2. **Scroll-to-Match Navigation** (Feature 1) — High user impact, no dependencies
3. **Sermon Series Linking** (Feature 2) — New capability, straightforward
4. **User Voice Profile** (Feature 3) — Enables better AI assistance
5. **Illustration Duplicate Detection** (Feature 5) — Nice to have, builds on existing

---

## Testing Checklist

After implementing all features, verify:

- [ ] All existing tests still pass (`npm test`)
- [ ] New features have unit tests
- [ ] MCP tools tested via Claude Desktop or manual API calls
- [ ] Electron app builds successfully (`npm run electron:build`)
- [ ] Database migrations work on fresh install AND existing database
- [ ] No console errors in browser dev tools
- [ ] No TypeScript errors in MCP server (`cd mcp && npm run build`)

---

## Notes for Claude Code

1. **Don't break existing functionality** — Run tests frequently
2. **Follow existing patterns** — Look at similar features for guidance
3. **Commit incrementally** — One feature per commit with descriptive message
4. **Update ROADMAP.md** — Add new features to appropriate sections
5. **Update CLAUDE.md** — Document new MCP tools and API endpoints
6. **Add JSDoc comments** — Especially for new hooks and utilities

When in doubt, ask clarifying questions before implementing.
