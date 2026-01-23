# SACRED MCP Tools - Quick Reference

You have access to my SACRED Bible study app via MCP tools. Use them for all Bible study requests.

## Key Tools

| Task | Tool |
|------|------|
| Find my notes | `get_chapter_notes(book, chapter)` or `search_notes(query)` |
| Search doctrines | `search_systematic_theology(query)` |
| Get doctrine content | `get_systematic_section("Ch32")` or `"Ch32:A"` |
| Doctrines for a passage | `find_doctrines_for_passage(book, chapter)` |
| Sermon prep | `summarize_doctrine_for_sermon(chapterNumber)` |
| Simple explanation | `explain_doctrine_simply(chapterNumber)` |
| Create note | `create_note(book, startChapter, endChapter, ...)` |
| Statistics | `get_notes_summary()`, `get_systematic_summary()` |

## Book Codes
Use 3-letter codes: GEN, EXO, LEV, NUM, DEU, JOS, JDG, RUT, 1SA, 2SA, 1KI, 2KI, 1CH, 2CH, EZR, NEH, EST, JOB, PSA, PRO, ECC, SNG, ISA, JER, LAM, EZK, DAN, HOS, JOL, AMO, OBA, JON, MIC, NAM, HAB, ZEP, HAG, ZEC, MAL, MAT, MRK, LUK, JHN, ACT, ROM, 1CO, 2CO, GAL, EPH, PHP, COL, 1TH, 2TH, 1TI, 2TI, TIT, PHM, HEB, JAS, 1PE, 2PE, 1JN, 2JN, 3JN, JUD, REV

## Doctrine Chapters (1-57)
- Ch1-8: Scripture (Word of God, Canon, Authority, Inerrancy, Clarity, Necessity, Sufficiency)
- Ch9-14: God (Existence, Knowability, Attributes, Trinity)
- Ch15-20: Creation & Providence (Creation, Providence, Miracles, Prayer, Angels, Demons)
- Ch21-25: Humanity (Creation of Man, Male/Female, Nature, Sin, Covenants)
- Ch26-31: Christ & Spirit (Person, Atonement, Resurrection, Offices, Holy Spirit, Common Grace)
- Ch32-43: Salvation (Election, Calling, Regeneration, Conversion, Justification, Adoption, Sanctification, Perseverance, Death, Glorification, Union with Christ)
- Ch44-53: Church (Nature, Purity, Power, Government, Means of Grace, Baptism, Lord's Supper, Worship, Spiritual Gifts)
- Ch54-57: Last Things (Return of Christ, Millennium, Judgment, New Heavens/Earth)

## Example Requests

"What notes do I have on Romans 8?"
→ Use `get_chapter_notes("ROM", 8)`

"Help me understand justification"
→ Use `search_systematic_theology("justification")` then `get_systematic_section("Ch36")`

"Prepare sermon material on John 3"
→ Use `get_chapter_notes("JHN", 3)` + `find_doctrines_for_passage("JHN", 3)` + `summarize_doctrine_for_sermon(34)` (regeneration)

"Explain predestination simply"
→ Use `explain_doctrine_simply(32)`

## Note Format
- Content is HTML (from rich text editor)
- Types: "note", "commentary", "sermon"
- Link to doctrines with `[[ST:Ch32]]` syntax
