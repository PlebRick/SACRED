/**
 * Import Stott's "Message of Romans" commentary into Sacred
 *
 * Usage: node scripts/import-stott-romans.cjs
 *
 * This script:
 * 1. Reads RTF files from Google Drive
 * 2. Converts them to HTML
 * 3. Parses section boundaries
 * 4. Creates commentary notes in Sacred via API
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const GOOGLE_DRIVE_PATH = '/Users/b1ackswan/Library/CloudStorage/GoogleDrive-chaplaincen@gmail.com/My Drive/logos-exports/Stott_Romans';
const API_BASE = 'http://localhost:3001/api';

// Section definitions based on Stott's structure - finer-grained to avoid large payloads
// Format: { title, startChapter, startVerse, endChapter, endVerse, marker }
const SECTIONS = [
  // Chapter 1 - Introduction
  { title: 'Paul and the Gospel', startChapter: 1, startVerse: 1, endChapter: 1, endVerse: 6, marker: '1:1–6' },
  { title: 'Paul and the Romans', startChapter: 1, startVerse: 7, endChapter: 1, endVerse: 13, marker: '1:7–13' },
  { title: 'Paul and Evangelism', startChapter: 1, startVerse: 14, endChapter: 1, endVerse: 17, marker: '1:14–17' },
  // Chapter 1 - God's Wrath
  { title: 'God\'s Wrath Against Sinful Humanity', startChapter: 1, startVerse: 18, endChapter: 1, endVerse: 32, marker: '1:18–32' },
  // Chapter 2
  { title: 'God\'s Righteous Judgment', startChapter: 2, startVerse: 1, endChapter: 2, endVerse: 16, marker: '2:1–16' },
  // Chapter 2-3 (cross-chapter)
  { title: 'The Jews and the Law', startChapter: 2, startVerse: 17, endChapter: 3, endVerse: 8, marker: '2:17–3:8' },
  // Chapter 3
  { title: 'No One Is Righteous', startChapter: 3, startVerse: 9, endChapter: 3, endVerse: 20, marker: '3:9–20' },
  // Chapter 3-4 - Breaking into subsections
  { title: 'God\'s Righteousness Revealed in Christ\'s Cross', startChapter: 3, startVerse: 21, endChapter: 3, endVerse: 26, marker: '3:21–26' },
  { title: 'God\'s Righteousness Defended Against Criticism', startChapter: 3, startVerse: 27, endChapter: 3, endVerse: 31, marker: '3:27–31' },
  { title: 'God\'s Righteousness Illustrated in Abraham', startChapter: 4, startVerse: 1, endChapter: 4, endVerse: 25, marker: '4:1–25' },
  // Chapter 5-6 - Breaking into subsections
  { title: 'The Results of Justification', startChapter: 5, startVerse: 1, endChapter: 5, endVerse: 11, marker: '5:1–11' },
  { title: 'The Two Humanities: Adam and Christ', startChapter: 5, startVerse: 12, endChapter: 5, endVerse: 21, marker: '5:12–21' },
  { title: 'United to Christ and Enslaved to God', startChapter: 6, startVerse: 1, endChapter: 6, endVerse: 23, marker: '6:1–23' },
  // Chapter 7 - Breaking into subsections
  { title: 'Release from the Law: A Marriage Metaphor', startChapter: 7, startVerse: 1, endChapter: 7, endVerse: 6, marker: '7:1–6' },
  { title: 'A Defence of the Law: A Past Experience', startChapter: 7, startVerse: 7, endChapter: 7, endVerse: 13, marker: '7:7–13' },
  { title: 'The Weakness of the Law: An Inner Conflict', startChapter: 7, startVerse: 14, endChapter: 7, endVerse: 25, marker: '7:14–25' },
  // Chapter 8 - Breaking into subsections
  { title: 'The Ministry of God\'s Spirit', startChapter: 8, startVerse: 1, endChapter: 8, endVerse: 17, marker: '8:1–17' },
  { title: 'The Glory of God\'s Children', startChapter: 8, startVerse: 18, endChapter: 8, endVerse: 27, marker: '8:18–27' },
  { title: 'The Steadfastness of God\'s Love', startChapter: 8, startVerse: 28, endChapter: 8, endVerse: 39, marker: '8:28–39' },
  // Chapter 9
  { title: 'God\'s Sovereign Choice', startChapter: 9, startVerse: 1, endChapter: 9, endVerse: 33, marker: '9:1–33' },
  // Chapter 10
  { title: 'Israel\'s Unbelief', startChapter: 10, startVerse: 1, endChapter: 10, endVerse: 21, marker: '10:1–21' },
  // Chapter 11
  { title: 'The Remnant of Israel', startChapter: 11, startVerse: 1, endChapter: 11, endVerse: 32, marker: '11:1–32' },
  { title: 'Doxology', startChapter: 11, startVerse: 33, endChapter: 11, endVerse: 36, marker: '11:33–36' },
  // Chapter 12
  { title: 'A Living Sacrifice', startChapter: 12, startVerse: 1, endChapter: 12, endVerse: 2, marker: '12:1–2' },
  { title: 'Humble Service in the Body of Christ', startChapter: 12, startVerse: 3, endChapter: 12, endVerse: 8, marker: '12:3–8' },
  { title: 'Love in Action', startChapter: 12, startVerse: 9, endChapter: 12, endVerse: 16, marker: '12:9–16' },
  { title: 'Overcoming Evil with Good', startChapter: 12, startVerse: 17, endChapter: 12, endVerse: 21, marker: '12:17–21' },
  // Chapter 13
  { title: 'Submission to Governing Authorities', startChapter: 13, startVerse: 1, endChapter: 13, endVerse: 7, marker: '13:1–7' },
  { title: 'Fulfilling the Law Through Love', startChapter: 13, startVerse: 8, endChapter: 13, endVerse: 10, marker: '13:8–10' },
  { title: 'The Day Is Near', startChapter: 13, startVerse: 11, endChapter: 13, endVerse: 14, marker: '13:11–14' },
  // Chapter 14-15 (cross-chapter)
  { title: 'The Weak and the Strong', startChapter: 14, startVerse: 1, endChapter: 15, endVerse: 13, marker: '14:1–15:13' },
  // Chapter 15
  { title: 'Paul\'s Ministry to the Gentiles', startChapter: 15, startVerse: 14, endChapter: 15, endVerse: 22, marker: '15:14–22' },
  { title: 'Paul\'s Plan to Visit Rome', startChapter: 15, startVerse: 23, endChapter: 15, endVerse: 33, marker: '15:23–33' },
  // Chapter 16
  { title: 'Personal Greetings', startChapter: 16, startVerse: 1, endChapter: 16, endVerse: 16, marker: '16:1–16' },
  { title: 'Final Instructions and Doxology', startChapter: 16, startVerse: 17, endChapter: 16, endVerse: 27, marker: '16:17–27' },
];

/**
 * Convert RTF file to HTML using textutil
 */
