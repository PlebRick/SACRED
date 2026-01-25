# Logos Commentary Import Guide for SACRED

This guide documents the process for importing commentaries from Logos Bible Software into SACRED. It serves as a reference for Claude to follow when the user requests a new commentary import.

## Overview

Logos allows exporting up to 100 pages at a time for personal use. Commentaries are exported as RTF files, which preserve formatting. We convert these to HTML and parse them into section-based notes that align with SACRED's verse-range note system.

## Prerequisites

- Logos Desktop app (not web - desktop has better export features)
- Access to Google Drive (synced locally)
- SACRED app running (for MCP access to the production database)

---

## Step 1: User Exports from Logos

### Export Instructions for User

1. Open the commentary in **Logos Desktop**
2. Navigate to **File > Export** or **Print/Export**
3. Export format: **RTF** (preferred) or Word (.docx)
4. Export in chunks of up to 100 pages each
5. Save files to Google Drive folder:
   ```
   Google Drive/logos-exports/[AuthorLast]_[Book]/
   ```
   Example: `logos-exports/Stott_Romans/`

6. Name files sequentially:
   ```
   Stott_Romans1.rtf
   Stott_Romans2.rtf
   Stott_Romans3.rtf
   ...
   ```

### What Claude Should Ask

When user says "I want to import a commentary from Logos":

1. **Which commentary?** (Author and book)
2. **Have you exported the files?** If not, guide them through export steps above
3. **Where are the files?** (Confirm Google Drive path)
4. **How many export files?** (To know scope)

---

## Step 2: Analyze the Commentary Structure

### Convert RTF to Text for Analysis

```bash
# List the files
ls -la "/Users/b1ackswan/Library/CloudStorage/GoogleDrive-chaplaincen@gmail.com/My Drive/logos-exports/[Folder]/"

# Convert first file to text and examine structure
textutil -convert txt -stdout "[path]/[File1].rtf" | head -200
```

### Find Section Markers

Most commentaries use verse range markers to denote sections. Look for patterns like:
- `1:1–6` (on its own line)
- `Romans 1:1-17` (with book name)
- Numbered sections like `1. Paul and the Gospel`

```bash
# Find verse range patterns across all files
for i in 1 2 3 4 5; do
  echo "=== File $i ==="
  textutil -convert txt -stdout "[path]/[Author]_[Book]$i.rtf" | grep -E "^[0-9]+:[0-9]+(–|-)[0-9]"
done
```

### Identify Section Structure

Commentaries typically have:
1. **Major divisions** (e.g., "A. The Wrath of God" spanning Romans 1:18-3:20)
2. **Chapter-level sections** (e.g., Romans 1:18-32)
3. **Sermon-like subsections** (e.g., Romans 1:1-6 "Paul and the Gospel")

**Goal**: Import at the most granular level that:
- Mostly stays within single chapters
- Has clear verse boundaries
- Corresponds to "sermon-sized" units
- Keeps content under ~80KB per note (API limit)

### Cross-Chapter Sections

Some sections legitimately span chapters (e.g., Romans 2:17-3:8). SACRED supports this with separate `startChapter`/`endChapter` fields. These are fine to keep as single notes.

---

## Step 3: Build the Section Definitions

### Create Section Array

Based on analysis, create a JavaScript array of sections:

```javascript
const SECTIONS = [
  {
    title: 'Paul and the Gospel',
    startChapter: 1,
    startVerse: 1,
    endChapter: 1,
    endVerse: 6,
    marker: '1:1–6'  // The text pattern to find in the document
  },
  {
    title: 'Paul and the Romans',
    startChapter: 1,
    startVerse: 7,
    endChapter: 1,
    endVerse: 13,
    marker: '1:7–13'
  },
  // ... etc
];
```

### Guidelines for Section Definitions

1. **Title**: Use a descriptive title, prefixed with author name (e.g., "Stott: Paul and the Gospel")
2. **Marker**: The exact verse pattern as it appears in the text (watch for en-dash vs hyphen)
3. **Verse ranges**: Should not overlap
4. **Size**: If a section will be huge (entire chapter of dense commentary), consider breaking into subsections if markers exist

---

## Step 4: Create the Import Script

### Script Template

Save as `myfiles/imports/import-[author]-[book].cjs`:

