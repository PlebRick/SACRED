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
    primaryTopicId: row.primary_topic_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});
/**
 * Convert topic database row to API format
 */
export const topicToApiFormat = (row) => ({
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    sortOrder: row.sort_order,
    systematicTagId: row.systematic_tag_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});
/**
 * Convert inline tag type database row to API format
 */
export const inlineTagTypeToApiFormat = (row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    isDefault: row.is_default === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
});
/**
 * Convert inline tag database row to API format
 */
export const inlineTagToApiFormat = (row) => ({
    id: row.id,
    noteId: row.note_id,
    tagType: row.tag_type,
    textContent: row.text_content,
    htmlFragment: row.html_fragment,
    positionStart: row.position_start,
    positionEnd: row.position_end,
    createdAt: row.created_at,
    noteTitle: row.note_title,
    book: row.book,
    startChapter: row.start_chapter,
    startVerse: row.start_verse,
    endChapter: row.end_chapter,
    endVerse: row.end_verse,
});
/**
 * Convert systematic annotation database row to API format
 */
export const systematicAnnotationToApiFormat = (row) => ({
    id: row.id,
    systematicId: row.systematic_id,
    annotationType: row.annotation_type,
    color: row.color,
    content: row.content,
    textSelection: row.text_selection,
    positionStart: row.position_start,
    positionEnd: row.position_end,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});
/**
 * Convert systematic tag database row to API format
 */
export const systematicTagToApiFormat = (row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    chapterCount: row.chapter_count,
});
