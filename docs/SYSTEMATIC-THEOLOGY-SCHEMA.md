# Systematic Theology Import Schema

This document describes the JSON format for importing systematic theology content into SACRED. You can use this to import your own licensed theological works.

## Overview

The import file is a JSON object containing five arrays:

```json
{
  "systematic_theology": [],
  "scripture_index": [],
  "tags": [],
  "chapter_tags": [],
  "related": []
}
```

Only `systematic_theology` is required. The others are optional but enhance functionality.

## Entry Hierarchy

Content is organized in a four-level hierarchy:

```
Part (e.g., "Doctrine of God")
└── Chapter (e.g., "The Attributes of God")
    └── Section (e.g., "A. Incommunicable Attributes")
        └── Subsection (e.g., "1. Independence")
```

Each level is optional. You could have just chapters, or chapters with sections but no subsections.

---

## systematic_theology

The main content entries.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | UUID (e.g., `"550e8400-e29b-41d4-a716-446655440000"`) |
| `entry_type` | string | Yes | One of: `"part"`, `"chapter"`, `"section"`, `"subsection"` |
| `part_number` | integer | No | Part number (1, 2, 3...) for parts and their children |
| `chapter_number` | integer | No | Chapter number (1, 2, 3...) for chapters and below |
| `section_letter` | string | No | Section identifier (A, B, C...) for sections and subsections |
| `subsection_number` | integer | No | Subsection number (1, 2, 3...) |
| `title` | string | Yes | Display title |
| `content` | string | No | HTML content (can include formatting, lists, etc.) |
| `summary` | string | No | Brief summary or description |
| `parent_id` | string | No | UUID of parent entry (null for top-level parts) |
| `sort_order` | integer | Yes | Controls display order (0, 1, 2...) |
| `word_count` | integer | No | Word count of content (for display) |
| `created_at` | string | Yes | ISO timestamp (e.g., `"2024-01-15T10:30:00.000Z"`) |
| `updated_at` | string | Yes | ISO timestamp |

### Example Entries

**Part (top level):**
```json
{
  "id": "part-1-uuid",
  "entry_type": "part",
  "part_number": 1,
  "chapter_number": null,
  "section_letter": null,
  "subsection_number": null,
  "title": "The Doctrine of the Word of God",
  "content": "<p>Introduction to this part...</p>",
  "summary": "Covers Scripture, authority, canon, and interpretation",
  "parent_id": null,
  "sort_order": 0,
  "word_count": 150,
  "created_at": "2024-01-15T10:00:00.000Z",
  "updated_at": "2024-01-15T10:00:00.000Z"
}
```

**Chapter:**
```json
{
  "id": "chapter-1-uuid",
  "entry_type": "chapter",
  "part_number": 1,
  "chapter_number": 1,
  "section_letter": null,
  "subsection_number": null,
  "title": "The Word of God",
  "content": "<p>Chapter content here...</p>",
  "summary": "Examines what Scripture says about itself",
  "parent_id": "part-1-uuid",
  "sort_order": 0,
  "word_count": 5000,
  "created_at": "2024-01-15T10:00:00.000Z",
  "updated_at": "2024-01-15T10:00:00.000Z"
}
```

**Section:**
```json
{
  "id": "section-1a-uuid",
  "entry_type": "section",
  "part_number": 1,
  "chapter_number": 1,
  "section_letter": "A",
  "subsection_number": null,
  "title": "The Authority of Scripture",
  "content": "<p>Section content...</p>",
  "summary": null,
  "parent_id": "chapter-1-uuid",
  "sort_order": 0,
  "word_count": 1200,
  "created_at": "2024-01-15T10:00:00.000Z",
  "updated_at": "2024-01-15T10:00:00.000Z"
}
```

**Subsection:**
```json
{
  "id": "subsection-1a1-uuid",
  "entry_type": "subsection",
  "part_number": 1,
  "chapter_number": 1,
  "section_letter": "A",
  "subsection_number": 1,
  "title": "All Words in Scripture Are God's Words",
  "content": "<p>Subsection content...</p>",
  "summary": null,
  "parent_id": "section-1a-uuid",
  "sort_order": 0,
  "word_count": 800,
  "created_at": "2024-01-15T10:00:00.000Z",
  "updated_at": "2024-01-15T10:00:00.000Z"
}
```

---

## scripture_index

Maps Bible references to systematic theology entries. Enables "Related Doctrines" when reading Scripture.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | UUID |
| `systematic_id` | string | Yes | UUID of the systematic_theology entry |
| `book` | string | Yes | 3-letter book code (see Book Codes below) |
| `chapter` | integer | Yes | Bible chapter number |
| `start_verse` | integer | No | Starting verse (null for chapter-level) |
| `end_verse` | integer | No | Ending verse (null for single verse) |
| `is_primary` | integer | No | 1 if primary reference, 0 otherwise |
| `context_snippet` | string | No | Brief context note |
| `created_at` | string | Yes | ISO timestamp |

### Example

```json
{
  "id": "scripture-ref-uuid",
  "systematic_id": "chapter-1-uuid",
  "book": "2TI",
  "chapter": 3,
  "start_verse": 16,
  "end_verse": 17,
  "is_primary": 1,
  "context_snippet": "All Scripture is God-breathed",
  "created_at": "2024-01-15T10:00:00.000Z"
}
```

### Book Codes

Use standard 3-letter codes:

