import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';

/**
 * Decode common HTML entities to plain text.
 * Matches cheerio's .text() behavior for the entities we encounter.
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCharCode(parseInt(dec, 10)));
}

/**
 * Generate MD5 signature for duplicate detection.
 * Matches the Express server's generateSignature() in server/routes/notes.cjs.
 */
function generateSignature(text: string): string | null {
  if (!text || text.length < 20) return null;
  const normalized = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return crypto.createHash('md5').update(normalized).digest('hex').substring(0, 16);
}

/**
 * Extract inline tags from note HTML content and sync to the inline_tags table.
 * This is the MCP equivalent of syncInlineTags() in server/routes/notes.cjs,
 * using regex instead of cheerio to avoid an extra dependency.
 *
 * Expected HTML format: <span data-inline-tag="tagType">text content</span>
 */
export function syncInlineTags(noteId: string, htmlContent: string | null | undefined): void {
  // Always clear existing tags first
  db.prepare('DELETE FROM inline_tags WHERE note_id = ?').run(noteId);

  if (!htmlContent) return;

  const regex = /<span\s+data-inline-tag="([^"]+)">([\s\S]*?)<\/span>/g;
  const now = new Date().toISOString();
  const insertStmt = db.prepare(`
    INSERT INTO inline_tags (id, note_id, tag_type, text_content, html_fragment, position_start, position_end, text_signature, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let match;
  let position = 0;
  while ((match = regex.exec(htmlContent)) !== null) {
    const tagType = match[1];
    const innerHtml = match[2];
    // Strip nested HTML tags and decode entities to match cheerio's .text()
    const textContent = decodeHtmlEntities(innerHtml.replace(/<[^>]*>/g, ''));
    const htmlFragment = match[0];
    const id = uuidv4();
    const signature = generateSignature(textContent);

    insertStmt.run(
      id,
      noteId,
      tagType,
      textContent,
      htmlFragment,
      position,
      position + textContent.length,
      signature,
      now
    );

    position += textContent.length + 1;
  }
}
