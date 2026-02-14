import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { logger } from '../utils/logger.js';

const SACRED_API = process.env.SACRED_API_URL || 'http://localhost:3000';
const SACRED_API_KEY = process.env.SACRED_API_KEY || '';

async function apiCall(path: string, method: string = 'GET', body?: unknown): Promise<unknown> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (SACRED_API_KEY) headers['x-api-key'] = SACRED_API_KEY;

  const opts: RequestInit = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${SACRED_API}${path}`, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${method} ${path} returned ${res.status}: ${text}`);
  }
  return res.json();
}

export function registerDoctrineMatchingTools(server: McpServer): void {
  // analyze_doctrine_links - Run intelligent matching on a note
  server.tool(
    'analyze_doctrine_links',
    'Analyze a note to suggest relevant Grudem systematic theology links (chapter AND section level) using scripture index, keyword matching, topic correlation, and correction learning. Returns ranked suggestions with confidence scores.',
    {
      noteId: z.string().describe('The UUID of the note to analyze'),
    },
    async ({ noteId }) => {
      try {
        const result = await apiCall(`/api/doctrine-matching/analyze/${noteId}`, 'POST');

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('Error analyzing doctrine links:', error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // get_doctrine_suggestions - Get stored suggestions for a note
  server.tool(
    'get_doctrine_suggestions',
    'Get stored doctrine link suggestions for a note, optionally filtered by status (pending, accepted, rejected).',
    {
      noteId: z.string().describe('The UUID of the note'),
      status: z
        .enum(['pending', 'accepted', 'rejected'])
        .optional()
        .describe('Filter by suggestion status'),
    },
    async ({ noteId, status }) => {
      try {
        const params = new URLSearchParams();
        if (status) params.set('status', status);
        const qs = params.toString();

        const result = await apiCall(
          `/api/doctrine-matching/suggestions/${noteId}${qs ? '?' + qs : ''}`
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('Error getting doctrine suggestions:', error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // apply_doctrine_suggestions - Accept or reject suggestions
  server.tool(
    'apply_doctrine_suggestions',
    'Accept or reject doctrine link suggestions. Accepted suggestions insert [[ST:ChX:Y]] links into the note content as clickable spans.',
    {
      accepted: z
        .array(z.string())
        .optional()
        .describe('Array of suggestion IDs to accept (inserts links into note)'),
      rejected: z
        .array(z.string())
        .optional()
        .describe('Array of suggestion IDs to reject'),
    },
    async ({ accepted = [], rejected = [] }) => {
      try {
        const result = await apiCall('/api/doctrine-matching/apply', 'POST', {
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
        logger.error('Error applying doctrine suggestions:', error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // get_doctrine_matching_queue - List notes without doctrine links
  server.tool(
    'get_doctrine_matching_queue',
    'Get list of notes that have no doctrine links, with progress statistics. Use to find notes that need doctrine linking.',
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

        const result = await apiCall(`/api/doctrine-matching/queue${qs ? '?' + qs : ''}`);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('Error getting doctrine matching queue:', error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // batch_doctrine_matching - Batch analyze or auto-apply
  server.tool(
    'batch_doctrine_matching',
    'Analyze multiple notes for doctrine links. In "auto" mode, applies suggestions above the confidence threshold. Use for bulk processing after importing new notes.',
    {
      mode: z
        .enum(['analyze', 'auto'])
        .optional()
        .describe('analyze = generate suggestions only; auto = also apply high-confidence links (default: analyze)'),
      noteIds: z
        .array(z.string())
        .optional()
        .describe('Specific note IDs to process (default: all notes without doctrine links)'),
      minConfidence: z
        .number()
        .optional()
        .describe('Minimum confidence threshold for auto-apply mode (default: 0.5)'),
    },
    async ({ mode = 'analyze', noteIds, minConfidence = 0.5 }) => {
      try {
        const result = await apiCall('/api/doctrine-matching/batch', 'POST', {
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
        logger.error('Error in batch doctrine matching:', error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  logger.info(
    'Registered doctrine matching tools: analyze_doctrine_links, get_doctrine_suggestions, apply_doctrine_suggestions, get_doctrine_matching_queue, batch_doctrine_matching'
  );
}
