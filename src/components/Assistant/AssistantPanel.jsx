import { useState, useRef, useEffect, useCallback } from 'react';
import { assistantService } from '../../services/assistantService';
import styles from './Assistant.module.css';

// Minimal markdown renderer for assistant replies (headers, lists, bold,
// italic, inline code, blockquotes). Avoids pulling in a full md library.
const renderInline = (text, keyBase) => {
  const parts = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let match;
  let i = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith('**')) parts.push(<strong key={`${keyBase}-${i++}`}>{token.slice(2, -2)}</strong>);
    else if (token.startsWith('`')) parts.push(<code key={`${keyBase}-${i++}`}>{token.slice(1, -1)}</code>);
    else parts.push(<em key={`${keyBase}-${i++}`}>{token.slice(1, -1)}</em>);
    last = match.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
};

const Markdown = ({ text }) => {
  const blocks = [];
  const lines = (text || '').split('\n');
  let list = null;
  let key = 0;

  const flushList = () => {
    if (list) {
      blocks.push(
        list.ordered
          ? <ol key={key++}>{list.items.map((item, i) => <li key={i}>{renderInline(item, `li${key}-${i}`)}</li>)}</ol>
          : <ul key={key++}>{list.items.map((item, i) => <li key={i}>{renderInline(item, `li${key}-${i}`)}</li>)}</ul>
      );
      list = null;
    }
  };

  for (const line of lines) {
    const olMatch = line.match(/^\s*\d+\.\s+(.*)/);
    const ulMatch = line.match(/^\s*[-*]\s+(.*)/);
    if (olMatch || ulMatch) {
      const ordered = !!olMatch;
      const item = (olMatch || ulMatch)[1];
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push(item);
      continue;
    }
    flushList();
    if (!line.trim()) continue;
    if (line.startsWith('### ')) blocks.push(<h4 key={key++}>{renderInline(line.slice(4), `h${key}`)}</h4>);
    else if (line.startsWith('## ')) blocks.push(<h3 key={key++}>{renderInline(line.slice(3), `h${key}`)}</h3>);
    else if (line.startsWith('# ')) blocks.push(<h3 key={key++}>{renderInline(line.slice(2), `h${key}`)}</h3>);
    else if (line.startsWith('> ')) blocks.push(<blockquote key={key++}>{renderInline(line.slice(2), `q${key}`)}</blockquote>);
    else blocks.push(<p key={key++}>{renderInline(line, `p${key}`)}</p>);
  }
  flushList();
  return <div className={styles.markdown}>{blocks}</div>;
};

const TOOL_LABELS = {
  search_notes: 'Searching your notes',
  get_chapter_notes: 'Reading chapter notes',
  get_note: 'Reading a note',
  search_doctrine: 'Searching theology library',
  get_doctrine_section: 'Reading doctrine',
  find_doctrines_for_passage: 'Finding doctrines for passage',
  get_similar_sermons: 'Checking past sermons',
  find_illustrations: 'Searching illustrations',
  get_bible_chapter: 'Reading Scripture',
  list_series: 'Listing sermon series',
  create_note: 'Saving to SACRED'
};

const toolLabel = (name) =>
  TOOL_LABELS[name] || (name.startsWith('cx_') ? `Connector: ${name.split('_').slice(2).join('_')}` : name);

const SUGGESTIONS = [
  'Help me prepare a sermon on this Sunday’s passage',
  'What have I preached on grace in the past?',
  'What doctrines does Romans 8 teach?',
  'Which illustrations have I been overusing?'
];

