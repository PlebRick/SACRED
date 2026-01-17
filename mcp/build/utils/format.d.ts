/**
 * Database row format (snake_case)
 */
export interface DbNote {
    id: string;
    book: string;
    start_chapter: number;
    start_verse: number | null;
    end_chapter: number;
    end_verse: number | null;
    title: string;
    content: string;
    type: string;
    created_at: string;
    updated_at: string;
}
/**
 * API format (camelCase)
 */
export interface ApiNote {
    id: string;
    book: string;
    startChapter: number;
    startVerse: number | null;
    endChapter: number;
    endVerse: number | null;
    title: string;
    content: string;
    type: string;
    createdAt: string;
    updatedAt: string;
}
/**
 * Convert database row (snake_case) to API format (camelCase)
 */
export declare const toApiFormat: (row: DbNote) => ApiNote;
