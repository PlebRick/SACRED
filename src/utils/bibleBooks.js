import bibleStructure from '../data/bibleStructure.json';

export const books = bibleStructure.books;

// Abbreviation mappings for all 66 books
export const abbreviations = {
  // Genesis
  'gen': 'GEN', 'genesis': 'GEN',
  // Exodus
  'exo': 'EXO', 'exodus': 'EXO', 'ex': 'EXO',
  // Leviticus
  'lev': 'LEV', 'leviticus': 'LEV',
  // Numbers
  'num': 'NUM', 'numbers': 'NUM',
  // Deuteronomy
  'deu': 'DEU', 'deut': 'DEU', 'deuteronomy': 'DEU',
  // Joshua
  'jos': 'JOS', 'josh': 'JOS', 'joshua': 'JOS',
  // Judges
  'jdg': 'JDG', 'judg': 'JDG', 'judges': 'JDG',
  // Ruth
  'rut': 'RUT', 'ruth': 'RUT',
  // 1 Samuel
  '1sa': '1SA', '1sam': '1SA', '1 samuel': '1SA', '1samuel': '1SA',
  // 2 Samuel
  '2sa': '2SA', '2sam': '2SA', '2 samuel': '2SA', '2samuel': '2SA',
  // 1 Kings
  '1ki': '1KI', '1kgs': '1KI', '1 kings': '1KI', '1kings': '1KI',
  // 2 Kings
  '2ki': '2KI', '2kgs': '2KI', '2 kings': '2KI', '2kings': '2KI',
  // 1 Chronicles
  '1ch': '1CH', '1chr': '1CH', '1 chronicles': '1CH', '1chronicles': '1CH',
  // 2 Chronicles
  '2ch': '2CH', '2chr': '2CH', '2 chronicles': '2CH', '2chronicles': '2CH',
  // Ezra
  'ezr': 'EZR', 'ezra': 'EZR',
  // Nehemiah
  'neh': 'NEH', 'nehemiah': 'NEH',
  // Esther
  'est': 'EST', 'esther': 'EST',
  // Job
  'job': 'JOB',
  // Psalms
  'psa': 'PSA', 'ps': 'PSA', 'psalm': 'PSA', 'psalms': 'PSA',
  // Proverbs
  'pro': 'PRO', 'prov': 'PRO', 'proverbs': 'PRO',
  // Ecclesiastes
  'ecc': 'ECC', 'eccl': 'ECC', 'ecclesiastes': 'ECC',
  // Song of Solomon
  'sng': 'SNG', 'song': 'SNG', 'sos': 'SNG', 'song of solomon': 'SNG', 'song of songs': 'SNG',
  // Isaiah
  'isa': 'ISA', 'isaiah': 'ISA',
  // Jeremiah
  'jer': 'JER', 'jeremiah': 'JER',
  // Lamentations
  'lam': 'LAM', 'lamentations': 'LAM',
  // Ezekiel
  'ezk': 'EZK', 'ezek': 'EZK', 'ezekiel': 'EZK',
  // Daniel
  'dan': 'DAN', 'daniel': 'DAN',
  // Hosea
  'hos': 'HOS', 'hosea': 'HOS',
  // Joel
  'jol': 'JOL', 'joel': 'JOL',
  // Amos
  'amo': 'AMO', 'amos': 'AMO',
  // Obadiah
  'oba': 'OBA', 'obad': 'OBA', 'obadiah': 'OBA',
  // Jonah
  'jon': 'JON', 'jonah': 'JON',
  // Micah
  'mic': 'MIC', 'micah': 'MIC',
  // Nahum
  'nam': 'NAM', 'nah': 'NAM', 'nahum': 'NAM',
  // Habakkuk
  'hab': 'HAB', 'habakkuk': 'HAB',
  // Zephaniah
  'zep': 'ZEP', 'zeph': 'ZEP', 'zephaniah': 'ZEP',
  // Haggai
  'hag': 'HAG', 'haggai': 'HAG',
  // Zechariah
  'zec': 'ZEC', 'zech': 'ZEC', 'zechariah': 'ZEC',
  // Malachi
  'mal': 'MAL', 'malachi': 'MAL',
  // Matthew
  'mat': 'MAT', 'matt': 'MAT', 'matthew': 'MAT',
  // Mark
  'mrk': 'MRK', 'mark': 'MRK', 'mk': 'MRK',
  // Luke
  'luk': 'LUK', 'luke': 'LUK', 'lk': 'LUK',
  // John
  'jhn': 'JHN', 'john': 'JHN', 'jn': 'JHN',
  // Acts
  'act': 'ACT', 'acts': 'ACT',
  // Romans
  'rom': 'ROM', 'romans': 'ROM',
  // 1 Corinthians
  '1co': '1CO', '1cor': '1CO', '1 corinthians': '1CO', '1corinthians': '1CO',
  // 2 Corinthians
  '2co': '2CO', '2cor': '2CO', '2 corinthians': '2CO', '2corinthians': '2CO',
  // Galatians
  'gal': 'GAL', 'galatians': 'GAL',
  // Ephesians
  'eph': 'EPH', 'ephesians': 'EPH',
  // Philippians
  'php': 'PHP', 'phil': 'PHP', 'philippians': 'PHP',
  // Colossians
  'col': 'COL', 'colossians': 'COL',
  // 1 Thessalonians
  '1th': '1TH', '1thess': '1TH', '1 thessalonians': '1TH', '1thessalonians': '1TH',
  // 2 Thessalonians
  '2th': '2TH', '2thess': '2TH', '2 thessalonians': '2TH', '2thessalonians': '2TH',
  // 1 Timothy
  '1ti': '1TI', '1tim': '1TI', '1 timothy': '1TI', '1timothy': '1TI',
  // 2 Timothy
  '2ti': '2TI', '2tim': '2TI', '2 timothy': '2TI', '2timothy': '2TI',
  // Titus
  'tit': 'TIT', 'titus': 'TIT',
  // Philemon
  'phm': 'PHM', 'philemon': 'PHM', 'phlm': 'PHM',
  // Hebrews
  'heb': 'HEB', 'hebrews': 'HEB',
  // James
  'jas': 'JAS', 'james': 'JAS',
  // 1 Peter
  '1pe': '1PE', '1pet': '1PE', '1 peter': '1PE', '1peter': '1PE',
  // 2 Peter
  '2pe': '2PE', '2pet': '2PE', '2 peter': '2PE', '2peter': '2PE',
  // 1 John
  '1jn': '1JN', '1john': '1JN', '1 john': '1JN',
  // 2 John
  '2jn': '2JN', '2john': '2JN', '2 john': '2JN',
  // 3 John
  '3jn': '3JN', '3john': '3JN', '3 john': '3JN',
  // Jude
  'jud': 'JUD', 'jude': 'JUD',
  // Revelation
  'rev': 'REV', 'revelation': 'REV', 'revelations': 'REV'
};