function rtfToHtml(rtfPath) {
  try {
    const html = execSync(`textutil -convert html -stdout "${rtfPath}"`, {
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024 // 50MB buffer
    });
    return html;
  } catch (error) {
    console.error(`Error converting ${rtfPath}:`, error.message);
    return null;
  }
}

/**
 * Clean up HTML for Tiptap editor
 * - Remove page markers
 * - Remove inline styles
 * - Preserve bold, italic, links
 * - Clean up paragraph structure
 */
function cleanHtmlForTiptap(html) {
  // Remove page markers like "p 46"
  html = html.replace(/<span class="s2">.*?p\s+\d+.*?<\/span>/g, '');

  // Remove the head section with styles
  html = html.replace(/<head>[\s\S]*?<\/head>/i, '');
  html = html.replace(/<\/?html>/gi, '');
  html = html.replace(/<\/?body>/gi, '');
  html = html.replace(/<!DOCTYPE[^>]*>/gi, '');

  // Remove class attributes but keep the tags
  html = html.replace(/<p[^>]*class="[^"]*"[^>]*>/gi, '<p>');
  html = html.replace(/<span[^>]*class="(?!s1|s3)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '$1');

  // Convert link spans to proper formatting (s1 and s3 are underlined links)
  html = html.replace(/<span class="s1">([\s\S]*?)<\/span>/gi, '$1');
  html = html.replace(/<span class="s3">([\s\S]*?)<\/span>/gi, '$1');

  // Clean up Apple-specific spans
  html = html.replace(/<span class="Apple-tab-span">\s*<\/span>/gi, ' ');
  html = html.replace(/<span class="Apple-converted-space">\s*<\/span>/gi, ' ');

  // Remove empty spans
  html = html.replace(/<span[^>]*>\s*<\/span>/gi, '');

  // Remove Logos links but keep the text
  html = html.replace(/<a href="https:\/\/ref\.ly\/[^"]*">([\s\S]*?)<\/a>/gi, '<strong>$1</strong>');

  // Clean up multiple spaces
  html = html.replace(/\s+/g, ' ');

  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/gi, '');

  // Trim whitespace
  html = html.trim();

  return html;
}