export const AssistantPanel = ({ onClose }) => {
  const [status, setStatus] = useState(null);
  const [displayMessages, setDisplayMessages] = useState([]);
  const [apiMessages, setApiMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    assistantService.getStatus().then(setStatus).catch(() => setStatus({ available: false }));
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, [status]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [displayMessages]);

  const sendMessage = useCallback(async (text) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    const nextApi = [...apiMessages, { role: 'user', content: trimmed }];
    setApiMessages(nextApi);
    setDisplayMessages((prev) => [
      ...prev,
      { role: 'user', text: trimmed },
      { role: 'assistant', text: '', tools: [], streaming: true }
    ]);
    setInput('');
    setBusy(true);

    const updateAssistant = (updater) => {
      setDisplayMessages((prev) => {
        const next = [...prev];
        const lastIdx = next.length - 1;
        next[lastIdx] = updater(next[lastIdx]);
        return next;
      });
    };

    try {
      await assistantService.chat(nextApi, {
        onText: (delta) =>
          updateAssistant((m) => ({ ...m, text: m.text + delta })),
        onTool: (tool) =>
          updateAssistant((m) => {
            const tools = [...m.tools];
            const existing = tools.findIndex((t) => t.name === tool.name && t.status === 'start');
            if (tool.status !== 'start' && existing !== -1) tools[existing] = tool;
            else tools.push(tool);
            return { ...m, tools };
          }),
        onDone: ({ messages: history }) => {
          setApiMessages(history);
          updateAssistant((m) => ({ ...m, streaming: false }));
        },
        onError: (message) =>
          updateAssistant((m) => ({
            ...m,
            streaming: false,
            error: message
          }))
      });
    } catch (error) {
      updateAssistant((m) => ({ ...m, streaming: false, error: error.message }));
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }, [apiMessages, busy]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearConversation = () => {
    setApiMessages([]);
    setDisplayMessages([]);
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3z" />
          </svg>
          <span>Study Assistant</span>
        </div>
        <div className={styles.headerActions}>
          {displayMessages.length > 0 && (
            <button className={styles.headerButton} onClick={clearConversation} title="New conversation">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          )}
          <button className={styles.headerButton} onClick={onClose} aria-label="Close assistant">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {status && !status.available ? (
        <div className={styles.setup}>
          <h3>Two ways to study with Claude</h3>
          <p>
            <strong>Free — use Claude from outside (recommended).</strong> Your Claude
            subscription already connects to SACRED through MCP with 78 tools. Open
            claude.ai or Claude Code and ask things like:
          </p>
          <ul>
            <li>"Help me prep a sermon on John 3 from my notes"</li>
            <li>"Run my enrichment queue and file suggestions" — they appear right here in the note editor</li>
            <li>"What doctrines haven't I preached on?" (pulpit coverage)</li>
          </ul>
          <p>
            <strong>Optional — chat in this panel.</strong> This in-app assistant calls
            the Anthropic API directly and is billed per use:
          </p>
          <ol>
            <li>Get an API key at <code>console.anthropic.com</code></li>
            <li>Add <code>ANTHROPIC_API_KEY=sk-ant-…</code> to your <code>.env</code> file</li>
            <li>Restart the server</li>
          </ol>
        </div>
      ) : (
        <>
          <div className={styles.messages} ref={scrollRef}>
            {displayMessages.length === 0 && (
              <div className={styles.welcome}>
                <p className={styles.welcomeLead}>
                  Grounded in your notes, sermons, and theology library.
                </p>
                {SUGGESTIONS.map((s) => (
                  <button key={s} className={styles.suggestion} onClick={() => sendMessage(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}
            {displayMessages.map((m, i) =>
              m.role === 'user' ? (
                <div key={i} className={styles.userMessage}>{m.text}</div>
              ) : (
                <div key={i} className={styles.assistantMessage}>
                  {m.tools.map((t, j) => (
                    <div key={j} className={`${styles.toolChip} ${t.status === 'error' ? styles.toolError : ''}`}>
                      {t.status === 'start' ? (
                        <span className={styles.toolSpinner} />
                      ) : (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                      {toolLabel(t.name)}
                    </div>
                  ))}
                  {m.text && <Markdown text={m.text} />}
                  {m.streaming && !m.text && m.tools.length === 0 && (
                    <div className={styles.thinking}>Thinking…</div>
                  )}
                  {m.error && <div className={styles.errorNote}>{m.error}</div>}
                </div>
              )
            )}
          </div>

          <div className={styles.inputArea}>
            <textarea
              ref={inputRef}
              className={styles.input}
              placeholder={busy ? 'Working…' : 'Ask about your notes, a passage, sermon prep…'}
              value={input}
              rows={2}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={busy}
            />
            <button
              className={styles.sendButton}
              onClick={() => sendMessage(input)}
              disabled={busy || !input.trim()}
              aria-label="Send"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />
              </svg>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default AssistantPanel;
