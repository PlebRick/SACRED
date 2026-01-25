# Grudem Systematic Theology Import - Findings & Fixes

This document tracks issues discovered during the import of Wayne Grudem's Systematic Theology and the patterns developed to fix them. This supplements the original plan in `grudem-plan.md`.

---

## Content Data Model (Critical Understanding)

The systematic theology data serves **two purposes** with different content needs:

### 1. Full Reading Mode
- **Trigger**: Clicking chapter/section header in sidebar
- **Shows**: Complete content with subsection headers embedded for natural reading flow
- **Example**: Clicking "Section F" shows all of F including "1. Title", "2. Title", etc. as headers within the flowing text

### 2. Fine-Grained Search/Lookup Mode
- **Trigger**: Clicking a subsection link in the tree (e.g., "F.1")
- **Shows**: Just that subsection's extracted content
- **Use case**: Search results, targeted lookup, focused reading

### Content Storage Summary

| Entry Type | Content Contains | Purpose |
|------------|------------------|---------|
| Section | ALL content including subsection headers | Full reading of entire section |
| Subsection | Just that subsection's paragraphs | Fine-grained search/lookup |

**Both are needed.** The section having 40,000+ chars is CORRECT (full reading mode). The subsection having its extracted content is ALSO correct (fine-grained mode). These are NOT duplicates - they serve different UI purposes.

### Truncation Bug Impact
The import script bug caused subsections to only capture their header text (~100-500 chars) instead of their full extracted content. This breaks fine-grained mode - clicking a subsection link shows just a title instead of actual content.

---

## Issue #1: Subsection Content Truncation

### Problem Discovery
When reviewing imported chapters, subsections (e.g., A.1, A.2, B.1) only contain their **first paragraph**. The remaining paragraphs were incorrectly placed in the parent section's intro field.

### Root Cause
The import script appears to have:
1. Detected subsection headers (e.g., `<span style="font-weight:bold;">1. Title.</span>`)
2. Captured only the first paragraph after the header
3. Dumped all subsequent paragraphs into the parent section's content field

### Example (Chapter 2, Section B)
**Before fix:**
- Section B intro: 7,825 chars (contained mixed content from all subsections)
- B.1: 865 chars (1 paragraph only)
- B.2: 1,615 chars (1 paragraph only)
- B.3: 407 chars (1 paragraph only)
- B.4: 909 chars (1 paragraph only)

**After fix:**
- Section B intro: 0 chars (correct - no intro before subsections)
- B.1: 1,318 chars (2 paragraphs)
- B.2: 3,133 chars (4 paragraphs)
- B.3: 2,258 chars (4 paragraphs + quote block)
- B.4: 5,152 chars (6 paragraphs + quote block)

### Fix Pattern
1. Query database for section/subsection structure
2. Read original HTML file to identify correct content boundaries
3. For each subsection, extract ALL paragraphs until the next subsection header or section header
4. Set parent section intro to empty if no intro content exists before first subsection
5. Update each subsection with its complete content

---

## Issue #2: Supplementary Material Bloat

### Problem Discovery
The last section of each chapter contains content that shouldn't be there:
- Questions for Personal Application
- Special Terms
- Bibliography
- Scripture Memory Passage
- Hymn
- Footnotes
- Logos export metadata

### Example (Chapter 3, Section B)
**Before fix:** 60,222 chars
**After fix:** 29,419 chars (removed ~31,000 chars of supplementary material)

### Fix Pattern
1. Search HTML for "Questions for Personal Application" to find content boundary
2. The last paragraph before this marker is where actual content ends
3. Update the last section to contain only content up to that boundary

---

## Issue #3: Section Intro vs Subsection Content

### Design Decision
When a section (e.g., "A. Title") has subsections (A.1, A.2, etc.):
- If there's introductory content BEFORE the first subsection → put it in section intro
- If section goes directly to subsection 1 → section intro should be EMPTY