```javascript
/**
 * Import [Author]'s "[Commentary Name]" into Sacred
 * Usage: node myfiles/imports/import-[author]-[book].cjs
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const GOOGLE_DRIVE_PATH = '/Users/b1ackswan/Library/CloudStorage/GoogleDrive-chaplaincen@gmail.com/My Drive/logos-exports/[Folder]';
const API_BASE = 'http://localhost:3001/api';
const BOOK_CODE = '[3-letter code]';  // e.g., 'ROM', 'JHN', 'GEN'
const AUTHOR = '[Author Last Name]';

// Section definitions (from Step 3)
const SECTIONS = [
  // ... paste section array here
];

// ============ HELPER FUNCTIONS ============

function rtfToHtml(rtfPath) {
  try {
    const html = execSync(`textutil -convert html -stdout "${rtfPath}"`, {
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024
    });
    return html;
  } catch (error) {
    console.error(`Error converting ${rtfPath}:`, error.message);
    return null;
  }
}

function cleanHtmlForTiptap(html) {
  // Remove page markers like "p 46"
  html = html.replace(/<span class="s2">.*?p\s+\d+.*?<\/span>/g, '');

  // Remove head section
  html = html.replace(/<head>[\s\S]*?<\/head>/i, '');
  html = html.replace(/<\/?html>/gi, '');
  html = html.replace(/<\/?body>/gi, '');
  html = html.replace(/<!DOCTYPE[^>]*>/gi, '');

  // Remove class attributes
  html = html.replace(/<p[^>]*class="[^"]*"[^>]*>/gi, '<p>');
  html = html.replace(/<span[^>]*class="(?!s1|s3)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '$1');

  // Convert Logos links to bold text
  html = html.replace(/<a href="https:\/\/ref\.ly\/[^"]*">([\s\S]*?)<\/a>/gi, '<strong>$1</strong>');

  // Clean up
  html = html.replace(/\s+/g, ' ');
  html = html.replace(/<p>\s*<\/p>/gi, '');

  return html.trim();
}

function extractSectionContent(allHtml, section, nextSection) {
  const markerPattern = section.marker
    .replace(/–/g, '[-–—-]')
    .replace(/:/g, ':');

  const patterns = [
    new RegExp(`<a[^>]*>\\s*<b>\\s*${markerPattern}`, 'i'),
    new RegExp(`>${markerPattern}<`, 'i'),
    new RegExp(`<p[^>]*>[^<]*${markerPattern}`, 'i'),
    new RegExp(`\\s${markerPattern}\\s`, 'i'),
  ];

  let startIndex = -1;
  for (const pattern of patterns) {
    startIndex = allHtml.search(pattern);
    if (startIndex !== -1) break;
  }

  if (startIndex === -1) {
    console.log(`  Could not find marker: ${section.marker}`);
    return null;
  }

  let endIndex = allHtml.length;
  if (nextSection) {
    const nextMarkerPattern = nextSection.marker
      .replace(/–/g, '[-–—-]')
      .replace(/:/g, ':');

    const nextPatterns = [
      new RegExp(`<a[^>]*>\\s*<b>\\s*${nextMarkerPattern}`, 'i'),
      new RegExp(`>${nextMarkerPattern}<`, 'i'),
      new RegExp(`<p[^>]*>[^<]*${nextMarkerPattern}`, 'i'),
    ];

    for (const pattern of nextPatterns) {
      const nextIndex = allHtml.slice(startIndex + 10).search(pattern);
      if (nextIndex !== -1) {
        endIndex = startIndex + 10 + nextIndex;
        break;
      }
    }
  }

  let content = allHtml.slice(startIndex, endIndex);
  content = cleanHtmlForTiptap(content);

  // Truncate if too large (API limit)
  if (content.length > 80000) {
    console.log(`  WARNING: Content too large (${content.length} chars), truncating...`);
    content = content.slice(0, 80000) + '<p><em>[Content truncated due to size limits]</em></p>';
  }

  return content;
}

async function createNote(noteData) {
  const response = await fetch(`${API_BASE}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(noteData),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error: ${response.status}`);
  }

  return await response.json();
}

async function deleteExistingNotes() {
  const response = await fetch(`${API_BASE}/notes`);
  if (!response.ok) return;

  const notes = await response.json();
  const existingNotes = notes.filter(n =>
    n.title && n.title.startsWith(`${AUTHOR}:`) && n.book === BOOK_CODE && n.type === 'commentary'
  );

  if (existingNotes.length === 0) {
    console.log('No existing notes to delete.');
    return;
  }

  console.log(`Deleting ${existingNotes.length} existing ${AUTHOR} commentary notes...`);
  for (const note of existingNotes) {
    await fetch(`${API_BASE}/notes/${note.id}`, { method: 'DELETE' });
  }
  console.log('Deleted existing notes.\n');
}

// ============ MAIN ============

async function main() {
  console.log(`=== Importing ${AUTHOR}'s Commentary on ${BOOK_CODE} ===\n`);

  // Check API
  try {
    const check = await fetch(`${API_BASE}/notes/count`);
    if (!check.ok) throw new Error();
  } catch {
    console.error('Error: Sacred API not running. Start with: npm run dev:server');
    process.exit(1);
  }

  await deleteExistingNotes();

  // Read RTF files
  console.log('Reading RTF files from:', GOOGLE_DRIVE_PATH);
  const files = fs.readdirSync(GOOGLE_DRIVE_PATH)
    .filter(f => f.endsWith('.rtf'))
    .sort();

  console.log(`Found ${files.length} RTF files:`, files);

  let combinedHtml = '';
  for (const file of files) {
    console.log(`  Converting: ${file}`);
    const html = rtfToHtml(path.join(GOOGLE_DRIVE_PATH, file));
    if (html) combinedHtml += html;
  }

  console.log(`\nCombined HTML: ${combinedHtml.length} characters`);
  console.log('\n=== Creating Commentary Notes ===\n');

  let created = 0, failed = 0;

  for (let i = 0; i < SECTIONS.length; i++) {
    const section = SECTIONS[i];
    const nextSection = SECTIONS[i + 1];

    console.log(`Processing: ${section.title} (${section.marker})`);

    const content = extractSectionContent(combinedHtml, section, nextSection);

    if (!content) {
      console.log(`  SKIPPED - Could not extract content`);
      failed++;
      continue;
    }

    try {
      await createNote({
        book: BOOK_CODE,
        startChapter: section.startChapter,
        startVerse: section.startVerse,
        endChapter: section.endChapter,
        endVerse: section.endVerse,
        title: `${AUTHOR}: ${section.title}`,
        content: content,
        type: 'commentary',
      });
      console.log(`  CREATED - ${content.length} chars`);
      created++;
    } catch (error) {
      console.log(`  FAILED - ${error.message}`);
      failed++;
    }

    await new Promise(r => setTimeout(r, 100));
  }

  console.log('\n=== Import Complete ===');
  console.log(`Created: ${created}`);
  console.log(`Failed: ${failed}`);
}

