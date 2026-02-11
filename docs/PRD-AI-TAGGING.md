# PRD: AI-Powered Tagging System

**Status:** Future feature — build after commentaries and sermons are loaded
**Owner:** SACRED (canonical system — CC-Sermon-Writer consumes via MCP)

---

## Problem

SACRED has 132 topics in a hierarchical tree and 6 inline tag types, but most notes are untagged. With 170+ commentary imports and growing sermon archives, manual tagging is impractical. The existing `auto_tag_note` MCP tool is a basic proof-of-concept that suggests topics based on passage-to-doctrine mapping — it doesn't analyze note content, detect illustrations, or understand theological themes.

The tagging system needs to be comprehensive enough to make the entire note library searchable by topic, theme, rhetorical function, and doctrinal connection — turning a pile of imported text into an organized pastoral resource.

## Vision

A two-phase AI tagging system that:
1. **Formalizes the taxonomy** — expands and structures the topic tree and inline tag types into a comprehensive, pastorally-useful classification system
2. **Applies tags intelligently** — uses AI to analyze note content and apply both topic tags and inline tags, with supervised and fully-automatic modes

## What Exists Today

### Topic Taxonomy (132 topics, 4 root nodes)
```
Doctrinal (43 notes)
  ├── Word of God (1)
  ├── God → Trinity, Attributes, Wrath, Love, Providence (4)
  ├── Man → Image of God, Fall, Depravity, Human Nature, Moral Accountability (8)
  ├── Christ → Gospel, Incarnation, Atonement, Resurrection, Ascension (3)
  ├── Holy Spirit → Baptism, Filling, Fruit, Power (8)
  ├── Salvation → Election, Calling, Regeneration, Conversion, Justification,
  │                Adoption, Sanctification, Perseverance, Glorification, Union (31)
  ├── Church → Nature, Marks, Baptism, Communion, Accountability, Offices (4)
  ├── Angels & Demons → Angels, Satan, Demons, Spiritual Warfare (0)
  └── Future → Return, Resurrection, Judgment, Heaven, Hell, New Creation (8)

Pastoral (22 notes)
  ├── Spiritual Life → Prayer, Worship, Faith, Obedience, Disciplines, Fasting (9)
  ├── Ministry & Service → Evangelism, Discipleship, Leadership, Gifts, Missions,
  │                         Giving, Hospitality (9)
  ├── Life Challenges → Suffering, Grief, Anxiety, Healing, Forgiveness,
  │                      Temptation, Death (6)
  ├── Christian Character → Holiness, Humility, Boldness, Patience, Gratitude,
  │                          Love, Joy, Peace, Hope, Sacrifice (3)
  ├── Relationships → With God, Marriage, Parenting, Singleness, Friendship, Community (1)
  ├── Church Life → Unity, Membership, Offices (2)
  ├── Work & World → Vocation, Rest, Money, Culture, Justice, Creation Care (1)
  └── Sin → Hypocrisy, Self-Righteousness (2)

Sermon Resources (0 notes)
  ├── Illustrations (0)
  ├── Quotes (0)
  ├── Word Studies (0)
  ├── Applications (0)
  ├── Outlines (0)
  ├── Series (0)
  └── Special Occasions → Wedding, Funeral, Baptism, Communion, Ordination,
                           Dedication, Holiday, Special Event (0)

Apologetics (5 notes)
  ├── Existence of God (0)
  ├── General Revelation (2)
  ├── Problem of Evil (0)
  ├── Reliability of Scripture (0)
  └── Resurrection Evidence (0)
```

### Inline Tag Types (6)
| ID | Name | Purpose |
|----|------|---------|
| `illustration` | Illustration | Stories, analogies, parables, historical vignettes |
| `application` | Application | Practical "so what" takeaways |
| `keypoint` | Key Point | Central theological claims or insights |
| `quote` | Quote | Attributed quotes from commentators, theologians, etc. |
| `crossref` | Cross-Ref | Scripture cross-references within note content |
| `word-study` | Word Study | Greek/Hebrew word analysis |

### Existing MCP Tools
| Tool | What It Does | Limitation |
|------|-------------|------------|
| `auto_tag_note` | Suggests topics based on passage-to-doctrine mapping | Doesn't analyze content — only uses verse range |
| `suggest_topics_for_passage` | Returns topic suggestions for a book/chapter | Same limitation |
| `insert_doctrine_links` | Finds and inserts `[[ST:ChN]]` links | Works, but only for doctrine links |