export const getBookById = (id) => {
  return books.find(book => book.id === id);
};

export const getBookByName = (name) => {
  return books.find(book =>
    book.name.toLowerCase() === name.toLowerCase()
  );
};

export const getBookIndex = (id) => {
  return books.findIndex(book => book.id === id);
};

export const getNextChapter = (bookId, chapter) => {
  const book = getBookById(bookId);
  if (!book) return null;

  if (chapter < book.chapters) {
    return { bookId, chapter: chapter + 1 };
  }

  const bookIndex = getBookIndex(bookId);
  if (bookIndex < books.length - 1) {
    return { bookId: books[bookIndex + 1].id, chapter: 1 };
  }

  return null;
};

export const getPrevChapter = (bookId, chapter) => {
  if (chapter > 1) {
    return { bookId, chapter: chapter - 1 };
  }

  const bookIndex = getBookIndex(bookId);
  if (bookIndex > 0) {
    const prevBook = books[bookIndex - 1];
    return { bookId: prevBook.id, chapter: prevBook.chapters };
  }

  return null;
};

export const formatReference = (bookId, chapter, verse = null) => {
  const book = getBookById(bookId);
  if (!book) return '';

  if (verse) {
    return `${book.name} ${chapter}:${verse}`;
  }
  return `${book.name} ${chapter}`;
};
