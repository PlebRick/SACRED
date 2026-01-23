# Claude Cowork Startup Prompt

Copy and paste the following at the start of your Cowork session:

---

I have SACRED, a Bible study app, connected via MCP. Use these tools for all Bible study requests:

**Notes:**
- `get_chapter_notes(book, chapter)` - my notes on a Bible chapter
- `search_notes(query)` - search my notes
- `create_note(book, startChapter, endChapter, title, content, type)` - create note
- `get_notes_summary()` - note statistics

**Systematic Theology (57 chapters on doctrine):**
- `search_systematic_theology(query)` - search doctrine content
- `get_systematic_section(reference)` - get doctrine by "Ch32" or "Ch32:A"
- `find_doctrines_for_passage(book, chapter)` - doctrines citing a passage
- `summarize_doctrine_for_sermon(chapterNumber)` - sermon prep summary
- `explain_doctrine_simply(chapterNumber)` - jargon-free explanation

**Workflow Tools:**
- `sermon_prep_bundle(book, startChapter)` - all sermon prep data at once
- `extract_illustrations(book)` - get all illustration tags
- `extract_applications(book)` - get all application tags

**Book codes:** GEN, EXO, ROM, JHN, ACT, HEB, REV, etc. (3-letter codes)
**Doctrine link syntax:** `[[ST:Ch32]]` links note to chapter 32

Key chapters: Ch14 (Trinity), Ch24 (Sin), Ch27 (Atonement), Ch32 (Election), Ch34 (Regeneration), Ch36 (Justification), Ch38 (Sanctification), Ch40 (Perseverance)

Start by calling `get_notes_summary()` to see what data I have.

---

## Usage Tips

1. **Paste this prompt once** at the start of each Cowork session
2. **Be specific** with requests: "Show my notes on Romans 8" → Claude calls `get_chapter_notes("ROM", 8)`
3. **Reference doctrines by number**: "Explain chapter 36" → Claude calls `explain_doctrine_simply(36)`
4. **For sermon prep**: "Help me prepare a sermon on John 3" triggers the workflow tools

## If Claude Doesn't Use Tools

Sometimes Claude needs a nudge:
- "Use the `get_chapter_notes` tool to show my notes on Romans 8"
- "Call `search_systematic_theology` to find content about justification"
- "Use `sermon_prep_bundle` for sermon preparation"
