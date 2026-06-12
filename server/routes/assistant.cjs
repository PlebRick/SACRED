const express = require('express');
const router = express.Router();
const { isAvailable, getClient, getModel } = require('../assistant/client.cjs');
const { INTERNAL_TOOLS, loadConnectorTools, executeTool } = require('../assistant/tools.cjs');

const MAX_LOOP_ITERATIONS = 12;

const SYSTEM_PROMPT = `You are the study assistant inside SACRED, a personal Bible study and sermon preparation app used by one pastor. You are embedded in the app and have tools that read and write his actual study data.

What makes you different from a generic assistant: you are grounded in this pastor's own corpus — his notes, commentary, sermons, tagged illustrations, sermon series, and a systematic theology library (Wayne Grudem's, 57 chapters). Always prefer his material over generic knowledge. When he asks about a passage or topic, check what he has already written and preached before composing anything new.

Working principles:
- For sermon preparation: check get_similar_sermons first (what has he preached on this before), then get_chapter_notes, find_doctrines_for_passage, and find_illustrations. Build on his voice and history, don't replace it.
- For doctrinal questions: search_doctrine and get_doctrine_section give you his theology library. Cite chapters by number and use the [[ST:Ch32]] link syntax when writing content that will be saved.
- Quote Scripture from get_bible_chapter (World English Bible) when exact wording matters.
- When asked to save something, use create_note with clean HTML (<h2>, <h3>, <p>, <ul>, <blockquote>). Sermons use type "sermon".
- Connector tools (named cx_...) are extensions the pastor installed himself — use them when relevant.
- Be a thoughtful theological conversation partner: warm, substantive, honest about interpretive disagreements. Never invent quotes or attribute content to his notes that isn't there.
- Keep responses focused. For research-style answers, lead with the conclusion.`;

// GET /api/assistant/status - is the assistant configured?
router.get('/status', (req, res) => {
  res.json({
    available: isAvailable(),
    model: isAvailable() ? getModel() : null
  });
});

// POST /api/assistant/chat - run one assistant turn (agentic loop, SSE stream)
//
// Body: { messages: [...] } — full Anthropic-format history from prior turns
//       plus the new user message appended by the client.
// Stream: SSE events `text` (delta), `tool` (activity), `done` (full updated
//         history to send back next turn), `error`.
router.post('/chat', async (req, res) => {
  if (!isAvailable()) {
    return res.status(503).json({
      error: 'Assistant not configured. Add ANTHROPIC_API_KEY to your .env file.'
    });
  }

  const messages = req.body?.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const client = getClient();

  try {
    const { tools: connectorTools, dispatch } = await loadConnectorTools();
    const tools = [...INTERNAL_TOOLS, ...connectorTools];

    const history = [...messages];
    let stopReason = null;

    for (let i = 0; i < MAX_LOOP_ITERATIONS; i++) {
      const stream = client.messages.stream({
        model: getModel(),
        max_tokens: 64000,
        thinking: { type: 'adaptive' },
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' }
          }
        ],
        tools,
        messages: history
      });

      stream.on('text', (delta) => send('text', { delta }));
      stream.on('contentBlock', (block) => {
        if (block.type === 'tool_use') {
          send('tool', { name: block.name, status: 'start' });
        }
      });

      const message = await stream.finalMessage();
      history.push({ role: 'assistant', content: message.content });
      stopReason = message.stop_reason;

      if (message.stop_reason === 'refusal') {
        send('error', { message: 'The model declined this request.' });
        break;
      }

      if (message.stop_reason === 'pause_turn') {
        continue; // server-side resume: re-send with the assistant turn appended
      }

      const toolUses = message.content.filter((b) => b.type === 'tool_use');
      if (toolUses.length === 0) break; // end_turn — we're done

      const toolResults = [];
      for (const toolUse of toolUses) {
        let resultText;
        let isError = false;
        try {
          resultText = await executeTool(toolUse.name, toolUse.input, dispatch);
        } catch (error) {
          resultText = `Tool failed: ${error.message}`;
          isError = true;
        }
        send('tool', {
          name: toolUse.name,
          status: isError ? 'error' : 'done',
          preview: String(resultText).slice(0, 150)
        });
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: String(resultText),
          ...(isError ? { is_error: true } : {})
        });
      }
      history.push({ role: 'user', content: toolResults });
    }

    send('done', { messages: history, stopReason });
  } catch (error) {
    console.error('Assistant error:', error);
    send('error', { message: error.message || 'Assistant request failed' });
  } finally {
    res.end();
  }
});

module.exports = router;
