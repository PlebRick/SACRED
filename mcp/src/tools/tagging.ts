import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { logger } from '../utils/logger.js';

const SACRED_API = process.env.SACRED_API_URL || 'http://localhost:3000';

async function apiCall(path: string, method: string = 'GET', body?: unknown): Promise<unknown> {
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${SACRED_API}${path}`, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${method} ${path} returned ${res.status}: ${text}`);
  }
  return res.json();
}

export function registerTaggingTools(server: McpServer): void {
  // analyze_note_topics - Run topic analysis on a note
  server.tool(
    'analyze_note_topics',
    'Analyze a note\'s content, passage, and doctrine links to suggest topic tags with confidence scores. Returns primary + secondary topic suggestions.',
    {
      noteId: z.string().describe('The UUID of the note to analyze'),
    },
    async ({ noteId }) => {
      try {
        const result = await apiCall(`/api/tagging/analyze/${noteId}?type=topics`, 'POST');

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('Error analyzing note topics:', error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // analyze_note_inline_tags - Detect inline tags in note content
  server.tool(
    'analyze_note_inline_tags',
    'Scan a note\'s HTML content for illustrations, applications, quotes, key points, and cross-references using pattern matching. Returns detected regions with confidence.',
    {
      noteId: z.string().describe('The UUID of the note to analyze'),
    },
    async ({ noteId }) => {
      try {
        const result = await apiCall(`/api/tagging/analyze/${noteId}?type=inline`, 'POST');

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('Error analyzing note inline tags:', error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // batch_tag_notes - Process multiple notes at once
  server.tool(
    'batch_tag_notes',
    'Analyze multiple notes for topic and inline tag suggestions. In "auto" mode, applies high-confidence primary topics automatically.',
    {
      mode: z
        .enum(['analyze', 'auto'])
        .optional()
        .describe('analyze = generate suggestions only; auto = also apply high-confidence tags (default: analyze)'),
      noteIds: z
        .array(z.string())
        .optional()
        .describe('Specific note IDs to process (default: all untagged notes)'),
      minConfidence: z
        .number()
        .optional()
        .describe('Minimum confidence threshold for auto-apply mode (default: 0.6)'),
    },
    async ({ mode = 'analyze', noteIds, minConfidence = 0.6 }) => {
      try {
        const result = await apiCall('/api/tagging/batch', 'POST', {
          mode,
          noteIds,
          minConfidence,
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('Error in batch tagging:', error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // get_tagging_queue - List untagged notes
  server.tool(
    'get_tagging_queue',
    'Get list of untagged notes with their pending suggestion counts. Shows tagging progress stats.',
    {
      book: z.string().optional().describe('Filter by Bible book code (e.g., "ROM")'),
      type: z.string().optional().describe('Filter by note type: "note", "commentary", or "sermon"'),
    },
    async ({ book, type }) => {
      try {
        const params = new URLSearchParams();
        if (book) params.set('book', book.toUpperCase());
        if (type) params.set('type', type);
        const qs = params.toString();

        const result = await apiCall(`/api/tagging/queue${qs ? '?' + qs : ''}`);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('Error getting tagging queue:', error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // apply_tag_suggestions - Accept or reject suggestions
  server.tool(
    'apply_tag_suggestions',
    'Accept or reject tagging suggestions for a note. Accepted topic suggestions update the note; accepted inline tag suggestions wrap text in HTML.',
    {
      accepted: z
        .array(z.string())
        .optional()
        .describe('Array of suggestion IDs to accept'),
      rejected: z
        .array(z.string())
        .optional()
        .describe('Array of suggestion IDs to reject'),
    },
    async ({ accepted = [], rejected = [] }) => {
      try {
        const result = await apiCall('/api/tagging/apply', 'POST', {
          accepted,
          rejected,
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('Error applying tag suggestions:', error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  logger.info(
    'Registered tagging tools: analyze_note_topics, analyze_note_inline_tags, batch_tag_notes, get_tagging_queue, apply_tag_suggestions'
  );
}