### Current Data (as of 2026-02-11)
- **178 notes** (170 commentary, 8 sermons)
- **Books covered:** Romans (153), Philippians (25)
- **Tagged notes:** ~65 have primary/secondary topics (mostly sermons and some Romans commentary)
- **Inline-tagged content:** Minimal — mostly from Motyer Philippians import enrichment
- **Untagged:** ~110+ commentary notes with no topics assigned

---

## Phase 1: Taxonomy Formalization

### Goal
Review and expand the topic tree and inline tag types so they comprehensively cover what a pastor needs when searching their note library. The taxonomy should answer: "I'm preaching on X — what do I have?"

### Taxonomy Design Principles
1. **Pastorally useful, not academically exhaustive** — organize by how Rick actually searches for material
2. **Stable categories** — topics should be broad enough to accumulate many notes, not so narrow they hold 1-2
3. **Clear hierarchy** — a note should have an obvious primary topic; secondary tags handle cross-cutting themes
4. **Compatible with Grudem** — the `systematicTagId` field on topics can link to systematic theology tags for cross-referencing

### Proposed Taxonomy Review Areas

**Topics to potentially add:**
- Covenant theology (missing entirely — important for Rick's framework)
- Grace (surprisingly absent as a standalone topic)
- Repentance (only exists under "Conversion" implicitly)
- Kingdom of God / Kingdom theology
- Law and Gospel relationship
- Idolatry (common preaching theme)
- Identity in Christ
- Assurance of salvation
- Conscience
- Spiritual blindness / hardness of heart
- Old Testament theology topics (creation, exodus, exile, restoration)
- Preaching / homiletics (meta-topic for sermon craft notes)

**Topics to potentially reorganize:**
- "Sermon Resources" root has 0 notes — may be better as inline tag categories rather than topics
- "Sin" is under "Pastoral" but could be under "Doctrinal > Man"
- "Apologetics" may work better as a child of "Doctrinal" or "Ministry"

**Inline tag types to potentially add:**
- `doctrine` — Doctrinal teaching/explanation passages within notes
- `pastoral` — Pastoral counsel or pastoral theology passages
- `exegetical` — Detailed exegesis or textual analysis
- `historical` — Historical background or context
- `outline-point` — Sermon outline main points (for sermon notes)
- `prayer` — Prayer content within sermons

### Deliverables
- [ ] Finalized topic tree (exported as JSON for reproducibility)
- [ ] Finalized inline tag type list
- [ ] Migration plan for any reorganized topics (move notes, not delete)
- [ ] Updated `seed_topics` default taxonomy

---

## Phase 2: AI Tagging Engine

### Goal
Build an AI-powered system that analyzes note content and applies both topic tags and inline tags. Two modes: supervised (human-in-the-loop) and automatic.

### Architecture

The tagging engine lives in SACRED, exposed via:
1. **MCP tools** — for CC-Sermon-Writer and Claude Code to call
2. **UI workflow** — for Rick to review and approve tags in the app

```
┌─────────────────────────────────────────────────┐
│                   SACRED App                     │
│                                                  │
│  ┌──────────┐    ┌──────────────┐               │
│  │ Tag      │    │ Batch Tag    │               │
│  │ Review   │◄───│ Queue UI     │               │
│  │ Modal    │    │ (new)        │               │
│  └──────────┘    └──────────────┘               │
│       │                │                         │
│       ▼                ▼                         │
│  ┌──────────────────────────┐                   │
│  │   Tagging Engine API     │                   │
│  │   /api/tagging/*         │                   │
│  └──────────────────────────┘                   │
│       │                │                         │
│       ▼                ▼                         │
│  ┌──────────┐    ┌──────────────┐               │
│  │ Topic    │    │ Inline Tag   │               │
│  │ Analyzer │    │ Detector     │               │
│  └──────────┘    └──────────────┘               │
│                                                  │
├─────────────── MCP Layer ────────────────────────┤
│  analyze_note_topics     (preview suggestions)   │
│  analyze_note_inline     (detect inline content) │
│  batch_tag_notes         (process N notes)       │
│  get_tagging_queue       (untagged notes)        │
│  apply_tag_suggestions   (commit approved tags)  │
└─────────────────────────────────────────────────┘
         ▲
         │ MCP calls
         │
┌────────┴────────┐
│ CC-Sermon-Writer │  (auto-tags after import)
└─────────────────┘
```

### Topic Analyzer

**Input:** Note content (HTML), verse range, existing doctrine links
**Output:** Suggested primary topic + secondary topic tags with confidence scores

**Strategy (rules + heuristics, no external AI API required):**

1. **Keyword matching** — scan note content for topic-related terms
   - Build a keyword map per topic (e.g., "justification" → Justification, "sanctify/sanctification/holy/holiness" → Sanctification)
   - Weight by frequency, position (title > heading > body), and proximity to verse references

2. **Doctrine-to-topic mapping** — leverage the existing `systematicTagId` field
   - If a note has `[[ST:Ch36]]` (Justification), suggest the Justification topic
   - Map all 57 Grudem chapters to their corresponding topics

3. **Passage heuristics** — certain books/chapters strongly correlate with topics
   - Romans 3-5 → Justification, Romans 6-8 → Sanctification, Romans 9-11 → Election
   - These are fallback signals when content analysis is ambiguous

4. **Content type awareness** — commentary vs. sermon vs. note may weight differently
   - Commentary: weight toward doctrinal/exegetical topics
   - Sermon: weight toward pastoral/application topics
   - Note: neutral weighting

**Confidence levels:**
- `high` (>0.8) — strong keyword match + passage correlation + doctrine link
- `medium` (0.5-0.8) — two of three signals agree
- `low` (<0.5) — single weak signal

### Inline Tag Detector

**Input:** Note content (HTML)
**Output:** Text ranges with suggested inline tag types

**Detection strategies per tag type:**

| Tag Type | Detection Signals |
|----------|-------------------|
| `illustration` | Narrative markers ("imagine", "picture this", "there was a"), named parables ("The Parable of..."), historical vignettes (proper nouns + past tense narrative), analogy markers ("it's like", "consider") |
| `application` | Imperative verbs ("we must", "let us", "you should"), practical language ("in your daily life", "this week", "when you"), second person address in teaching context |
| `keypoint` | Thesis statements near section headings, sentences following "the point is" / "what this means" / "in other words", bolded or emphasized text |
| `quote` | Attribution patterns ("as X says", "X writes", "according to X"), text in quotation marks followed by citation, italic blocks with citations |
| `crossref` | Scripture reference patterns (Book chapter:verse), existing cross-ref inline tags |
| `word-study` | Greek/Hebrew transliterations (parenthesized foreign words), "the word X means", "in the original", Strong's numbers |
| `doctrine` | Systematic theology vocabulary, creedal formulations, "the doctrine of", extended theological explanation |
| `pastoral` | Counseling language, "when you're struggling with", comfort/encouragement patterns, practical wisdom |

### Operating Modes

#### Mode 1: Supervised (Human-in-the-Loop)
- AI analyzes a note and presents suggestions in a review UI
- Rick sees: suggested primary topic, secondary tags, inline tag highlights
- For each suggestion: Accept / Reject / Modify
- Accepted tags are applied immediately
- Rejected patterns feed back into confidence calibration

**UI concept: Tag Review Modal**
```
┌─────────────────────────────────────────────┐
│  Tag Review: "Motyer: The worthy life"      │
│  PHP 2:1-4 | Commentary                     │
│                                             │
│  Primary Topic (suggested):                 │
│  [✓] Sanctification (high confidence)       │
│  [ ] Church Life (medium)                   │
│  [ ] Unity (medium)                         │
│                                             │
│  Secondary Tags (suggested):                │
│  [✓] Unity                                  │
│  [✓] Holy Spirit                            │
│  [ ] Christian Character                    │
│  [+] Add custom...                          │
│                                             │
│  Inline Tags Found:                         │
│  💡 "What a man the apostle was!..."  [✓]   │
│  ⭐ "The life worthy of the gospel..." [✓]  │
│  📖 "paraklēsis / paramythion..."     [✓]   │
│  💬 "Calvin rightly comments..."      [✓]   │
│                                             │
│  [Skip] [Apply Selected] [Apply All]        │
└─────────────────────────────────────────────┘
```

#### Mode 2: Batch Queue
- "Tag Untagged Notes" button in settings or sidebar
- Processes all notes without primary topics
- Shows a queue with progress: "Tagged 45/110 notes"
- Each note gets the review modal, or user can "Auto-apply high-confidence" to skip review for strong matches

#### Mode 3: Full Auto
- Applies all high-confidence suggestions without review
- Medium-confidence suggestions are queued for review
- Low-confidence suggestions are skipped
- Available as MCP tool (`batch_tag_notes(mode="auto")`) for CC-Sermon-Writer post-import

### New MCP Tools

```
analyze_note_topics(noteId)
  → { primary: { topicId, name, confidence }, secondary: [{ topicId, name, confidence }] }

analyze_note_inline_tags(noteId)
  → { suggestions: [{ tagType, startOffset, endOffset, text, confidence }] }

batch_tag_notes(mode="supervised"|"auto", noteIds?[], minConfidence?)
  → { processed: N, tagged: N, skipped: N, queued: N }

get_tagging_queue(status="pending"|"reviewed")
  → { notes: [{ id, title, suggestions }] }

apply_tag_suggestions(noteId, acceptedTopics[], rejectedTopics[], acceptedInline[], rejectedInline[])
  → { applied: N }
```

### CC-Sermon-Writer Integration

After Phase 2 is built in SACRED, CC-Sermon-Writer's import pipeline becomes:

```python
# Current pipeline:
full_import(notes) → auto_tag_note(noteId) → insert_doctrine_links(noteId)

# New pipeline:
full_import(notes) → batch_tag_notes(noteIds, mode="auto") → insert_doctrine_links(noteId)
```

CC-Sermon-Writer doesn't need to know the taxonomy or detection rules. It just calls the MCP tool and SACRED handles classification. If the taxonomy changes, CC-Sermon-Writer's imports automatically get the updated tags.

---

## Implementation Order

### Step 1: Taxonomy Review Session
- Rick and Claude review the current 132 topics together
- Decide what to add, remove, merge, or reorganize
- Finalize inline tag type list
- Export finalized taxonomy as JSON backup
- Time: ~1 session

### Step 2: Keyword Maps + Doctrine-to-Topic Mapping
- Build keyword dictionaries for each topic
- Map all 57 Grudem chapters to topics via `systematicTagId`
- Create passage-to-topic heuristic rules
- Store as data (JSON or DB table), not hardcoded
- Time: ~1 session

### Step 3: Topic Analyzer (Server-Side)
- New API route: `/api/tagging/analyze/:noteId`
- Returns topic suggestions with confidence scores
- New MCP tools: `analyze_note_topics`, `get_tagging_queue`
- Time: ~1-2 sessions

### Step 4: Inline Tag Detector (Server-Side)
- New API route: `/api/tagging/inline/:noteId`
- Returns inline tag suggestions with text ranges
- New MCP tool: `analyze_note_inline_tags`
- Time: ~1-2 sessions

### Step 5: Review UI
- Tag Review Modal component
- Batch queue view (in Settings or dedicated panel)
- Accept/reject/modify workflow
- Time: ~2 sessions

### Step 6: Full Auto Mode + CC-Sermon-Writer Integration
- `batch_tag_notes` MCP tool with auto mode
- Update CC-Sermon-Writer pipeline to call new tool
- Confidence threshold tuning based on supervised results
- Time: ~1 session

---

## Success Metrics

- **Coverage:** >90% of notes have a primary topic assigned
- **Accuracy:** >80% of auto-applied tags accepted without modification in supervised review
- **Findability:** Rick can search "illustrations about grace" and get relevant results
- **Speed:** Batch processing 100 notes completes in <60 seconds
- **Zero SACRED mutations from CC-Sermon-Writer** — all tagging logic lives in SACRED

## Open Questions

1. **External AI vs. local heuristics?** Starting with local keyword/pattern matching avoids API costs and latency. Could add Claude API calls later for hard cases, but the system should work without external AI.

2. **Should inline tag detection modify note HTML directly?** Current inline tags are stored as `<span>` elements in note content. Auto-inserting spans into HTML is risky (could break Tiptap structure). Alternative: store suggestions separately and render as overlays. Needs design decision.

3. **Feedback loop?** Should rejected suggestions reduce confidence for similar future notes? Simple approach: log rejections, manually review patterns periodically. Complex approach: adjust keyword weights automatically.

4. **Multi-language content?** Some commentary has Greek/Hebrew. Word study detection should handle transliterations but doesn't need to parse actual Greek/Hebrew text.

5. **Taxonomy versioning?** If the topic tree changes significantly, should old tags be migrated? Probably yes — but this is a manual review, not an automated migration.
