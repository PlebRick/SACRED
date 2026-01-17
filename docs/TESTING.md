# SACRED Testing Guide

## Current State

No automated test framework is currently configured. Testing is done manually.

## Manual Testing Workflow

### Setup
1. Start both servers in separate terminals:
   ```bash
   npm run dev          # Frontend at http://localhost:3000
   npm run dev:server   # Backend at http://localhost:3001
   ```

### Core Functionality Tests

#### Notes CRUD
- [ ] Create a new note on a single verse
- [ ] Create a note spanning multiple verses
- [ ] Create a note spanning multiple chapters
- [ ] Edit note title and content
- [ ] Delete a note
- [ ] Verify notes persist after page refresh

#### Note Types
- [ ] Create a note with type "note"
- [ ] Create a note with type "commentary"
- [ ] Create a note with type "sermon"
- [ ] Verify type is displayed correctly

#### Export/Import
- [ ] Export all notes to JSON
- [ ] Verify exported file contains all notes
- [ ] Import notes to a fresh database
- [ ] Import notes with merge (upsert behavior)

#### Theme
- [ ] Toggle dark/light theme
- [ ] Verify theme persists after refresh
- [ ] Test system preference detection

#### Navigation
- [ ] Navigate between books
- [ ] Navigate between chapters
- [ ] Use verse search/jump functionality
- [ ] Verify URL updates with navigation

#### Responsive Design
- [ ] Test on desktop viewport (1920px+)
- [ ] Test on tablet viewport (768px)
- [ ] Test on mobile viewport (375px)
- [ ] Verify sidebar collapse behavior

### API Tests (curl)

```bash
# Get all notes
curl http://localhost:3001/api/notes

# Create a note
curl -X POST http://localhost:3001/api/notes \
  -H "Content-Type: application/json" \
  -d '{"book":"JHN","startChapter":3,"startVerse":16,"endChapter":3,"endVerse":16,"title":"Test","content":"<p>Test content</p>","type":"note"}'

# Get notes for a chapter
curl http://localhost:3001/api/notes/chapter/JHN/3

# Export notes
curl http://localhost:3001/api/notes/export

# Get note count
curl http://localhost:3001/api/notes/count
```

## Future Testing Setup

### Recommended Stack
- **Unit Tests:** Vitest (fast, Vite-native)
- **Component Tests:** Vitest + React Testing Library
- **E2E Tests:** Playwright

### Suggested Test Structure
```
SACRED/
├── src/
│   ├── components/
│   │   └── Notes/
│   │       ├── NoteCard.jsx
│   │       └── NoteCard.test.jsx    # Co-located unit tests
│   └── utils/
│       ├── parseReference.js
│       └── parseReference.test.js   # Utility tests
├── tests/
│   └── e2e/
│       ├── notes.spec.ts            # E2E tests
│       └── navigation.spec.ts
└── vitest.config.ts
```

### Priority Tests to Add
1. `parseReference.js` - pure function, easy to test
2. `verseRange.js` - pure function, easy to test
3. Notes API routes - integration tests
4. Note CRUD flow - E2E test