| OT | Code | NT | Code |
|----|------|----|------|
| Genesis | GEN | Matthew | MAT |
| Exodus | EXO | Mark | MRK |
| Leviticus | LEV | Luke | LUK |
| Numbers | NUM | John | JHN |
| Deuteronomy | DEU | Acts | ACT |
| Joshua | JOS | Romans | ROM |
| Judges | JDG | 1 Corinthians | 1CO |
| Ruth | RUT | 2 Corinthians | 2CO |
| 1 Samuel | 1SA | Galatians | GAL |
| 2 Samuel | 2SA | Ephesians | EPH |
| 1 Kings | 1KI | Philippians | PHP |
| 2 Kings | 2KI | Colossians | COL |
| 1 Chronicles | 1CH | 1 Thessalonians | 1TH |
| 2 Chronicles | 2CH | 2 Thessalonians | 2TH |
| Ezra | EZR | 1 Timothy | 1TI |
| Nehemiah | NEH | 2 Timothy | 2TI |
| Esther | EST | Titus | TIT |
| Job | JOB | Philemon | PHM |
| Psalms | PSA | Hebrews | HEB |
| Proverbs | PRO | James | JAS |
| Ecclesiastes | ECC | 1 Peter | 1PE |
| Song of Solomon | SNG | 2 Peter | 2PE |
| Isaiah | ISA | 1 John | 1JN |
| Jeremiah | JER | 2 John | 2JN |
| Lamentations | LAM | 3 John | 3JN |
| Ezekiel | EZK | Jude | JUD |
| Daniel | DAN | Revelation | REV |
| Hosea | HOS | | |
| Joel | JOL | | |
| Amos | AMO | | |
| Obadiah | OBA | | |
| Jonah | JON | | |
| Micah | MIC | | |
| Nahum | NAM | | |
| Habakkuk | HAB | | |
| Zephaniah | ZEP | | |
| Haggai | HAG | | |
| Zechariah | ZEC | | |
| Malachi | MAL | | |

---

## tags

Category tags for filtering chapters (e.g., "Doctrine of God", "Christology").

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | UUID |
| `name` | string | Yes | Display name |
| `color` | string | No | Hex color (e.g., `"#4a90d9"`) |
| `sort_order` | integer | No | Display order |
| `created_at` | string | Yes | ISO timestamp |

### Example

```json
{
  "id": "tag-doctrine-of-god-uuid",
  "name": "Doctrine of God",
  "color": "#4a90d9",
  "sort_order": 0,
  "created_at": "2024-01-15T10:00:00.000Z"
}
```

---

## chapter_tags

Links tags to chapters (many-to-many relationship).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `chapter_number` | integer | Yes | Chapter number |
| `tag_id` | string | Yes | UUID of the tag |

### Example

```json
{
  "chapter_number": 11,
  "tag_id": "tag-doctrine-of-god-uuid"
}
```

---

## related

Cross-references between chapters ("See Also" links).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | UUID |
| `source_chapter` | integer | Yes | Chapter number of source |
| `target_chapter` | integer | Yes | Chapter number of target |
| `relationship_type` | string | No | Type: `"see_also"`, `"prerequisite"`, `"contrast"` |
| `note` | string | No | Explanation of relationship |
| `created_at` | string | Yes | ISO timestamp |

### Example

```json
{
  "id": "related-uuid",
  "source_chapter": 11,
  "target_chapter": 12,
  "relationship_type": "see_also",
  "note": "Continues discussion of divine attributes",
  "created_at": "2024-01-15T10:00:00.000Z"
}
```

---

## Linking in Notes

Once imported, you can link to entries from your notes using this syntax:

| Link | Target |
|------|--------|
| `[[ST:Ch1]]` | Chapter 1 |
| `[[ST:Ch1:A]]` | Section A of Chapter 1 |
| `[[ST:Ch1:A.1]]` | Subsection 1 of Section A, Chapter 1 |

---

## Minimal Example

A complete minimal import with one chapter:

```json
{
  "systematic_theology": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "entry_type": "chapter",
      "part_number": null,
      "chapter_number": 1,
      "section_letter": null,
      "subsection_number": null,
      "title": "Introduction to Theology",
      "content": "<h2>What is Theology?</h2><p>Theology is the study of God...</p>",
      "summary": "An introduction to the study of God",
      "parent_id": null,
      "sort_order": 0,
      "word_count": 500,
      "created_at": "2024-01-15T10:00:00.000Z",
      "updated_at": "2024-01-15T10:00:00.000Z"
    }
  ]
}
```

---

## Tips for Creating Your Own Content

1. **Generate UUIDs**: Use any UUID v4 generator. Each entry needs a unique ID.

2. **Parent relationships**: Set `parent_id` to link children to parents. The tree view depends on this.

3. **Sort order**: Use `sort_order` to control display sequence within each level.

4. **HTML content**: The `content` field supports HTML. Use `<h2>`, `<p>`, `<ul>`, `<ol>`, `<blockquote>`, etc.

5. **Scripture references**: Adding `scripture_index` entries enables the "Related Doctrines" feature when reading Bible chapters.

6. **Incremental import**: You can import multiple times. Existing entries with the same ID will be updated.

7. **Backup first**: Export your existing data before importing new content.

---

## Importing

1. Go to Settings (gear icon)
2. Under "Systematic Theology", click "Import Systematic Theology"
3. Select your JSON file
4. Confirm the import

The import replaces existing systematic theology content but preserves your personal annotations.