### HTML Patterns
- Section header: `<p style="font-weight:bold; font-size:14pt;...">A. Title</p>`
- Subsection header: `<span style="font-weight:bold;">1. Subsection Title.</span>`
- Look for content paragraphs between section header and first subsection

---

## Chapters Fixed

### Chapter 1 - Introduction to Systematic Theology
- **Structure fix:** Created "Introduction" part (part_number=0), moved Ch1 out of Part 1
- **Section A:** Fixed intro (536 chars) and subsections A.1-A.4 with full content
- **Section E:** Fixed intro (116 chars) and subsections E.1-E.6 with full content
- **Section B:** Confirmed correct (single paragraph, no subsections)

### Chapter 2 - The Word of God
- **Section B:** Emptied intro, fixed B.1-B.4 with full content
- **Section C:** Trimmed from 10,002 to 2,271 chars (removed Questions/Bibliography)

### Chapter 3 - The Canon of Scripture
- **Section A:** Confirmed correct (no subsections, continuous content)
- **Section B:** Trimmed from 60,222 to 29,419 chars (removed supplementary material)

### Chapter 4 - The Four Characteristics of Scripture: (1) Authority
- **Status:** FIXED
- **Section A:** Emptied intro (26,354 → 0), fixed 6 subsections:
  - A.1: 1,320 → 16,800 chars (17 paragraphs about Bible's claims)
  - A.2: 1,286 → 2,555 chars (3 paragraphs about conviction)
  - A.3: 1,102 → 1,863 chars (includes Westminster Confession quote)
  - A.4: 885 → 838 chars (1 paragraph - was mostly correct)
  - A.5: 419 → 4,380 chars (8 paragraphs about circular argument)
  - A.6: 425 → 6,014 chars (9 paragraphs about dictation)
- **Section C:** Emptied intro (5,151 → 0), fixed 4 subsections:
  - C.1: 657 → 2,313 chars
  - C.2: 1,777 → 1,979 chars
  - C.3: 985 → 1,444 chars
  - C.4: 822 → 3,232 chars
- **Section D:** Trimmed 23,949 → 2,686 chars (removed Questions/Bibliography)

### Chapter 5 - The Four Characteristics of Scripture: (2) Inerrancy
- **Status:** FIXED
- **Section A (The Meaning of Inerrancy):** Trimmed intro (5,924 → 3,539 chars), fixed 2 subsections:
  - A.1: Truncated → 3,007 chars (ordinary language speech)
  - A.2: Truncated → 1,685 chars (loose quotations)
  - A.3: Already correct at 1,403 chars (grammatical constructions)
- **Section B (Some Current Challenges to Inerrancy):** Trimmed intro (21,666 → 111 chars), fixed all 6 subsections:
  - B.1: Truncated → 10,203 chars (faith and practice objection)
  - B.2: Truncated → 2,906 chars (poor term objection)
  - B.3: Truncated → 3,290 chars (no inerrant manuscripts objection)
  - B.4: Truncated → 3,968 chars (accommodation objection)
  - B.5: Truncated → 1,490 chars (divine/human aspect objection)
  - B.6: Truncated → 4,062 chars (clear errors objection)
- **Section C (Problems With Denying Inerrancy):** Trimmed intro (17,775 → 307 chars)
  - C.1-C.4: Already correct (1,013, 1,031, 566, 522 chars)

### Chapter 6 - The Four Characteristics of Scripture: (3) Clarity
- **Status:** FIXED
- **Structure:** No subsections (sections A-F with continuous content)
- **Section F (The Role of Scholars):** Trimmed 19,166 → 4,412 chars
  - Removed: Questions, Special Terms, Bibliography, Footnotes, Logos metadata
- **Sections A-E:** Confirmed correct (no issues)

### Chapter 7 - The Four Characteristics of Scripture: (4) Necessity
- **Status:** FIXED
- **Structure:** No subsections (sections A-E with continuous content)
- **Section E:** Trimmed 21,589 → 6,515 chars
  - Removed: Questions, Special Terms, Bibliography, Footnotes, Logos metadata
- **Sections A-D:** Confirmed correct (no issues)

### Chapter 8 - The Four Characteristics of Scripture: (5) Sufficiency
- **Status:** FIXED
- **Structure:** No subsections (sections A-D with continuous content)
- **Section D (Practical Applications):** Trimmed 29,332 → 15,031 chars
  - Contains 7 numbered practical applications
  - Removed: Questions, Special Terms, Bibliography, Footnotes, Logos metadata
- **Sections A-C:** Confirmed correct (no issues)

---

## Export Format Differences (Chapters 9-57)

**IMPORTANT:** Chapters 1-8 were exported from Logos years ago. Chapters 9-57 were exported on January 19, 2026.

### Key Differences in Newer Exports:

1. **Supplementary Section Headers:**
   - **Old format (Ch 1-8):** `<p style="font-weight:bold; text-transform:uppercase; font-size:14pt;">Questions for Personal Application</p>`
   - **New format (Ch 9+):** `<span style="font-weight:bold;">QUESTIONS FOR PERSONAL APPLICATION</span>`

2. **Impact on Import:**
   - Old format: Headers preserved, easy to grep for
   - New format: Headers are `<span>` tags (stripped during import), but **content still included without headers**
   - Result: Supplementary content (Questions, Special Terms, Bibliography, Hymn) flows directly into last section content without any visible separation

3. **Scripture Reference Format:**
   - Old format: `<a href="logosref:Bible.Jn1.1">John 1:1</a>`
   - New format: `<a href="https://ref.ly/Jn1.1">John 1:1</a>` (different URL pattern)

4. **Fix Pattern Remains Same:**
   - Still need to trim last section to remove supplementary content
   - Search for numbered questions (1., 2., 3.) or term lists to find cutoff point

---

### Chapter 9 - The Existence of God
- **Status:** FIXED
- **Structure:** No subsections (sections A-D with continuous content)
- **Section D:** Trimmed 12,470 → 1,212 chars
  - Only 1 paragraph of actual content
  - Contained: Questions 1-5, Special Terms list, Bibliography, Hymn, Logos metadata (all without headers due to new export format)
- **Sections A-C:** Confirmed correct (no issues)

### Chapter 10 - The Knowability of God
- **Status:** FIXED
- **Structure:** No subsections (sections A-C with continuous content)
- **Section C:** Trimmed 14,400 → 4,842 chars
  - 5 paragraphs of actual content (including 1 block quote)
  - Removed: Questions, Special Terms, Bibliography, Hymn, Logos metadata
- **Sections A-B:** Confirmed correct (no issues)

---

## HTML Parsing Reference

### Identifying Elements in Logos HTML Export

**Chapter Header:**
```html
<p style="font-weight:bold; font-size:18pt;...">Chapter X</p>
<p style="font-weight:bold; font-size:24pt;...">Chapter Title</p>
```

**Section Header (A, B, C, D, E):**
```html
<p style="font-weight:bold; font-size:14pt;...">A. Section Title</p>
```

**Subsection Header (1, 2, 3...):**
```html
<span style="font-weight:bold;">1. Subsection Title.</span>
```
Note: Subsection content starts in the same `<p>` tag after the `</span>`

**Block Quotes:**
```html
<p style="font-size:11pt; margin-right:36pt; margin-left:36pt;">Quote text</p>
```

**Scripture References (Logos format):**
```html
<a href="logosref:Bible.Jn1.1">John 1:1</a>
```
Convert to: `<a data-scripture="JHN.1.1" class="scripture-link">John 1:1</a>`

**Page Markers (to strip):**
```html
<span style="color:rgb(255, 128, 23);...">  p XX  </span>
```

**End of Content Marker:**
Search for: `Questions for Personal Application`

---

## Scripture Reference Conversion

| Logos Format | Internal Format |
|--------------|-----------------|
| Bible.Jn1.1 | JHN.1.1 |
| Bible.Ge2.24 | GEN.2.24 |
| Bible.Mt19.5 | MAT.19.5 |
| Bible.1Co14.37 | 1CO.14.37 |
| Bible.2Pe3.16 | 2PE.3.16 |
| Bible.Re22.18-19 | REV.22.18-19 |

---

## Remaining Work

### Chapters to Review/Fix
- [x] Chapter 1 - FIXED
- [x] Chapter 2 - FIXED
- [x] Chapter 3 - FIXED
- [x] Chapter 4 - FIXED
- [x] Chapter 5 - FIXED
- [x] Chapter 6 - FIXED
- [x] Chapter 7 - FIXED
- [x] Chapter 8 - FIXED
- [x] Chapter 9 - FIXED (first chapter with new export format)
- [x] Chapter 10 - FIXED
- [x] Chapters 11-57 - ALL FIXED (January 19, 2026)

### Bulk Fix Summary (Chapters 11-57)

All chapters 11-57 were processed on January 19, 2026 using automated agents. The following issues were addressed:

**Issue #1: Supplementary Content Bloat** - Removed from ALL chapters:
- Questions for Personal Application
- Special Terms lists
- Bibliography sections
- Scripture Memory Passages
- Hymn lyrics
- Logos export footers

**Issue #2: Subsection Truncation** - Fixed in select chapters:
- Chapter 11: Section B intro emptied, B.1-B.5 content restored
- Chapter 15: Section E intro emptied, E.1-E.6 content restored
- Chapter 19: Section D intro emptied, D.1-D.2 content restored
- Chapter 21: Sections B & C intros emptied, subsections restored
- Chapter 22: Section C.3 content restored
- Chapter 30: Section A.2 content restored
- Chapter 45: Section F intro emptied, F.1-F.4 content restored
- Chapter 47: Multiple subsections (A.2-A.4, C.1-C.4, D.1-D.9) content restored
- Chapter 49: Section F intro emptied, F.1-F.2 content restored
- Chapter 50: Section C intro emptied, C.1-C.3 content restored
- Chapter 54: Section F.1-F.3 manually restored (see detailed fix below)

**Verification Results:**
- 0 entries with "Exported from Logos" text
- 0 entries with "QUESTIONS FOR PERSONAL APPLICATION"
- 0 entries with "SPECIAL TERMS"
- 0 entries with Bibliography headers
- Total content: 3,412,061 characters across 57 chapters

---

## Truncation Scope Assessment (January 20, 2026)

After fixing supplementary bloat in all chapters, a spot-check of Chapter 54 revealed widespread subsection truncation that was NOT addressed by the automated agents.

### Statistics

| Metric | Value |
|--------|-------|
| Total subsections | 465 |
| Truncated (< 500 chars) | 110 |
| Percentage truncated | 23.7% |
| Chapters affected | 28 of 44 with subsections |

### Most Affected Chapters

| Chapter | Subsections | Truncated | % |
|---------|-------------|-----------|---|
| 12 - Communicable Attributes | 33 | 26 | 79% |
| 14 - The Trinity | 15 | 8 | 53% |
| 16 - God's Providence | 28 | 7 | 25% |
| 52 - Gifts of the Holy Spirit (1) | 16 | 7 | 44% |
| 19 - Angels | 18 | 6 | 33% |
| 26 - The Person of Christ | 15 | 6 | 40% |
| 53 - Gifts of the Holy Spirit (2) | 19 | 5 | 26% |

### What "Truncated" Means

Example from Chapter 26, Section A, Subsection 2 (114 chars total):
```html
<span style="font-weight:bold;">2. Human Weaknesses and Limitations</span>
```

This is JUST the header text. The actual content about Jesus' human weaknesses (hunger, thirst, fatigue, limited knowledge, etc.) is missing. It exists in the parent Section A content (49,023 chars) but users clicking "A.2" in the tree see only this stub.

### Fix Required

All 110 truncated subsections need their content extracted from the HTML source and restored. The parent section content is CORRECT and should not be modified.

---

### Chapter 54 - Manual Fix Required

During spot-checking, Chapter 54 (The Return of Christ) Section F was found to have severe truncation that the automated agents missed:

**Before manual fix:**
- F.1 (Verses Predicting Sudden Coming): 329 chars (should have ~20 Scripture quotations)
- F.2 (Signs That Precede Christ's Return): 424 chars (should have signs a-g with extensive quotes)
- F.3 (Can These Two Sets of Passages Be Reconciled?): 355 chars (should have 3 possible solutions)

**After manual fix:**
- F.1: 329 → 8,335 chars (restored all Scripture quotations from Matt 24:42-44 through Rev 22:20)
- F.2: 424 → 6,442 chars (restored signs a-g: Gospel preaching, Tribulation, False prophets, Signs in heavens, Man of sin, Salvation of Israel, Conclusions)
- F.3: 355 → 21,137 chars (restored full discussion of three reconciliation approaches)

**Lesson learned:** Small char counts (<500) for subsections that should contain extensive content require manual verification against HTML source.

### Systematic Fix Approach
For each chapter:
1. Query DB: `SELECT section_letter, subsection_number, title, length(content) FROM systematic_theology WHERE chapter_number = X ORDER BY sort_order;`
2. Check for red flags:
   - Section intro with large char count when subsections exist
   - Subsections with suspiciously small char counts (< 1000 chars often means truncated)
   - Last section with very large char count (likely has supplementary bloat)
3. Read HTML file to verify correct content boundaries
4. Fix using SQL UPDATE statements

---

## Import Script Bug Analysis & Fix

### Root Cause of Subsection Truncation

**Location:** `scripts/import-systematic-theology.cjs`, lines 456-481 (original)

**The Bug:** When a subsection header was detected (e.g., `<span style="font-weight:bold;">1. Title.</span>`), the script:
1. Created a new subsection entry
2. Captured only the first paragraph (the one containing the header)
3. Immediately called `continue;` to move to the next paragraph
4. Had no tracking of "current subsection" - subsequent paragraphs fell through to the regular content handler
5. The regular content handler added paragraphs to `currentSection` instead of the subsection

**Result:** Each subsection only contained its header paragraph. All subsequent paragraphs were incorrectly appended to the parent section's content.

### The Fix (Applied January 20, 2026)

Added `currentSubsection` tracking variable to maintain state across paragraph iterations:

```javascript
// Line 333: Added tracking variable
let currentSubsection = null;  // Track current subsection for content collection

// Line 430: Reset when new chapter starts
currentSubsection = null;

// Line 455: Reset when new section starts
currentSubsection = null;

// Lines 467-482: Set currentSubsection when detected
currentSubsection = {
  id: uuidv4(),
  entryType: 'subsection',
  // ... other properties
  content: convertContent(pContent),
};
entries.push(currentSubsection);

// Line 496: Updated content handler priority
const target = currentSubsection || currentSection || currentChapter;
if (target) {
  target.content += (target.content ? '\n' : '') + `<p>${convertedContent}</p>`;
}
```

**Key insight:** The content handler now checks `currentSubsection` first, so paragraphs after a subsection header are correctly appended to that subsection until a new subsection/section/chapter is encountered.

---

## Truncated Subsection Fix - January 20, 2026

### Scope
Fixed 90 truncated subsections across 28 chapters. These subsections contained only header text (~100-500 chars) instead of their full extracted content.

### Processing Summary

| Batch | Chapters | Subsections Fixed |
|-------|----------|-------------------|
| 1 | 14, 16, 52 | 22 |
| 2 | 12, 19, 26, 53 | 23 |
| 3 | 23, 24, 27, 28 | 13 |
| 4 | 44, 46, 55, 56 | 12 |
| 5 | 1, 13, 18, 33, 41, 50, 51 | 14 |
| 6 | 20, 32, 38, 39, 43, 57 | 6 |
| **Total** | **28 chapters** | **90 subsections** |

### Content Size Improvement

| Metric | Before | After |
|--------|--------|-------|
| Total subsection content | 900,282 chars | 1,665,573 chars |
| Content added | - | +765,291 chars (85% increase) |

### Intentionally Short Subsections (Not Bugs)

4 subsections remain under 500 chars but are **correctly short** per the source material:

| Chapter | Subsection | Length | Reason |
|---------|------------|--------|--------|
| 16 | H.5 | 215 | Intro paragraph before sub-items a,b,c,d |
| 23 | C.6 | 330 | Brief trichotomist argument; response in D section |
| 23 | C.7 | 455 | Brief trichotomist argument; response in D section |
| 52 | B.3 | 363 | Refers to chapter 17 for full discussion |

### Chapter 12 Note

Chapter 12 has 20 "outline" subsections WITHOUT section letters (just numbers 1-20). These are from a table-of-contents outline at the beginning of the chapter and are intentionally short (~120 chars each). They are NOT truncated content - only the 6 section subsections (A.1, B.3, B.5, C.6, C.7, C.8) needed fixes.

### Processing Applied

For each subsection:
1. Located HTML source file in `/Users/b1ackswan/code/Sacred/myfiles/grudem-systematic-theology/`
2. Extracted full content from subsection header to next header
3. Converted scripture refs: `href="https://ref.ly/Jn1.1"` → `data-scripture="JHN.1.1" class="scripture-link"`
4. Stripped page markers and Logos metadata links
5. Updated database with parameterized Python queries to handle quote escaping

---

## Aggregate Section Content Fix - January 20, 2026

### Problem

When viewing a chapter (e.g., clicking "Chapter 54" in the tree), section content was incomplete:
- API returned chapter + direct children (sections A-F)
- Section F content was only 711 chars (the intro paragraph)
- **Missing**: Subsections F.1, F.2, F.3 content (35,914 chars)

Users reading at the chapter level didn't see complete section content - they'd have to click each subsection individually.

### Solution

**Part 1: Aggregate subsection content into parent sections**

Created `scripts/aggregate-section-content.cjs` to update each section's `content` field to include:
```
[section intro]
[subsection 1 content (includes embedded header)]
[subsection 2 content (includes embedded header)]
...
```

Subsection content already includes headers like `<span style="font-weight:bold;">1. Title</span>`, so concatenation preserves the reading flow.

**Results:**
- 98 sections updated with aggregated content
- Section F (Ch54): 711 → 36,628 chars
- Total section content: ~530K → 4.1M chars

**Part 2: Add inline section headers to chapter view**

Modified `SystematicPanel.jsx` to render section titles as visible headers:
```jsx
{section.sectionLetter && section.title && (
  <h3 className={styles.inlineSectionHeader}>
    {section.sectionLetter}. {section.title}
  </h3>
)}
```

Also filtered to only render sections (not subsections) since subsection content is now aggregated into parent sections.

Added CSS styling in `Systematic.module.css`:
```css
.inlineSectionHeader {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--accent);
  margin: 0 0 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border);
}
```

### Files Changed

| File | Change |
|------|--------|
| `scripts/aggregate-section-content.cjs` | New script to aggregate subsection content into sections |
| `src/components/Systematic/SystematicPanel.jsx` | Added inline section headers, filtered out subsections |
| `src/components/Systematic/Systematic.module.css` | Added `.inlineSectionHeader` style |

### Result

When viewing Chapter 54, users now see:
- Chapter intro
- **A. [Section Title]** ← styled header with accent color and border
- Section A content (includes any subsection content with embedded headers)
- **B. [Section Title]**
- Section B content
- ...
- **F. Could Christ Come Back at Any Time?**
- Section F content with "1. Verses Predicting...", "2. Signs That Precede...", "3. Possible Solutions" embedded

---

## UI Enhancement: Nested Chapter Dropdowns - January 20, 2026

### Problem

When a Part was expanded in the Systematic Tree sidebar, ALL chapter sections were visible at once. With some parts having 10+ chapters, each with 4-6 sections, the tree became overwhelming and difficult to navigate.

### Solution

Added expandable/collapsible chapter sections:

1. **Chevron icons on chapters** - Chapters with sections show a clickable chevron on the left
2. **Click chevron to toggle** - Expands/collapses the chapter's sections (doesn't open chapter content)
3. **Click chapter title to open** - Opens the full chapter content in the panel (unchanged behavior)
4. **"Expand All | Collapse All" controls** - Above the tree for quick navigation
5. **Sections hidden by default** - Cleaner initial view when expanding a Part

### Files Changed

| File | Change |
|------|--------|
| `src/components/Layout/SystematicTree.jsx` | Added `expandedChapters` state, toggle handlers, expand/collapse all handlers, UI controls, chevron-enabled chapter rows |
| `src/components/Layout/SystematicTree.module.css` | Added `.treeControls`, `.expandCollapseBtn`, `.controlsDivider`, `.chapterRow`, `.chapterChevron`, `.chapterChevronSpacer` styles |

### Implementation Details

**State:**
```jsx
const [expandedChapters, setExpandedChapters] = useState({});
```

**Handlers:**
```jsx
const handleChapterToggle = (e, chapterId) => {
  e.stopPropagation(); // Prevent opening chapter content
  setExpandedChapters(prev => ({
    ...prev,
    [chapterId]: !prev[chapterId]
  }));
};

const handleExpandAll = () => {
  const allChapterIds = {};
  tree.forEach(part => {
    part.children?.forEach(child => {
      if (child.entryType === 'chapter') {
        allChapterIds[child.id] = true;
      }
    });
  });
  setExpandedChapters(allChapterIds);
};

const handleCollapseAll = () => {
  setExpandedChapters({});
};
```

**Chapter Row Structure:**
```jsx
<div className={styles.chapterRow}>
  {/* Chevron - only if chapter has sections */}
  {chapter.children?.some(c => c.entryType === 'section') ? (
    <button className={styles.chapterChevron} onClick={(e) => handleChapterToggle(e, chapter.id)}>
      <svg className={`${styles.chevron} ${expandedChapters[chapter.id] ? styles.expanded : ''}`}>
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  ) : (
    <span className={styles.chapterChevronSpacer} />
  )}
  <button className={styles.chapterButton} onClick={() => handleChapterClick(chapter)}>
    ...
  </button>
</div>
```

**Conditional Section Rendering:**
```jsx
{expandedChapters[chapter.id] && chapter.children && chapter.children.length > 0 && (
  <div className={styles.sections}>
    ...
  </div>
)}
```

### User Experience

**Before:**
```
▼ Part 5: Doctrine of Salvation
    Ch 30: Common Grace
      A. Introduction
      B. Examples of Common Grace
      C. The Purposes of Common Grace
    Ch 31: Election
      A. Election Is a Comforting Doctrine
      B. New Testament Teaching
      ...
    (10 more chapters with all sections visible)
```

**After:**
```
Expand All | Collapse All

▼ Part 5: Doctrine of Salvation
  ▶ Ch 30: Common Grace
  ▶ Ch 31: Election
  ▶ Ch 32: The Gospel Call
  ...

(Click chevron to see sections)
  ▼ Ch 31: Election
      A. Election Is a Comforting Doctrine
      B. New Testament Teaching
      ...
```

### Behavior Notes

- Controls hidden during search mode (when `searchQuery` is truthy)
- Controls hidden when tree is empty
- Part expansion (`expandedParts`) is independent of chapter expansion (`expandedChapters`)
- Chapters without sections still align properly (spacer element)
- Chevron rotates 180° when expanded (uses existing `.chevron.expanded` class)

---

## Backup and Restore - January 20, 2026

### Overview

Since the database (`data/sacred.db`) is gitignored and contains processed content that required significant effort to fix (subsection truncation, supplementary removal, AI summaries), a backup/restore system was created.

**IMPORTANT:** The backup file contains copyrighted Grudem content and must NOT be committed to git. It's stored in the gitignored `myfiles/` directory.

### Backup Location

```
myfiles/grudem-sys-theo-parsed/systematic-theology-complete.json (7.4 MB)
```

### What's Included

| Table | Count | Description |
|-------|-------|-------------|
| `systematic_theology` | 776 | Parts, chapters, sections, subsections with full content and AI summaries |
| `systematic_scripture_index` | 4,882 | Scripture references linked to entries |
| `systematic_tags` | 7 | Doctrinal category tags |
| `systematic_chapter_tags` | 42 | Chapter-to-tag associations |
| `systematic_related` | 1 | Related chapter links |

### Restore Command

After a fresh install or database reset, restore with:

```bash
node scripts/restore-systematic-theology.cjs
```

Default paths:
- JSON: `myfiles/grudem-sys-theo-parsed/systematic-theology-complete.json`
- Database: `data/sacred.db`

Custom path:
```bash
node scripts/restore-systematic-theology.cjs /path/to/backup.json
```

The script:
1. Warns and waits 3 seconds if existing data will be replaced
2. Clears all systematic theology tables (respects foreign key order)
3. Inserts all data from backup
4. Shows verification summary

### Creating a Fresh Backup

If you've made changes and want to create a new backup:

```bash
# Navigate to project root
cd /Users/b1ackswan/code/Sacred

# Create backup using sqlite3 and combine with Python
sqlite3 data/sacred.db ".mode json" ".output /tmp/st_main.json" "SELECT * FROM systematic_theology;" ".output /tmp/st_scripture.json" "SELECT * FROM systematic_scripture_index;" ".output /tmp/st_tags.json" "SELECT * FROM systematic_tags;" ".output /tmp/st_chapter_tags.json" "SELECT * FROM systematic_chapter_tags;" ".output /tmp/st_related.json" "SELECT * FROM systematic_related;"

# Combine into single file
python3 -c "
import json
data = {
    'systematic_theology': json.load(open('/tmp/st_main.json')),
    'scripture_index': json.load(open('/tmp/st_scripture.json')),
    'tags': json.load(open('/tmp/st_tags.json')),
    'chapter_tags': json.load(open('/tmp/st_chapter_tags.json')),
    'related': json.load(open('/tmp/st_related.json'))
}
with open('myfiles/grudem-sys-theo-parsed/systematic-theology-complete.json', 'w') as f:
    json.dump(data, f, indent=2)
print(f'Exported: {len(data[\"systematic_theology\"])} entries, {len(data[\"scripture_index\"])} scripture refs')
"

# Clean up temp files
rm /tmp/st_main.json /tmp/st_scripture.json /tmp/st_tags.json /tmp/st_chapter_tags.json /tmp/st_related.json
```

### Verification

After restore, verify counts:

```sql
sqlite3 data/sacred.db "
SELECT 'systematic_theology' as tbl, COUNT(*) as cnt FROM systematic_theology
UNION ALL
SELECT 'scripture_index', COUNT(*) FROM systematic_scripture_index
UNION ALL
SELECT 'tags', COUNT(*) FROM systematic_tags
UNION ALL
SELECT 'chapter_tags', COUNT(*) FROM systematic_chapter_tags
UNION ALL
SELECT 'related', COUNT(*) FROM systematic_related;
"
```

Expected output:
```
systematic_theology|776
scripture_index|4882
tags|7
chapter_tags|42
related|1
```

---

## Additional Notes for Import Script

1. **Strip supplementary material:** Stop parsing when encountering "Questions for Personal Application"

2. **Handle quote blocks:** Preserve `<blockquote>` structure for indented quotes

3. **Scripture reference conversion:** Both formats need handling:
   - Old: `logosref:Bible.Jn1.1` → `data-scripture="JHN.1.1"`
   - New: `https://ref.ly/Jn1.1` → `data-scripture="JHN.1.1"`
