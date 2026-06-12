import { useState, useEffect, useCallback } from 'react';
import { connectorsService } from '../../services/connectorsService';
import styles from './Connectors.module.css';

const EMPTY_FORM = {
  name: '',
  description: '',
  transport: 'stdio',
  command: 'node',
  argsText: '',
  envText: '',
  url: ''
};

const formFromConnector = (c) => ({
  name: c.name,
  description: c.description,
  transport: c.transport,
  command: c.command,
  argsText: (c.args || []).join('\n'),
  envText: Object.entries(c.env || {}).map(([k, v]) => `${k}=${v}`).join('\n'),
  url: c.url
});

const formToPayload = (form) => ({
  name: form.name,
  description: form.description,
  transport: form.transport,
  command: form.command,
  args: form.argsText.split('\n').map((s) => s.trim()).filter(Boolean),
  env: Object.fromEntries(
    form.envText
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.includes('='))
      .map((s) => {
        const idx = s.indexOf('=');
        return [s.slice(0, idx), s.slice(idx + 1)];
      })
  ),
  url: form.url
});

function StatusDot({ status }) {
  const cls =
    status?.state === 'connected'
      ? styles.dotConnected
      : status?.state === 'error'
        ? styles.dotError
        : styles.dotIdle;
  const label =
    status?.state === 'connected' ? 'Connected' : status?.state === 'error' ? `Error: ${status.error}` : 'Idle';
  return <span className={`${styles.dot} ${cls}`} title={label} />;
}

