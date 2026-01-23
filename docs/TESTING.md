# SACRED Testing Guide

## Quick Start

```bash
npm test              # Run all tests
npm run test:coverage # Run with coverage report
```

## Test Structure

```
tests/
├── unit/              # Pure function tests
│   └── utils/         # parseReference, verseRange, etc.
├── component/         # React component tests (isolated with mocks)
│   ├── Bible/         # BibleReader, ChapterView, Verse
│   ├── Layout/        # Header, Sidebar, VerseSearch
│   ├── Notes/         # NoteCard, NoteEditor, NotesPanel
│   └── UI/            # Button, ThemeToggle, SettingsModal
└── integration/       # Tests with multiple components/contexts
    ├── contexts/      # Context provider tests
    └── mcp/           # MCP server tool tests
```

## Writing Tests

### Component Test Pattern

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock context hooks
vi.mock('../../../src/context/NotesContext', () => ({
  useNotes: () => ({
    notes: [],
    refreshNotes: vi.fn(),
  }),
}));

vi.mock('../../../src/context/SystematicContext', () => ({
  useSystematic: () => ({
    refreshTree: vi.fn(),
  }),
}));

import { MyComponent } from '../../../src/components/MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
});
```

### Key Points

- **Mock contexts before importing components** - Vitest hoists `vi.mock()` calls
- **Use `@testing-library/react`** for component queries
- **Clean up after each test** - use `afterEach(() => cleanup())`
- **Test user behavior**, not implementation details

## Coverage Status

### Well Covered (90%+)
- `topicsService.js` - 100%
- `parseReference.js` - 100%
- `verseRange.js` - 100%
- `bibleBooks.js` - 100%
- Component tests for NoteCard, NoteEditor, Verse, ThemeToggle

### Needs Tests
- `systematicService.js`
- `InsertDoctrineModal.jsx`
- `SystematicPanel.jsx`

## Manual Testing Supplement

For Electron-specific features not covered by automated tests:

### Electron App
- Build: `npm run electron:build`
- Test auto-restore on first launch
- Verify database persistence in `~/Library/Application Support/sacred/`

### API Tests (curl)

```bash
# Get all notes
curl http://localhost:3001/api/notes

# Create a note
curl -X POST http://localhost:3001/api/notes \
  -H "Content-Type: application/json" \
  -d '{"book":"JHN","startChapter":3,"startVerse":16,"endChapter":3,"endVerse":16,"title":"Test","content":"<p>Test</p>","type":"note"}'

# Export notes
curl http://localhost:3001/api/notes/export
```
