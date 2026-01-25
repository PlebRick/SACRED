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
  primary_topic_id: string | null;
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
  primaryTopicId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Convert database row (snake_case) to API format (camelCase)
 */
export const toApiFormat = (row: DbNote): ApiNote => ({
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
 * Note metadata format (without content - token-efficient)
 */
export interface DbNoteMetadata {
  id: string;
  book: string;
  start_chapter: number;
  start_verse: number | null;
  end_chapter: number;
  end_verse: number | null;
  title: string;
  type: string;
  primary_topic_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * API note metadata format (without content)
 */
export interface ApiNoteMetadata {
  id: string;
  book: string;
  startChapter: number;
  startVerse: number | null;
  endChapter: number;
  endVerse: number | null;
  title: string;
  type: string;
  primaryTopicId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Convert database row to metadata-only API format (excludes content for token efficiency)
 */
export const toMetadataFormat = (row: DbNoteMetadata): ApiNoteMetadata => ({
  id: row.id,
  book: row.book,
  startChapter: row.start_chapter,
  startVerse: row.start_verse,
  endChapter: row.end_chapter,
  endVerse: row.end_verse,
  title: row.title,
  type: row.type,
  primaryTopicId: row.primary_topic_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * Topic database row format (snake_case)
 */
export interface DbTopic {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
  systematic_tag_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Topic API format (camelCase)
 */
export interface ApiTopic {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  systematicTagId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Convert topic database row to API format
 */
export const topicToApiFormat = (row: DbTopic): ApiTopic => ({
  id: row.id,
  name: row.name,
  parentId: row.parent_id,
  sortOrder: row.sort_order,
  systematicTagId: row.systematic_tag_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * Note-tag junction table row
 */
export interface DbNoteTag {
  note_id: string;
  topic_id: string;
}

/**
 * Inline tag type database row format
 */
export interface DbInlineTagType {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  is_default: number;
  sort_order: number;
  created_at: string;
}

/**
 * Inline tag type API format
 */
export interface ApiInlineTagType {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
}

/**
 * Convert inline tag type database row to API format
 */
export const inlineTagTypeToApiFormat = (row: DbInlineTagType): ApiInlineTagType => ({
  id: row.id,
  name: row.name,
  color: row.color,
  icon: row.icon,
  isDefault: row.is_default === 1,
  sortOrder: row.sort_order,
  createdAt: row.created_at,
});

/**
 * Inline tag database row format
 */
export interface DbInlineTag {
  id: string;
  note_id: string;
  tag_type: string;
  text_content: string;
  html_fragment: string;
  position_start: number;
  position_end: number;
  created_at: string;
  // Optional joined fields
  note_title?: string;
  book?: string;
  start_chapter?: number;
  start_verse?: number | null;
  end_chapter?: number;
  end_verse?: number | null;
}

/**
 * Inline tag API format
 */
export interface ApiInlineTag {
  id: string;
  noteId: string;
  tagType: string;
  textContent: string;
  htmlFragment: string;
  positionStart: number;
  positionEnd: number;
  createdAt: string;
  noteTitle?: string;
  book?: string;
  startChapter?: number;
  startVerse?: number | null;
  endChapter?: number;
  endVerse?: number | null;
}

/**
 * Convert inline tag database row to API format
 */
export const inlineTagToApiFormat = (row: DbInlineTag): ApiInlineTag => ({
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
 * Systematic annotation database row format
 */
export interface DbSystematicAnnotation {
  id: string;
  systematic_id: string;
  annotation_type: string;
  color: string | null;
  content: string | null;
  text_selection: string | null;
  position_start: number | null;
  position_end: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Systematic annotation API format
 */
export interface ApiSystematicAnnotation {
  id: string;
  systematicId: string;
  annotationType: string;
  color: string | null;
  content: string | null;
  textSelection: string | null;
  positionStart: number | null;
  positionEnd: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Convert systematic annotation database row to API format
 */
export const systematicAnnotationToApiFormat = (row: DbSystematicAnnotation): ApiSystematicAnnotation => ({
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
 * Systematic tag database row format
 */
export interface DbSystematicTag {
  id: string;
  name: string;
  color: string | null;
  sort_order: number;
  created_at: string;
  chapter_count?: number;
}

/**
 * Systematic tag API format
 */
export interface ApiSystematicTag {
  id: string;
  name: string;
  color: string | null;
  sortOrder: number;
  createdAt: string;
  chapterCount?: number;
}

/**
 * Convert systematic tag database row to API format
 */
export const systematicTagToApiFormat = (row: DbSystematicTag): ApiSystematicTag => ({
  id: row.id,
  name: row.name,
  color: row.color,
  sortOrder: row.sort_order,
  createdAt: row.created_at,
  chapterCount: row.chapter_count,
});
