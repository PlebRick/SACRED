import { getBookById } from './bibleBooks';

export const parseVerseRange = (rangeString) => {
  // Parse formats like "ROM 1:1-7", "GEN 1:1-2:3"
  const match = rangeString.match(/^(\w+)\s+(\d+):(\d+)(?:-(\d+):(\d+)|(?:-(\d+)))?$/);

  if (!match) return null;

  const [, book, startChapter, startVerse, endChapter, endVerse, sameChapterEndVerse] = match;

  return {
    book,
    startChapter: parseInt(startChapter),
    startVerse: parseInt(startVerse),
    endChapter: endChapter ? parseInt(endChapter) : parseInt(startChapter),
    endVerse: endVerse ? parseInt(endVerse) : (sameChapterEndVerse ? parseInt(sameChapterEndVerse) : parseInt(startVerse))
  };
};

export const formatVerseRange = (note) => {
  const book = getBookById(note.book);
  if (!book) return '';

  const bookName = book.name;

  if (note.startChapter === note.endChapter) {
    if (note.startVerse === note.endVerse) {
      return `${bookName} ${note.startChapter}:${note.startVerse}`;
    }
    return `${bookName} ${note.startChapter}:${note.startVerse}-${note.endVerse}`;
  }

  return `${bookName} ${note.startChapter}:${note.startVerse}-${note.endChapter}:${note.endVerse}`;
};

export const isVerseInRange = (chapter, verse, note) => {
  // Single chapter range
  if (note.startChapter === note.endChapter) {
    return chapter === note.startChapter &&
           verse >= note.startVerse &&
           verse <= note.endVerse;
  }

  // Multi-chapter range
  if (chapter < note.startChapter || chapter > note.endChapter) {
    return false;
  }

  if (chapter === note.startChapter) {
    return verse >= note.startVerse;
  }

  if (chapter === note.endChapter) {
    return verse <= note.endVerse;
  }

  return true;
};

export const compareNotesByPosition = (a, b) => {
  // Compare by book order, then chapter, then verse
  if (a.book !== b.book) {
    // Need to import book order
    const { getBookIndex } = require('./bibleBooks');
    return getBookIndex(a.book) - getBookIndex(b.book);
  }
  if (a.startChapter !== b.startChapter) {
    return a.startChapter - b.startChapter;
  }
  return a.startVerse - b.startVerse;
};
