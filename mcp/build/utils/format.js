/**
 * Convert database row (snake_case) to API format (camelCase)
 */
export const toApiFormat = (row) => ({
    id: row.id,
    book: row.book,
    startChapter: row.start_chapter,
    startVerse: row.start_verse,
    endChapter: row.end_chapter,
    endVerse: row.end_verse,
    title: row.title,
    content: row.content,
    type: row.type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});
