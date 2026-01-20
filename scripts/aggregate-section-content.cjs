const Database = require('better-sqlite3');
const db = new Database('/Users/b1ackswan/code/Sacred/data/sacred.db');

// Get all sections that have subsections
const sectionsWithSubsections = db.prepare(`
  SELECT s.id, s.chapter_number, s.section_letter, s.title, s.content
  FROM systematic_theology s
  WHERE s.entry_type = 'section'
    AND EXISTS (
      SELECT 1 FROM systematic_theology sub
      WHERE sub.parent_id = s.id AND sub.entry_type = 'subsection'
    )
  ORDER BY s.chapter_number, s.sort_order
`).all();

const updateStmt = db.prepare(`
  UPDATE systematic_theology
  SET content = ?, updated_at = datetime('now')
  WHERE id = ?
`);

let updated = 0;
for (const section of sectionsWithSubsections) {
  // Get all subsections for this section
  const subsections = db.prepare(`
    SELECT content FROM systematic_theology
    WHERE parent_id = ? AND entry_type = 'subsection'
    ORDER BY sort_order
  `).all(section.id);

  // Build aggregated content
  const intro = section.content || '';
  const subsectionContent = subsections.map(s => s.content || '').join('\n');
  const aggregated = intro + (intro && subsectionContent ? '\n' : '') + subsectionContent;

  // Update section
  updateStmt.run(aggregated, section.id);
  updated++;

  console.log(`Ch${section.chapter_number} ${section.section_letter}: ${section.content?.length || 0} → ${aggregated.length} chars`);
}

console.log(`\nUpdated ${updated} sections with aggregated content`);
db.close();