main().catch(console.error);
```

---

## Step 5: Run the Import (Dev Database First)

### Start the Dev Server

```bash
npm run dev:server
```

### Run the Script

```bash
node myfiles/imports/import-[author]-[book].cjs
```

### Verify Results

Check the output for:
- How many notes were created vs failed
- Any markers that couldn't be found
- Any content that was truncated

---

## Step 6: Transfer to Production Database

The import script writes to the **dev database** (`data/sacred.db`), not the production Mac app database (`~/Library/Application Support/sacred/sacred.db`).

### Option A: Copy via SQL (Recommended)

```bash
# Copy all notes from dev to production for this commentary
sqlite3 /Users/b1ackswan/code/Sacred/data/sacred.db \
  "SELECT * FROM notes WHERE title LIKE '[Author]:%' AND book='[BOOK]'" | \
  sqlite3 "/Users/b1ackswan/Library/Application Support/sacred/sacred.db" \
  ".import /dev/stdin notes"
```

### Option B: Use MCP Directly

Claude can also use the `mcp__sacred-bible-notes__create_note` tool to write directly to the production database, but this is slower for many notes.

### Verify in App

Open the SACRED Mac app, navigate to the book, and verify the commentary notes appear with full content.

---

## Step 7: Cleanup and Troubleshooting

### Delete Duplicates

If test notes were created, find and delete them:

```bash
# Find duplicates by title
sqlite3 "/Users/b1ackswan/Library/Application Support/sacred/sacred.db" \
  "SELECT id, title, length(content) FROM notes WHERE title LIKE '[Author]:%' ORDER BY title, length(content)"

# Delete specific duplicate by ID
sqlite3 "/Users/b1ackswan/Library/Application Support/sacred/sacred.db" \
  "DELETE FROM notes WHERE id='[uuid]'"
```

Or use MCP:
```
mcp__sacred-bible-notes__delete_note with id parameter
```

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Could not find marker" | Marker pattern doesn't match text | Check exact formatting (en-dash vs hyphen, spacing) |
| Content truncated | Section > 80KB | Break into smaller subsections |
| Very small content | Adjacent markers too close | Markers may not be separate sections in original |
| API 413 error | Payload too large | Reduce section size or increase body-parser limit |
| Notes in wrong database | Script uses dev DB | Transfer to production (Step 6) |

---

## Reference: Example Imports

### Stott's Message of Romans

- **Files**: 5 RTF exports
- **Sections**: 31 sermon-level divisions
- **Cross-chapter sections**: 4 (2:17-3:8, 3:21-4:25, 5:1-6:23, 14:1-15:13)
- **Script**: `myfiles/imports/import-stott-romans.cjs`

---

## Checklist for New Import

- [ ] User has exported RTF files to `logos-exports/[Author]_[Book]/`
- [ ] Files are named sequentially (`[Author]_[Book]1.rtf`, etc.)
- [ ] Analyzed section structure with `textutil` and `grep`
- [ ] Created SECTIONS array with all verse ranges and markers
- [ ] Created import script from template
- [ ] Ran script against dev database
- [ ] Verified note count and content
- [ ] Transferred to production database
- [ ] Verified in SACRED Mac app
- [ ] Deleted any test duplicates
