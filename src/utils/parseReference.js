import { abbreviations, getBookById, books } from './bibleBooks';

/**
 * Parse a verse reference string into a structured object
 *
 * Supported formats:
 * - "Romans 1:1" -> single verse
 * - "Romans 1:1-7" -> verse range within chapter
 * - "Romans 1" -> whole chapter
 * - "Genesis 1:1-2:3" -> cross-chapter range
 * - "Rom 1:1-7" -> abbreviations
 * - Case insensitive
 *
 * @param {string} reference - The reference string to parse
 * @returns {object|null} Parsed reference or null if invalid
 */
export const parseReference = (reference) => {
  if (!reference || typeof reference !== 'string') {
    return null;
  }

  const trimmed = reference.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  // Pattern: Book Chapter:Verse-Chapter:Verse (cross-chapter range)
  // Example: "Genesis 1:1-2:3", "gen 1:1-2:3"
  const crossChapterPattern = /^(\d?\s*[a-z]+(?:\s+[a-z]+)?)\s+(\d+):(\d+)-(\d+):(\d+)$/i;

  // Pattern: Book Chapter:Verse-Verse (same chapter range)
  // Example: "Romans 1:1-7", "rom 1:1-7"
  const verseRangePattern = /^(\d?\s*[a-z]+(?:\s+[a-z]+)?)\s+(\d+):(\d+)-(\d+)$/i;

  // Pattern: Book Chapter:Verse (single verse)
  // Example: "Romans 1:1", "rom 1:1"
  const singleVersePattern = /^(\d?\s*[a-z]+(?:\s+[a-z]+)?)\s+(\d+):(\d+)$/i;

  // Pattern: Book Chapter (whole chapter)
  // Example: "Romans 1", "rom 1"
  const chapterOnlyPattern = /^(\d?\s*[a-z]+(?:\s+[a-z]+)?)\s+(\d+)$/i;

  let bookStr, startChapter, startVerse, endChapter, endVerse;

  // Try cross-chapter range first
  let match = trimmed.match(crossChapterPattern);
  if (match) {
    bookStr = match[1];
    startChapter = parseInt(match[2], 10);
    startVerse = parseInt(match[3], 10);
    endChapter = parseInt(match[4], 10);
    endVerse = parseInt(match[5], 10);
  } else {
    // Try verse range (same chapter)
    match = trimmed.match(verseRangePattern);
    if (match) {
      bookStr = match[1];
      startChapter = parseInt(match[2], 10);
      startVerse = parseInt(match[3], 10);
      endChapter = startChapter;
      endVerse = parseInt(match[4], 10);
    } else {
      // Try single verse
      match = trimmed.match(singleVersePattern);
      if (match) {
        bookStr = match[1];
        startChapter = parseInt(match[2], 10);
        startVerse = parseInt(match[3], 10);
        endChapter = startChapter;
        endVerse = startVerse;
      } else {
        // Try chapter only
        match = trimmed.match(chapterOnlyPattern);
        if (match) {
          bookStr = match[1];
          startChapter = parseInt(match[2], 10);
          startVerse = null; // Indicates whole chapter
          endChapter = startChapter;
          endVerse = null;
        } else {
          return null;
        }
      }
    }
  }

  // Resolve book ID from the book string
  const bookId = resolveBookId(bookStr);
  if (!bookId) {
    return null;
  }

  // Validate chapter exists in book
  const book = getBookById(bookId);
  if (!book) {
    return null;
  }

  if (startChapter < 1 || startChapter > book.chapters) {
    return null;
  }

  if (endChapter < 1 || endChapter > book.chapters) {
    return null;
  }

  // Ensure start comes before end
  if (startChapter > endChapter || (startChapter === endChapter && startVerse && endVerse && startVerse > endVerse)) {
    return null;
  }

  return {
    bookId,
    bookName: book.name,
    startChapter,
    startVerse,
    endChapter,
    endVerse,
    isWholeChapter: startVerse === null
  };
};

/**
 * Resolve a book string to its canonical book ID
 *
 * @param {string} bookStr - Book name or abbreviation
 * @returns {string|null} Book ID or null if not found
 */
export const resolveBookId = (bookStr) => {
  if (!bookStr) return null;

  const normalized = bookStr.trim().toLowerCase();

  // First, check abbreviations map
  if (abbreviations[normalized]) {
    return abbreviations[normalized];
  }

  // Check if it matches a book name directly
  const book = books.find(b =>
    b.name.toLowerCase() === normalized ||
    b.id.toLowerCase() === normalized
  );

  if (book) {
    return book.id;
  }

  // Try partial matching (for longer book names)
  const partialMatch = books.find(b =>
    b.name.toLowerCase().startsWith(normalized) ||
    normalized.startsWith(b.name.toLowerCase())
  );

  return partialMatch ? partialMatch.id : null;
};

/**
 * Format a parsed reference back to a display string
 *
 * @param {object} parsed - Parsed reference object
 * @returns {string} Formatted reference string
 */
export const formatParsedReference = (parsed) => {
  if (!parsed) return '';

  const { bookName, startChapter, startVerse, endChapter, endVerse, isWholeChapter } = parsed;

  if (isWholeChapter) {
    return `${bookName} ${startChapter}`;
  }

  if (startChapter === endChapter) {
    if (startVerse === endVerse) {
      return `${bookName} ${startChapter}:${startVerse}`;
    }
    return `${bookName} ${startChapter}:${startVerse}-${endVerse}`;
  }

  return `${bookName} ${startChapter}:${startVerse}-${endChapter}:${endVerse}`;
};

export default parseReference;
