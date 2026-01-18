# Sidebar Redesign: Bible-Structured Notes + Topics System

> **Status**: Phase 1 complete (v0.0.4) | Phase 2 pending
>
> - [x] Phase 1: Topic system + sidebar restructure
> - [ ] Phase 2: Inline tagging (highlight + tag within notes)

## Overview

Redesign the sidebar navigation from 2 tabs to 3 tabs, adding a hierarchical topic/tag system for organizing notes by theological and practical categories.

## Design Decisions (from brainstorm)

| Decision | Choice |
|----------|--------|
| Multi-chapter notes placement | Starting chapter only |
| Tag model | Primary topic (required) + secondary tags (optional) |
| Topic hierarchy | Fully customizable at all levels |
| Empty books in Notes tab | Show all 66, dim empty ones |
| Notes display in Topics | Flat list sorted by Bible order |
| Topic metadata | Name only (no descriptions) |
| Inline tagging | Phase 2 - highlight + tag within notes |

---

## Phase 1: Topic System + Sidebar Restructure

### 1. Database Schema Changes

```sql
-- New topics table for hierarchical categories
CREATE TABLE topics (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES topics(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_topics_parent ON topics(parent_id);

-- Add primary topic to notes
ALTER TABLE notes ADD COLUMN primary_topic_id TEXT REFERENCES topics(id);

-- Many-to-many for secondary tags
CREATE TABLE note_tags (
  note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, topic_id)
);
```

### 2. New API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/topics` | Get full topic tree |
| POST | `/api/topics` | Create topic |
| PUT | `/api/topics/:id` | Update topic (name, parent, order) |
| DELETE | `/api/topics/:id` | Delete topic (cascade to children) |
| GET | `/api/topics/:id/notes` | Get all notes with this topic (primary or secondary) |

### 3. Sidebar Component Changes

**New 3-tab structure:**
```
┌─────────────────────────────────────┐
│  [Books]  [Notes]  [Topics]         │
├─────────────────────────────────────┤
│  (tab content)                      │
└─────────────────────────────────────┘
```

**Notes Tab (restructured):**
- Show all 66 books vertically
- Empty books dimmed (opacity: 0.5, non-expandable or "no notes" message)
- Expand book → shows chapters that have notes (with count badges)
- Expand chapter → shows notes sorted by starting verse
- Each note displays: verse range + title (truncated)

**Topics Tab (new):**
- Hierarchical tree with expand/collapse
- A-Z sorted at each level
- Count badge showing total notes in branch
- Click topic with no children → shows notes list (flat, Bible order)
- Click topic with children → expands to show sub-topics
- Context actions: Add sub-topic, Edit, Delete

### 4. Note Editor Changes

**In AddNoteModal and NoteEditor:**
- Add "Primary Topic" dropdown (searchable, required)
- Add "Tags" multi-select (optional secondary topics)
- "Create new topic" option inline

### 5. Files to Modify

**Backend (server/):**
- `server/db.cjs` - Add topics table, note_tags table, migrations
- `server/routes/topics.cjs` - New route file for topics CRUD
- `server/routes/notes.cjs` - Add primary_topic_id, handle tags
- `server/index.cjs` - Mount topics routes

**Frontend (src/):**
- `src/components/Layout/Sidebar.jsx` - Add third tab, restructure Notes tab
- `src/components/Notes/AddNoteModal.jsx` - Add topic selection
- `src/components/Notes/NoteEditor.jsx` - Add topic editing
- `src/context/TopicsContext.jsx` - New context for topics state
- `src/services/topicsService.js` - New API service

**New components:**
- `src/components/Layout/TopicsTree.jsx` - Topics tab content
- `src/components/Layout/NotesTree.jsx` - Bible-structured notes tab
- `src/components/UI/TopicSelector.jsx` - Dropdown for selecting topics

---

## Phase 2: Inline Tagging (Future)

### Concept
Allow users to highlight text within a note and apply tags (illustration, application, key point, etc.).

### Tiptap Integration
- Create custom Mark extension for inline tags
- Store tag type as mark attribute in HTML
- Visual styling: background highlight + small label badge

### Browsing Tagged Content
- New view: "Browse Illustrations" shows all inline-tagged illustrations across all notes
- Search functionality for tagged content
- Click result → navigates to note and scrolls to tagged section

### Database Addition
```sql
-- Index table for fast inline tag searching
CREATE TABLE inline_tags (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  tag_type TEXT NOT NULL,
  text_preview TEXT,
  created_at TEXT NOT NULL
);
```

---

## Suggested Default Topic Structure

```
Systematic Theology/
├── Bibliology (Doctrine of Scripture)
├── Theology Proper (Doctrine of God)
├── Christology (Doctrine of Christ)
├── Pneumatology (Doctrine of the Holy Spirit)
├── Anthropology (Doctrine of Man)
├── Hamartiology (Doctrine of Sin)
├── Soteriology (Doctrine of Salvation)
├── Ecclesiology (Doctrine of the Church)
├── Eschatology (Doctrine of Last Things)

Practical/
├── Discipleship
├── Marriage & Family
├── Leadership
├── Prayer
├── Evangelism

Resources/
├── Illustrations
├── Applications
├── Quotes
├── Word Studies
```

*Users can modify, delete, or add to this structure freely.*

---

## UI Mockup (ASCII)

### Notes Tab (Bible-structured)
```
┌─ Notes ─────────────────────┐
│ ▸ Genesis                   │
│ ▾ John                   12 │
│   ├─ Chapter 1            8 │
│   │  • John 1:1-5 - Logos   │
│   │  • John 1:14 - Incarnat │
│   ├─ Chapter 3            4 │
│   │  • John 3:16 - God's... │
│ ▸ Romans                  5 │
│ ○ 1 Corinthians        (dim)│
│ ○ 2 Corinthians        (dim)│
└─────────────────────────────┘
```

### Topics Tab
```
┌─ Topics ────────────────────┐
│ ▾ Systematic Theology    28 │
│   ├─ Bibliology           3 │
│   ├─ ▾ Soteriology       12 │
│   │    • Justification    5 │
│   │    • Sanctification   4 │
│   │    • Glorification    3 │
│   └─ Eschatology          8 │
│ ▸ Practical              15 │
│ ▸ Resources               7 │
│ [+ Add Topic]               │
└─────────────────────────────┘
```

---

## Git Workflow

Create and work on a feature branch:
```bash
git checkout -b feature/topics-sidebar-redesign
```

Commit incrementally as each component is completed.

---

## Verification Plan

1. **Database**: Run migrations, verify tables created with correct schema
2. **Topics CRUD**: Test create/read/update/delete via API
3. **Notes with topics**: Create note with primary topic + tags, verify storage
4. **Sidebar navigation**: Test all three tabs, expand/collapse, navigation
5. **Note counts**: Verify badges show correct counts at each level
6. **Empty states**: Confirm dimmed books, proper messaging
7. **Topic deletion**: Verify cascade behavior (notes lose topic reference)

---

## Open Questions Resolved

- ✅ Multi-chapter notes: Starting chapter only
- ✅ Tags: Primary (required) + secondary (optional)
- ✅ Hierarchy: Fully customizable
- ✅ Empty books: Show dimmed
- ✅ Notes in topic view: Flat list, Bible order
- ✅ Topic metadata: Name only
- ✅ Inline tagging: Deferred to Phase 2