function ToolRunner({ connectorId, tool }) {
  const [args, setArgs] = useState({});
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  const properties = tool.inputSchema?.properties || {};
  const required = tool.inputSchema?.required || [];

  const run = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      // Coerce non-string params typed as JSON; strings pass through as-is
      const coerced = {};
      for (const [key, value] of Object.entries(args)) {
        if (value === '') continue;
        const schema = properties[key];
        if (schema && schema.type && schema.type !== 'string') {
          try {
            coerced[key] = JSON.parse(value);
          } catch {
            coerced[key] = value;
          }
        } else {
          coerced[key] = value;
        }
      }
      const res = await connectorsService.callTool(connectorId, tool.name, coerced);
      setResult(res.text || JSON.stringify(res.raw, null, 2));
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className={styles.toolRunner}>
      {Object.entries(properties).map(([key, schema]) => (
        <label key={key} className={styles.toolParam}>
          <span className={styles.toolParamName}>
            {key}
            {required.includes(key) && <em> *</em>}
          </span>
          <input
            type="text"
            className={styles.input}
            placeholder={schema.description || schema.type || ''}
            value={args[key] || ''}
            onChange={(e) => setArgs({ ...args, [key]: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && run()}
          />
        </label>
      ))}
      <div className={styles.toolActions}>
        <button className={styles.primaryButton} onClick={run} disabled={running}>
          {running ? 'Running…' : 'Run'}
        </button>
        {result && (
          <button
            className={styles.secondaryButton}
            onClick={() => navigator.clipboard.writeText(result)}
          >
            Copy result
          </button>
        )}
      </div>
      {error && <div className={styles.error}>{error}</div>}
      {result && <pre className={styles.result}>{result}</pre>}
    </div>
  );
}

function ConnectorRow({ connector, onChanged }) {
  const [expanded, setExpanded] = useState(false);
  const [tools, setTools] = useState(null);
  const [toolsError, setToolsError] = useState(null);
  const [openTool, setOpenTool] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => formFromConnector(connector));

  const loadTools = async () => {
    setToolsError(null);
    setTools(null);
    try {
      setTools(await connectorsService.listTools(connector.id));
    } catch (e) {
      setToolsError(e.message);
    }
  };

  const handleExpand = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !tools) loadTools();
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await connectorsService.test(connector.id);
      setTestResult(res.ok ? `✓ ${res.toolCount} tool${res.toolCount !== 1 ? 's' : ''}: ${res.tools.join(', ')}` : `✗ ${res.error}`);
    } catch (e) {
      setTestResult(`✗ ${e.message}`);
    } finally {
      setTesting(false);
      onChanged();
    }
  };

  const handleToggle = async () => {
    await connectorsService.update(connector.id, { enabled: !connector.enabled });
    onChanged();
  };

  const handleDelete = async () => {
    if (!window.confirm(`Remove connector "${connector.name}"?`)) return;
    await connectorsService.remove(connector.id);
    onChanged();
  };

  const handleSaveEdit = async () => {
    await connectorsService.update(connector.id, formToPayload(form));
    setEditing(false);
    setTools(null);
    onChanged();
  };

  return (
    <div className={styles.connector}>
      <div className={styles.connectorHeader}>
        <button className={styles.connectorName} onClick={handleExpand}>
          <StatusDot status={connector.status} />
          <span>{connector.name}</span>
          <span className={styles.transportBadge}>{connector.transport}</span>
          {!connector.enabled && <span className={styles.disabledBadge}>disabled</span>}
        </button>
        <div className={styles.connectorActions}>
          <button className={styles.smallButton} onClick={handleTest} disabled={testing}>
            {testing ? 'Testing…' : 'Test'}
          </button>
          <button className={styles.smallButton} onClick={() => setEditing(!editing)}>
            Edit
          </button>
          <button className={styles.smallButton} onClick={handleToggle}>
            {connector.enabled ? 'Disable' : 'Enable'}
          </button>
          <button className={`${styles.smallButton} ${styles.dangerText}`} onClick={handleDelete}>
            Remove
          </button>
        </div>
      </div>

      {connector.description && (
        <div className={styles.connectorDescription}>{connector.description}</div>
      )}
      {testResult && <div className={styles.testResult}>{testResult}</div>}

      {editing && (
        <ConnectorForm
          form={form}
          setForm={setForm}
          onSubmit={handleSaveEdit}
          onCancel={() => setEditing(false)}
          submitLabel="Save"
        />
      )}

      {expanded && (
        <div className={styles.toolsList}>
          {toolsError && <div className={styles.error}>{toolsError}</div>}
          {tools === null && !toolsError && <div className={styles.muted}>Loading tools…</div>}
          {tools?.length === 0 && <div className={styles.muted}>This connector exposes no tools.</div>}
          {tools?.map((tool) => (
            <div key={tool.name} className={styles.tool}>
              <button
                className={styles.toolHeader}
                onClick={() => setOpenTool(openTool === tool.name ? null : tool.name)}
              >
                <code className={styles.toolName}>{tool.name}</code>
                <span className={styles.toolDescription}>{tool.description}</span>
              </button>
              {openTool === tool.name && (
                <ToolRunner connectorId={connector.id} tool={tool} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConnectorForm({ form, setForm, onSubmit, onCancel, submitLabel }) {
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  return (
    <div className={styles.form}>
      <label className={styles.field}>
        <span>Name</span>
        <input className={styles.input} value={form.name} onChange={set('name')} placeholder="My Commentary Lookup" />
      </label>
      <label className={styles.field}>
        <span>Description</span>
        <input className={styles.input} value={form.description} onChange={set('description')} placeholder="What this connector does" />
      </label>
      <label className={styles.field}>
        <span>Transport</span>
        <select className={styles.input} value={form.transport} onChange={set('transport')}>
          <option value="stdio">stdio (local script)</option>
          <option value="http">http (remote server)</option>
        </select>
      </label>
      {form.transport === 'stdio' ? (
        <>
          <label className={styles.field}>
            <span>Command</span>
            <input className={styles.input} value={form.command} onChange={set('command')} placeholder="node" />
          </label>
          <label className={styles.field}>
            <span>Arguments (one per line)</span>
            <textarea
              className={styles.input}
              rows={2}
              value={form.argsText}
              onChange={set('argsText')}
              placeholder={'connectors/my-connector/index.cjs'}
            />
          </label>
          <label className={styles.field}>
            <span>Environment (KEY=value, one per line, optional)</span>
            <textarea className={styles.input} rows={2} value={form.envText} onChange={set('envText')} />
          </label>
        </>
      ) : (
        <label className={styles.field}>
          <span>URL</span>
          <input className={styles.input} value={form.url} onChange={set('url')} placeholder="http://localhost:8080/mcp" />
        </label>
      )}
      <div className={styles.formActions}>
        <button className={styles.primaryButton} onClick={onSubmit} disabled={!form.name.trim()}>
          {submitLabel}
        </button>
        <button className={styles.secondaryButton} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export const ConnectorsModal = ({ onClose }) => {
  const [connectors, setConnectors] = useState([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      setConnectors(await connectorsService.list());
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handleKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleAdd = async () => {
    setError(null);
    try {
      await connectorsService.create(formToPayload(form));
      setForm(EMPTY_FORM);
      setAdding(false);
      refresh();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Connectors</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className={styles.intro}>
          Connectors are MCP servers that add tools to SACRED — commentary lookups,
          hymn suggestions, anything you can script. Their tools are also available to the
          AI assistant. See <code>docs/CONNECTORS.md</code> for how to write one with Claude.
        </p>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.list}>
          {connectors.length === 0 && !adding && (
            <div className={styles.muted}>
              No connectors yet. Try the bundled example: command <code>node</code>, args{' '}
              <code>connectors/examples/hymn-suggestions/index.cjs</code>
            </div>
          )}
          {connectors.map((c) => (
            <ConnectorRow key={c.id} connector={c} onChanged={refresh} />
          ))}
        </div>

        {adding ? (
          <ConnectorForm
            form={form}
            setForm={setForm}
            onSubmit={handleAdd}
            onCancel={() => setAdding(false)}
            submitLabel="Add Connector"
          />
        ) : (
          <button className={styles.primaryButton} onClick={() => setAdding(true)}>
            + Add Connector
          </button>
        )}
      </div>
    </div>
  );
};

export default ConnectorsModal;