/**
 * Extract section content from combined HTML
 */
function extractSectionContent(allHtml, section, nextSection) {
  // Create regex pattern for finding the section start
  // Handle various dash types and formats
  const markerPattern = section.marker
    .replace(/–/g, '[-–—-]')  // Handle em-dash, en-dash, hyphen
    .replace(/:/g, ':');

  // Multiple patterns to find the marker
  const patterns = [
    // Pattern 1: Marker in a link with bold
    new RegExp(`<a[^>]*>\\s*<b>\\s*${markerPattern}`, 'i'),
    // Pattern 2: Just the marker text
    new RegExp(`>${markerPattern}<`, 'i'),
    // Pattern 3: Marker in a paragraph
    new RegExp(`<p[^>]*>[^<]*${markerPattern}`, 'i'),
    // Pattern 4: Marker with surrounding whitespace
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

  // Find the end (next section or end of content)
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

  // Truncate if still too large (>80KB to be safe)
  if (content.length > 80000) {
    console.log(`  WARNING: Content too large (${content.length} chars), truncating...`);
    content = content.slice(0, 80000) + '<p><em>[Content truncated due to size limits]</em></p>';
  }

  return content;
}

/**
 * Create a note via the Sacred API
 */
async function createNote(noteData) {
  try {
    const response = await fetch(`${API_BASE}/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(noteData),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error: ${response.status} - ${error}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Error creating note:`, error.message);
    throw error;
  }
}

/**
 * Delete existing Stott commentary notes
 */
async function deleteExistingStottNotes() {
  try {
    const response = await fetch(`${API_BASE}/notes`);
    if (!response.ok) return;

    const notes = await response.json();
    const stottNotes = notes.filter(n =>
      n.title && n.title.startsWith('Stott:') && n.book === 'ROM' && n.type === 'commentary'
    );

    if (stottNotes.length === 0) {
      console.log('No existing Stott notes to delete.');
      return;
    }

    console.log(`Deleting ${stottNotes.length} existing Stott commentary notes...`);
    for (const note of stottNotes) {
      await fetch(`${API_BASE}/notes/${note.id}`, { method: 'DELETE' });
    }
    console.log('Deleted existing notes.\n');
  } catch (error) {
    console.log('Could not check for existing notes:', error.message);
  }
}

/**
 * Main import function
 */
async function importStottRomans() {
  console.log('=== Importing Stott\'s Message of Romans ===\n');

  // Check if API is running
  try {
    const healthCheck = await fetch(`${API_BASE}/notes/count`);
    if (!healthCheck.ok) throw new Error('API not responding');
  } catch (error) {
    console.error('Error: Sacred API is not running. Start it with: npm run dev:server');
    process.exit(1);
  }

  // Delete existing Stott notes first
  await deleteExistingStottNotes();

  // Read and combine all RTF files
  console.log('Reading RTF files from:', GOOGLE_DRIVE_PATH);
  const files = fs.readdirSync(GOOGLE_DRIVE_PATH)
    .filter(f => f.endsWith('.rtf'))
    .sort();

  console.log(`Found ${files.length} RTF files:`, files);

  let combinedHtml = '';
  for (const file of files) {
    const filePath = path.join(GOOGLE_DRIVE_PATH, file);
    console.log(`  Converting: ${file}`);
    const html = rtfToHtml(filePath);
    if (html) {
      combinedHtml += html;
    }
  }

  console.log(`\nCombined HTML length: ${combinedHtml.length} characters`);

  // Process each section
  console.log('\n=== Creating Commentary Notes ===\n');

  let created = 0;
  let failed = 0;

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

    // Create the note
    const noteData = {
      book: 'ROM',
      startChapter: section.startChapter,
      startVerse: section.startVerse,
      endChapter: section.endChapter,
      endVerse: section.endVerse,
      title: `Stott: ${section.title}`,
      content: content,
      type: 'commentary',
    };

    try {
      await createNote(noteData);
      console.log(`  CREATED - ${content.length} chars`);
      created++;
    } catch (error) {
      console.log(`  FAILED - ${error.message}`);
      failed++;
    }

    // Small delay to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n=== Import Complete ===');
  console.log(`Created: ${created}`);
  console.log(`Failed: ${failed}`);
}

// Run the import
importStottRomans().catch(console.error);
