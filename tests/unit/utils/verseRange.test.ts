import { describe, it, expect } from 'vitest';
import { parseVerseRange, formatVerseRange, isVerseInRange, compareNotesByPosition } from '../../../src/utils/verseRange';

describe('parseVerseRange', () => {
  describe('single verse format', () => {
    it('parses "ROM 1:1"', () => {
      const result = parseVerseRange('ROM 1:1');
      expect(result).toEqual({
        book: 'ROM',
        startChapter: 1,
        startVerse: 1,
        endChapter: 1,
        endVerse: 1,
      });
    });

    it('parses "GEN 1:1"', () => {
      const result = parseVerseRange('GEN 1:1');
      expect(result).toEqual({
        book: 'GEN',
        startChapter: 1,
        startVerse: 1,
        endChapter: 1,
        endVerse: 1,
      });
    });
  });

  describe('same chapter range', () => {
    it('parses "ROM 1:1-7"', () => {
      const result = parseVerseRange('ROM 1:1-7');
      expect(result).toEqual({
        book: 'ROM',
        startChapter: 1,
        startVerse: 1,
        endChapter: 1,
        endVerse: 7,
      });
    });

    it('parses "GEN 1:1-31"', () => {
      const result = parseVerseRange('GEN 1:1-31');
      expect(result).toEqual({
        book: 'GEN',
        startChapter: 1,
        startVerse: 1,
        endChapter: 1,
        endVerse: 31,
      });
    });
  });

  describe('cross-chapter range', () => {
    it('parses "GEN 1:1-2:3"', () => {
      const result = parseVerseRange('GEN 1:1-2:3');
      expect(result).toEqual({
        book: 'GEN',
        startChapter: 1,
        startVerse: 1,
        endChapter: 2,
        endVerse: 3,
      });
    });

    it('parses "ROM 8:28-9:5"', () => {
      const result = parseVerseRange('ROM 8:28-9:5');
      expect(result).toEqual({
        book: 'ROM',
        startChapter: 8,
        startVerse: 28,
        endChapter: 9,
        endVerse: 5,
      });
    });
  });

  describe('invalid formats', () => {
    it('returns null for invalid format', () => {
      expect(parseVerseRange('invalid')).toBeNull();
    });

    it('returns null for chapter-only format', () => {
      expect(parseVerseRange('ROM 1')).toBeNull();
    });
  });
});

describe('formatVerseRange', () => {
  describe('single verse', () => {
    it('formats single verse correctly', () => {
      const note = {
        book: 'ROM',
        startChapter: 1,
        startVerse: 1,
        endChapter: 1,
        endVerse: 1,
      };
      expect(formatVerseRange(note)).toBe('Romans 1:1');
    });

    it('formats John 3:16', () => {
      const note = {
        book: 'JHN',
        startChapter: 3,
        startVerse: 16,
        endChapter: 3,
        endVerse: 16,
      };
      expect(formatVerseRange(note)).toBe('John 3:16');
    });
  });

  describe('same chapter range', () => {
    it('formats verse range in same chapter', () => {
      const note = {
        book: 'ROM',
        startChapter: 1,
        startVerse: 1,
        endChapter: 1,
        endVerse: 7,
      };
      expect(formatVerseRange(note)).toBe('Romans 1:1-7');
    });

    it('formats Genesis 1:1-31', () => {
      const note = {
        book: 'GEN',
        startChapter: 1,
        startVerse: 1,
        endChapter: 1,
        endVerse: 31,
      };
      expect(formatVerseRange(note)).toBe('Genesis 1:1-31');
    });
  });

  describe('cross-chapter range', () => {
    it('formats cross-chapter range', () => {
      const note = {
        book: 'GEN',
        startChapter: 1,
        startVerse: 1,
        endChapter: 2,
        endVerse: 3,
      };
      expect(formatVerseRange(note)).toBe('Genesis 1:1-2:3');
    });

    it('formats Isaiah 52:13-53:12', () => {
      const note = {
        book: 'ISA',
        startChapter: 52,
        startVerse: 13,
        endChapter: 53,
        endVerse: 12,
      };
      expect(formatVerseRange(note)).toBe('Isaiah 52:13-53:12');
    });
  });

  describe('invalid book', () => {
    it('returns empty string for unknown book', () => {
      const note = {
        book: 'UNKNOWN',
        startChapter: 1,
        startVerse: 1,
        endChapter: 1,
        endVerse: 1,
      };
      expect(formatVerseRange(note)).toBe('');
    });
  });
});

