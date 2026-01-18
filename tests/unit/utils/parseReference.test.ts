import { describe, it, expect } from 'vitest';
import { parseReference, resolveBookId, formatParsedReference } from '../../../src/utils/parseReference';

describe('parseReference', () => {
  describe('valid single verse', () => {
    it('parses "Romans 1:1"', () => {
      const result = parseReference('Romans 1:1');
      expect(result).toEqual({
        bookId: 'ROM',
        bookName: 'Romans',
        startChapter: 1,
        startVerse: 1,
        endChapter: 1,
        endVerse: 1,
        isWholeChapter: false,
      });
    });

    it('parses "John 3:16"', () => {
      const result = parseReference('John 3:16');
      expect(result).toEqual({
        bookId: 'JHN',
        bookName: 'John',
        startChapter: 3,
        startVerse: 16,
        endChapter: 3,
        endVerse: 16,
        isWholeChapter: false,
      });
    });

    it('parses "Genesis 1:1"', () => {
      const result = parseReference('Genesis 1:1');
      expect(result).toEqual({
        bookId: 'GEN',
        bookName: 'Genesis',
        startChapter: 1,
        startVerse: 1,
        endChapter: 1,
        endVerse: 1,
        isWholeChapter: false,
      });
    });

    it('parses "Psalm 23:1"', () => {
      const result = parseReference('Psalm 23:1');
      expect(result).toEqual({
        bookId: 'PSA',
        bookName: 'Psalms',
        startChapter: 23,
        startVerse: 1,
        endChapter: 23,
        endVerse: 1,
        isWholeChapter: false,
      });
    });
  });

  describe('valid verse range (same chapter)', () => {
    it('parses "Romans 1:1-7"', () => {
      const result = parseReference('Romans 1:1-7');
      expect(result).toEqual({
        bookId: 'ROM',
        bookName: 'Romans',
        startChapter: 1,
        startVerse: 1,
        endChapter: 1,
        endVerse: 7,
        isWholeChapter: false,
      });
    });

    it('parses "Genesis 1:1-31"', () => {
      const result = parseReference('Genesis 1:1-31');
      expect(result).toEqual({
        bookId: 'GEN',
        bookName: 'Genesis',
        startChapter: 1,
        startVerse: 1,
        endChapter: 1,
        endVerse: 31,
        isWholeChapter: false,
      });
    });

    it('parses "Psalm 119:1-8"', () => {
      const result = parseReference('Psalm 119:1-8');
      expect(result).toEqual({
        bookId: 'PSA',
        bookName: 'Psalms',
        startChapter: 119,
        startVerse: 1,
        endChapter: 119,
        endVerse: 8,
        isWholeChapter: false,
      });
    });
  });

  describe('cross-chapter range', () => {
    it('parses "Genesis 1:1-2:3"', () => {
      const result = parseReference('Genesis 1:1-2:3');
      expect(result).toEqual({
        bookId: 'GEN',
        bookName: 'Genesis',
        startChapter: 1,
        startVerse: 1,
        endChapter: 2,
        endVerse: 3,
        isWholeChapter: false,
      });
    });

    it('parses "Romans 8:28-9:5"', () => {
      const result = parseReference('Romans 8:28-9:5');
      expect(result).toEqual({
        bookId: 'ROM',
        bookName: 'Romans',
        startChapter: 8,
        startVerse: 28,
        endChapter: 9,
        endVerse: 5,
        isWholeChapter: false,
      });
    });

    it('parses "Isaiah 52:13-53:12"', () => {
      const result = parseReference('Isaiah 52:13-53:12');
      expect(result).toEqual({
        bookId: 'ISA',
        bookName: 'Isaiah',
        startChapter: 52,
        startVerse: 13,
        endChapter: 53,
        endVerse: 12,
        isWholeChapter: false,
      });
    });
  });

  describe('whole chapter', () => {
    it('parses "Romans 1"', () => {
      const result = parseReference('Romans 1');
      expect(result).toEqual({
        bookId: 'ROM',
        bookName: 'Romans',
        startChapter: 1,
        startVerse: null,
        endChapter: 1,
        endVerse: null,
        isWholeChapter: true,
      });
    });

    it('parses "Genesis 1"', () => {
      const result = parseReference('Genesis 1');
      expect(result).toEqual({
        bookId: 'GEN',
        bookName: 'Genesis',
        startChapter: 1,
        startVerse: null,
        endChapter: 1,
        endVerse: null,
        isWholeChapter: true,
      });
    });

    it('parses "Psalm 23"', () => {
      const result = parseReference('Psalm 23');
      expect(result).toEqual({
        bookId: 'PSA',
        bookName: 'Psalms',
        startChapter: 23,
        startVerse: null,
        endChapter: 23,
        endVerse: null,
        isWholeChapter: true,
      });
    });
  });

  describe('abbreviations', () => {
    it('parses "Rom 1:1"', () => {
      const result = parseReference('Rom 1:1');
      expect(result?.bookId).toBe('ROM');
      expect(result?.bookName).toBe('Romans');
    });

    it('parses "Gen 1:1"', () => {
      const result = parseReference('Gen 1:1');
      expect(result?.bookId).toBe('GEN');
      expect(result?.bookName).toBe('Genesis');
    });

    it('parses "1 Cor 13:4"', () => {
      const result = parseReference('1 Cor 13:4');
      expect(result?.bookId).toBe('1CO');
      expect(result?.bookName).toBe('1 Corinthians');
    });

    it('parses "1Co 13:4"', () => {
      const result = parseReference('1Co 13:4');
      expect(result?.bookId).toBe('1CO');
    });

    it('parses "Jn 3:16"', () => {
      const result = parseReference('Jn 3:16');
      expect(result?.bookId).toBe('JHN');
    });

    it('parses "Ps 23:1"', () => {
      const result = parseReference('Ps 23:1');
      expect(result?.bookId).toBe('PSA');
    });

    it('parses "Matt 5:1"', () => {
      const result = parseReference('Matt 5:1');
      expect(result?.bookId).toBe('MAT');
    });

    it('parses "Rev 21:1"', () => {
      const result = parseReference('Rev 21:1');
      expect(result?.bookId).toBe('REV');
    });
  });

  describe('case insensitivity', () => {
    it('parses "ROMANS 1:1"', () => {
      const result = parseReference('ROMANS 1:1');
      expect(result?.bookId).toBe('ROM');
    });

    it('parses "romans 1:1"', () => {
      const result = parseReference('romans 1:1');
      expect(result?.bookId).toBe('ROM');
    });

    it('parses "RoMaNs 1:1"', () => {
      const result = parseReference('RoMaNs 1:1');
      expect(result?.bookId).toBe('ROM');
    });

    it('parses "GENESIS 1:1"', () => {
      const result = parseReference('GENESIS 1:1');
      expect(result?.bookId).toBe('GEN');
    });
  });

  describe('books with numbers', () => {
    it('parses "1 Corinthians 13:4"', () => {
      const result = parseReference('1 Corinthians 13:4');
      expect(result?.bookId).toBe('1CO');
      expect(result?.bookName).toBe('1 Corinthians');
    });

    it('parses "2 Kings 5:1"', () => {
      const result = parseReference('2 Kings 5:1');
      expect(result?.bookId).toBe('2KI');
      expect(result?.bookName).toBe('2 Kings');
    });

    it('parses "3 John 1:4"', () => {
      const result = parseReference('3 John 1:4');
      expect(result?.bookId).toBe('3JN');
      expect(result?.bookName).toBe('3 John');
    });

    it('parses "1 Samuel 17:45"', () => {
      const result = parseReference('1 Samuel 17:45');
      expect(result?.bookId).toBe('1SA');
    });

    it('parses "2 Timothy 3:16"', () => {
      const result = parseReference('2 Timothy 3:16');
      expect(result?.bookId).toBe('2TI');
    });
  });

  describe('invalid inputs', () => {
    it('returns null for empty string', () => {
      expect(parseReference('')).toBeNull();
    });

    it('returns null for null input', () => {
      expect(parseReference(null as any)).toBeNull();
    });

    it('returns null for undefined input', () => {
      expect(parseReference(undefined as any)).toBeNull();
    });

    it('returns null for unknown book', () => {
      expect(parseReference('Hezekiah 1:1')).toBeNull();
    });

    it('returns null for invalid chapter (too high)', () => {
      // Romans has 16 chapters
      expect(parseReference('Romans 17:1')).toBeNull();
    });

    it('returns null for invalid chapter (zero)', () => {
      expect(parseReference('Romans 0:1')).toBeNull();
    });

    it('returns null for negative chapter', () => {
      expect(parseReference('Romans -1:1')).toBeNull();
    });

    it('returns null for reversed verse range', () => {
      expect(parseReference('Romans 1:7-1')).toBeNull();
    });

    it('returns null for reversed chapter range', () => {
      expect(parseReference('Romans 5:1-3:1')).toBeNull();
    });

    it('returns null for just a book name', () => {
      expect(parseReference('Romans')).toBeNull();
    });

    it('returns null for gibberish', () => {
      expect(parseReference('asdfasdf')).toBeNull();
    });

    it('returns null for whitespace only', () => {
      expect(parseReference('   ')).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('handles extra whitespace', () => {
      const result = parseReference('  Romans  1:1  ');
      expect(result?.bookId).toBe('ROM');
    });

    it('handles single chapter books', () => {
      // Obadiah has 1 chapter
      const result = parseReference('Obadiah 1:1');
      expect(result?.bookId).toBe('OBA');
      expect(result?.startChapter).toBe(1);
    });

    it('handles last book and chapter (Revelation 22)', () => {
      const result = parseReference('Revelation 22:21');
      expect(result).toEqual({
        bookId: 'REV',
        bookName: 'Revelation',
        startChapter: 22,
        startVerse: 21,
        endChapter: 22,
        endVerse: 21,
        isWholeChapter: false,
      });
    });

    it('handles first book and chapter (Genesis 1)', () => {
      const result = parseReference('Genesis 1:1');
      expect(result?.bookId).toBe('GEN');
      expect(result?.startChapter).toBe(1);
    });
  });
});

describe('resolveBookId', () => {
  it('resolves full book names', () => {
    expect(resolveBookId('Genesis')).toBe('GEN');
    expect(resolveBookId('Exodus')).toBe('EXO');
    expect(resolveBookId('Romans')).toBe('ROM');
    expect(resolveBookId('Revelation')).toBe('REV');
  });

  it('resolves abbreviations', () => {
    expect(resolveBookId('Gen')).toBe('GEN');
    expect(resolveBookId('Rom')).toBe('ROM');
    expect(resolveBookId('Rev')).toBe('REV');
    expect(resolveBookId('Ps')).toBe('PSA');
  });

  it('is case insensitive', () => {
    expect(resolveBookId('GENESIS')).toBe('GEN');
    expect(resolveBookId('genesis')).toBe('GEN');
    expect(resolveBookId('GeNeSiS')).toBe('GEN');
  });

  it('returns null for unknown books', () => {
    expect(resolveBookId('Hezekiah')).toBeNull();
    expect(resolveBookId('Unknown')).toBeNull();
  });

  it('returns null for empty/null input', () => {
    expect(resolveBookId('')).toBeNull();
    expect(resolveBookId(null as any)).toBeNull();
  });
});

describe('formatParsedReference', () => {
  it('formats single verse', () => {
    const parsed = {
      bookId: 'ROM',
      bookName: 'Romans',
      startChapter: 1,
      startVerse: 1,
      endChapter: 1,
      endVerse: 1,
      isWholeChapter: false,
    };
    expect(formatParsedReference(parsed)).toBe('Romans 1:1');
  });

  it('formats verse range (same chapter)', () => {
    const parsed = {
      bookId: 'ROM',
      bookName: 'Romans',
      startChapter: 1,
      startVerse: 1,
      endChapter: 1,
      endVerse: 7,
      isWholeChapter: false,
    };
    expect(formatParsedReference(parsed)).toBe('Romans 1:1-7');
  });

  it('formats cross-chapter range', () => {
    const parsed = {
      bookId: 'GEN',
      bookName: 'Genesis',
      startChapter: 1,
      startVerse: 1,
      endChapter: 2,
      endVerse: 3,
      isWholeChapter: false,
    };
    expect(formatParsedReference(parsed)).toBe('Genesis 1:1-2:3');
  });

  it('formats whole chapter', () => {
    const parsed = {
      bookId: 'ROM',
      bookName: 'Romans',
      startChapter: 1,
      startVerse: null,
      endChapter: 1,
      endVerse: null,
      isWholeChapter: true,
    };
    expect(formatParsedReference(parsed)).toBe('Romans 1');
  });

  it('returns empty string for null input', () => {
    expect(formatParsedReference(null as any)).toBe('');
  });
});
