import { describe, it, expect } from 'vitest';
import {
  books,
  abbreviations,
  getBookById,
  getBookByName,
  getBookIndex,
  getNextChapter,
  getPrevChapter,
  formatReference,
} from '../../../src/utils/bibleBooks';

describe('books array', () => {
  it('contains exactly 66 books', () => {
    expect(books).toHaveLength(66);
  });

  it('starts with Genesis', () => {
    expect(books[0].id).toBe('GEN');
    expect(books[0].name).toBe('Genesis');
  });

  it('ends with Revelation', () => {
    expect(books[65].id).toBe('REV');
    expect(books[65].name).toBe('Revelation');
  });

  it('all books have required fields', () => {
    books.forEach((book) => {
      expect(book).toHaveProperty('id');
      expect(book).toHaveProperty('name');
      expect(book).toHaveProperty('chapters');
      expect(typeof book.id).toBe('string');
      expect(typeof book.name).toBe('string');
      expect(typeof book.chapters).toBe('number');
      expect(book.chapters).toBeGreaterThan(0);
    });
  });

  it('has expected chapter counts for major books', () => {
    const genesis = books.find(b => b.id === 'GEN');
    expect(genesis?.chapters).toBe(50);

    const psalms = books.find(b => b.id === 'PSA');
    expect(psalms?.chapters).toBe(150);

    const matthew = books.find(b => b.id === 'MAT');
    expect(matthew?.chapters).toBe(28);

    const revelation = books.find(b => b.id === 'REV');
    expect(revelation?.chapters).toBe(22);
  });
});

describe('abbreviations', () => {
  it('contains abbreviations for all books', () => {
    // Check some key abbreviations
    expect(abbreviations['gen']).toBe('GEN');
    expect(abbreviations['genesis']).toBe('GEN');
    expect(abbreviations['rom']).toBe('ROM');
    expect(abbreviations['romans']).toBe('ROM');
    expect(abbreviations['rev']).toBe('REV');
    expect(abbreviations['revelation']).toBe('REV');
  });

  it('handles numbered books', () => {
    expect(abbreviations['1 corinthians']).toBe('1CO');
    expect(abbreviations['1co']).toBe('1CO');
    expect(abbreviations['2 kings']).toBe('2KI');
    expect(abbreviations['3 john']).toBe('3JN');
  });

  it('handles Psalms variations', () => {
    expect(abbreviations['ps']).toBe('PSA');
    expect(abbreviations['psa']).toBe('PSA');
    expect(abbreviations['psalm']).toBe('PSA');
    expect(abbreviations['psalms']).toBe('PSA');
  });

  it('handles Song of Solomon variations', () => {
    expect(abbreviations['sng']).toBe('SNG');
    expect(abbreviations['song']).toBe('SNG');
    expect(abbreviations['sos']).toBe('SNG');
    expect(abbreviations['song of solomon']).toBe('SNG');
    expect(abbreviations['song of songs']).toBe('SNG');
  });

  it('all abbreviation values map to valid book IDs', () => {
    Object.values(abbreviations).forEach((bookId) => {
      const book = getBookById(bookId);
      expect(book).toBeTruthy();
    });
  });
});

describe('getBookById', () => {
  it('returns correct book for valid ID', () => {
    const genesis = getBookById('GEN');
    expect(genesis).toEqual({
      id: 'GEN',
      name: 'Genesis',
      chapters: 50,
    });
  });

  it('returns correct book for Romans', () => {
    const romans = getBookById('ROM');
    expect(romans?.name).toBe('Romans');
    expect(romans?.chapters).toBe(16);
  });

  it('returns correct book for Revelation', () => {
    const revelation = getBookById('REV');
    expect(revelation?.name).toBe('Revelation');
    expect(revelation?.chapters).toBe(22);
  });

  it('returns undefined for invalid ID', () => {
    expect(getBookById('INVALID')).toBeUndefined();
    expect(getBookById('')).toBeUndefined();
  });

  it('finds all 66 books', () => {
    const bookIds = ['GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'RUT', '1SA', '2SA',
      '1KI', '2KI', '1CH', '2CH', 'EZR', 'NEH', 'EST', 'JOB', 'PSA', 'PRO',
      'ECC', 'SNG', 'ISA', 'JER', 'LAM', 'EZK', 'DAN', 'HOS', 'JOL', 'AMO',
      'OBA', 'JON', 'MIC', 'NAM', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL',
      'MAT', 'MRK', 'LUK', 'JHN', 'ACT', 'ROM', '1CO', '2CO', 'GAL', 'EPH',
      'PHP', 'COL', '1TH', '2TH', '1TI', '2TI', 'TIT', 'PHM', 'HEB', 'JAS',
      '1PE', '2PE', '1JN', '2JN', '3JN', 'JUD', 'REV'];

    bookIds.forEach((id) => {
      const book = getBookById(id);
      expect(book).toBeTruthy();
      expect(book?.id).toBe(id);
    });
  });
});