describe('isVerseInRange', () => {
  describe('single chapter range', () => {
    const note = {
      book: 'ROM',
      startChapter: 1,
      startVerse: 1,
      endChapter: 1,
      endVerse: 7,
    };

    it('returns true for verse within range', () => {
      expect(isVerseInRange(1, 1, note)).toBe(true);
      expect(isVerseInRange(1, 4, note)).toBe(true);
      expect(isVerseInRange(1, 7, note)).toBe(true);
    });

    it('returns true for boundary verses', () => {
      expect(isVerseInRange(1, 1, note)).toBe(true); // start boundary
      expect(isVerseInRange(1, 7, note)).toBe(true); // end boundary
    });

    it('returns false for verse outside range', () => {
      expect(isVerseInRange(1, 8, note)).toBe(false);
      expect(isVerseInRange(2, 1, note)).toBe(false);
    });

    it('returns false for verse before range', () => {
      const noteStartingAtVerse5 = { ...note, startVerse: 5 };
      expect(isVerseInRange(1, 4, noteStartingAtVerse5)).toBe(false);
    });

    it('returns false for different chapter', () => {
      expect(isVerseInRange(2, 1, note)).toBe(false);
      expect(isVerseInRange(3, 5, note)).toBe(false);
    });
  });

  describe('multi-chapter range', () => {
    const note = {
      book: 'GEN',
      startChapter: 1,
      startVerse: 20,
      endChapter: 3,
      endVerse: 10,
    };

    it('returns true for verse in start chapter at or after start verse', () => {
      expect(isVerseInRange(1, 20, note)).toBe(true);
      expect(isVerseInRange(1, 25, note)).toBe(true);
      expect(isVerseInRange(1, 31, note)).toBe(true);
    });

    it('returns false for verse in start chapter before start verse', () => {
      expect(isVerseInRange(1, 19, note)).toBe(false);
      expect(isVerseInRange(1, 1, note)).toBe(false);
    });

    it('returns true for any verse in middle chapters', () => {
      expect(isVerseInRange(2, 1, note)).toBe(true);
      expect(isVerseInRange(2, 15, note)).toBe(true);
      expect(isVerseInRange(2, 25, note)).toBe(true);
    });

    it('returns true for verse in end chapter at or before end verse', () => {
      expect(isVerseInRange(3, 1, note)).toBe(true);
      expect(isVerseInRange(3, 5, note)).toBe(true);
      expect(isVerseInRange(3, 10, note)).toBe(true);
    });

    it('returns false for verse in end chapter after end verse', () => {
      expect(isVerseInRange(3, 11, note)).toBe(false);
      expect(isVerseInRange(3, 20, note)).toBe(false);
    });

    it('returns false for chapters outside range', () => {
      expect(isVerseInRange(4, 1, note)).toBe(false);
      expect(isVerseInRange(10, 5, note)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('handles single verse range', () => {
      const note = {
        book: 'JHN',
        startChapter: 3,
        startVerse: 16,
        endChapter: 3,
        endVerse: 16,
      };
      expect(isVerseInRange(3, 16, note)).toBe(true);
      expect(isVerseInRange(3, 15, note)).toBe(false);
      expect(isVerseInRange(3, 17, note)).toBe(false);
    });
  });
});

describe('compareNotesByPosition', () => {
  it('sorts notes by chapter when book is the same', () => {
    const noteA = { book: 'ROM', startChapter: 1, startVerse: 1 };
    const noteB = { book: 'ROM', startChapter: 2, startVerse: 1 };
    expect(compareNotesByPosition(noteA, noteB)).toBeLessThan(0);
    expect(compareNotesByPosition(noteB, noteA)).toBeGreaterThan(0);
  });

  it('sorts notes by verse when book and chapter are the same', () => {
    const noteA = { book: 'ROM', startChapter: 1, startVerse: 1 };
    const noteB = { book: 'ROM', startChapter: 1, startVerse: 7 };
    expect(compareNotesByPosition(noteA, noteB)).toBeLessThan(0);
    expect(compareNotesByPosition(noteB, noteA)).toBeGreaterThan(0);
  });

  it('returns 0 for notes at the same position', () => {
    const noteA = { book: 'ROM', startChapter: 1, startVerse: 1 };
    const noteB = { book: 'ROM', startChapter: 1, startVerse: 1 };
    expect(compareNotesByPosition(noteA, noteB)).toBe(0);
  });

  it('sorts notes by book order (Genesis before Exodus)', () => {
    const noteA = { book: 'GEN', startChapter: 1, startVerse: 1 };
    const noteB = { book: 'EXO', startChapter: 1, startVerse: 1 };
    expect(compareNotesByPosition(noteA, noteB)).toBeLessThan(0);
  });

  it('sorts notes by book order (Romans before Revelation)', () => {
    const noteA = { book: 'ROM', startChapter: 1, startVerse: 1 };
    const noteB = { book: 'REV', startChapter: 1, startVerse: 1 };
    expect(compareNotesByPosition(noteA, noteB)).toBeLessThan(0);
  });

  it('sorts notes by book order (Old Testament before New Testament)', () => {
    const noteA = { book: 'MAL', startChapter: 4, startVerse: 6 };
    const noteB = { book: 'MAT', startChapter: 1, startVerse: 1 };
    expect(compareNotesByPosition(noteA, noteB)).toBeLessThan(0);
  });
});
