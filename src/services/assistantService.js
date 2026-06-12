// Assistant Service - in-app AI study assistant
const API_BASE = '/api/assistant';

export const assistantService = {
  getStatus: async () => {
    const res = await fetch(`${API_BASE}/status`);
    if (!res.ok) throw new Error('Failed to check assistant status');
    return res.json();
  },

  // Run one assistant turn. `messages` is the full Anthropic-format history.
  // Callbacks: onText(delta), onTool({name, status, preview}), onDone({messages}), onError(message)
  chat: async (messages, { onText, onTool, onDone, onError }) => {
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages })
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      onError?.(body.error || `Request failed (${res.status})`);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const processEvent = (chunk) => {
      const lines = chunk.split('\n');
      let event = 'message';
      let data = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) event = line.slice(7).trim();
        else if (line.startsWith('data: ')) data += line.slice(6);
      }
      if (!data) return;
      let payload;
      try {
        payload = JSON.parse(data);
      } catch {
        return;
      }
      if (event === 'text') onText?.(payload.delta);
      else if (event === 'tool') onTool?.(payload);
      else if (event === 'done') onDone?.(payload);
      else if (event === 'error') onError?.(payload.message);
    };

    // SSE events are separated by blank lines
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        processEvent(buffer.slice(0, idx));
        buffer = buffer.slice(idx + 2);
      }
    }
    if (buffer.trim()) processEvent(buffer);
  }
};

export default assistantService;