describe('getBookByName', () => {
  it('finds book by exact name', () => {
    const genesis = getBookByName('Genesis');
    expect(genesis?.id).toBe('GEN');
  });

  it('is case insensitive', () => {
    expect(getBookByName('genesis')?.id).toBe('GEN');
    expect(getBookByName('GENESIS')?.id).toBe('GEN');
    expect(getBookByName('GeNeSiS')?.id).toBe('GEN');
  });

  it('returns undefined for unknown name', () => {
    expect(getBookByName('Unknown')).toBeUndefined();
    expect(getBookByName('')).toBeUndefined();
  });
});

describe('getBookIndex', () => {
  it('returns 0 for Genesis', () => {
    expect(getBookIndex('GEN')).toBe(0);
  });

  it('returns 65 for Revelation', () => {
    expect(getBookIndex('REV')).toBe(65);
  });

  it('returns correct index for Romans', () => {
    const index = getBookIndex('ROM');
    expect(index).toBeGreaterThan(0);
    expect(books[index].id).toBe('ROM');
  });

  it('returns -1 for invalid book', () => {
    expect(getBookIndex('INVALID')).toBe(-1);
  });
});

describe('getNextChapter', () => {
  describe('mid-book navigation', () => {
    it('returns next chapter within same book', () => {
      const next = getNextChapter('ROM', 1);
      expect(next).toEqual({ bookId: 'ROM', chapter: 2 });
    });

    it('returns next chapter for chapter 15 of Romans (has 16 chapters)', () => {
      const next = getNextChapter('ROM', 15);
      expect(next).toEqual({ bookId: 'ROM', chapter: 16 });
    });

    it('returns next chapter in middle of Psalms', () => {
      const next = getNextChapter('PSA', 50);
      expect(next).toEqual({ bookId: 'PSA', chapter: 51 });
    });
  });

  describe('end-of-book navigation', () => {
    it('moves to next book at end of Genesis (50 chapters)', () => {
      const next = getNextChapter('GEN', 50);
      expect(next).toEqual({ bookId: 'EXO', chapter: 1 });
    });

    it('moves to next book at end of Romans (16 chapters)', () => {
      const next = getNextChapter('ROM', 16);
      expect(next).toEqual({ bookId: '1CO', chapter: 1 });
    });

    it('moves from Malachi to Matthew', () => {
      const next = getNextChapter('MAL', 4);
      expect(next).toEqual({ bookId: 'MAT', chapter: 1 });
    });
  });

  describe('end-of-Bible', () => {
    it('returns null at Revelation 22 (end of Bible)', () => {
      const next = getNextChapter('REV', 22);
      expect(next).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('returns null for invalid book', () => {
      const next = getNextChapter('INVALID', 1);
      expect(next).toBeNull();
    });

    it('handles single-chapter books', () => {
      // Obadiah has 1 chapter
      const next = getNextChapter('OBA', 1);
      expect(next).toEqual({ bookId: 'JON', chapter: 1 });
    });
  });
});

describe('getPrevChapter', () => {
  describe('mid-book navigation', () => {
    it('returns previous chapter within same book', () => {
      const prev = getPrevChapter('ROM', 5);
      expect(prev).toEqual({ bookId: 'ROM', chapter: 4 });
    });

    it('returns previous chapter for chapter 2', () => {
      const prev = getPrevChapter('ROM', 2);
      expect(prev).toEqual({ bookId: 'ROM', chapter: 1 });
    });
  });

  describe('start-of-book navigation', () => {
    it('moves to previous book at chapter 1', () => {
      const prev = getPrevChapter('EXO', 1);
      // Genesis has 50 chapters
      expect(prev).toEqual({ bookId: 'GEN', chapter: 50 });
    });

    it('moves from Romans to Acts last chapter', () => {
      const prev = getPrevChapter('ROM', 1);
      // Acts has 28 chapters
      expect(prev).toEqual({ bookId: 'ACT', chapter: 28 });
    });

    it('moves from Matthew to Malachi', () => {
      const prev = getPrevChapter('MAT', 1);
      // Malachi has 4 chapters
      expect(prev).toEqual({ bookId: 'MAL', chapter: 4 });
    });
  });

  describe('start-of-Bible', () => {
    it('returns null at Genesis 1 (start of Bible)', () => {
      const prev = getPrevChapter('GEN', 1);
      expect(prev).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('handles single-chapter books', () => {
      // Jonah comes after Obadiah
      const prev = getPrevChapter('JON', 1);
      expect(prev).toEqual({ bookId: 'OBA', chapter: 1 });
    });
  });
});

describe('formatReference', () => {
  it('formats chapter only reference', () => {
    expect(formatReference('ROM', 1)).toBe('Romans 1');
  });

  it('formats chapter and verse reference', () => {
    expect(formatReference('ROM', 1, 1)).toBe('Romans 1:1');
  });

  it('formats Genesis reference', () => {
    expect(formatReference('GEN', 1, 1)).toBe('Genesis 1:1');
  });

  it('formats John 3:16', () => {
    expect(formatReference('JHN', 3, 16)).toBe('John 3:16');
  });

  it('returns empty string for invalid book', () => {
    expect(formatReference('INVALID', 1)).toBe('');
    expect(formatReference('INVALID', 1, 1)).toBe('');
  });

  it('handles null verse', () => {
    expect(formatReference('ROM', 1, null)).toBe('Romans 1');
  });
});
