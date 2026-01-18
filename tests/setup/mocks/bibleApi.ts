import { vi } from 'vitest';

export interface MockVerse {
  verse: number;
  text: string;
}

export interface MockChapterResponse {
  reference: string;
  verses: MockVerse[];
}

// Sample verse data for testing
export const mockVerseData: Record<string, MockChapterResponse> = {
  'ROM/1': {
    reference: 'Romans 1',
    verses: [
      { verse: 1, text: 'Paul, a servant of Jesus Christ, called to be an apostle, separated unto the gospel of God,' },
      { verse: 2, text: '(Which he had promised afore by his prophets in the holy scriptures,)' },
      { verse: 3, text: 'Concerning his Son Jesus Christ our Lord, which was made of the seed of David according to the flesh;' },
      { verse: 4, text: 'And declared to be the Son of God with power, according to the spirit of holiness, by the resurrection from the dead:' },
      { verse: 5, text: 'By whom we have received grace and apostleship, for obedience to the faith among all nations, for his name:' },
      { verse: 6, text: 'Among whom are ye also the called of Jesus Christ:' },
      { verse: 7, text: 'To all that be in Rome, beloved of God, called to be saints: Grace to you and peace from God our Father, and the Lord Jesus Christ.' },
    ],
  },
  'JHN/3': {
    reference: 'John 3',
    verses: [
      { verse: 16, text: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.' },
    ],
  },
  'GEN/1': {
    reference: 'Genesis 1',
    verses: [
      { verse: 1, text: 'In the beginning God created the heaven and the earth.' },
      { verse: 2, text: 'And the earth was without form, and void; and darkness was upon the face of the deep. And the Spirit of God moved upon the face of the waters.' },
      { verse: 3, text: 'And God said, Let there be light: and there was light.' },
    ],
  },
};

/**
 * Create a mock fetch function for bible-api.com
 */
export function createMockBibleFetch() {
  return vi.fn().mockImplementation(async (url: string) => {
    // Extract book and chapter from URL
    const match = url.match(/bible-api\.com\/(\w+)%20(\d+)/);
    if (!match) {
      return {
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not found' }),
      };
    }

    const [, book, chapter] = match;
    const key = `${book.toUpperCase()}/${chapter}`;
    const data = mockVerseData[key];

    if (data) {
      return {
        ok: true,
        status: 200,
        json: async () => data,
      };
    }

    return {
      ok: false,
      status: 404,
      json: async () => ({ error: 'Not found' }),
    };
  });
}
