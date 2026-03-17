import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import usePageTitle from "../../hooks/usePageTitle";
import { useGetBillingQuery } from "../../redux/apislices/userDashboardApiSlice";

const PLACEHOLDER_SQL = `-- VerdantIQ SQL Query Console (Trino)
-- Example queries:

SELECT sensor_id, AVG(value) as avg_value, COUNT(*) as readings
FROM iceberg.verdantiq.sensor_readings
WHERE tenant_id = current_user_tenant()
  AND ts >= NOW() - INTERVAL '7' DAY
GROUP BY sensor_id
ORDER BY avg_value DESC
LIMIT 50;`;

const StorageQuery = () => {
  usePageTitle("Query — VerdantIQ");
  const { data: billing } = useGetBillingQuery();
  const billingActive = billing?.status === "active";

  const [sql, setSql] = useState(PLACEHOLDER_SQL);
  const [running, setRunning] = useState(false);
  const [execTime, setExecTime] = useState<number | null>(null);
  const [results, setResults] = useState<string | null>(null);
  const [history, setHistory] = useState<{ ts: string; query: string; ms: number }[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [sql]);

  const handleRun = async () => {
    if (!billingActive || !sql.trim()) return;
    setRunning(true);
    setResults(null);
    const start = Date.now();
    // Trino integration pending — simulate with delay
    await new Promise(r => setTimeout(r, 600));
    const ms = Date.now() - start;
    setExecTime(ms);
    setResults("-- Trino integration coming soon.\n-- Results will appear here once the Trino + Iceberg backend is connected.");
    setHistory(prev => [{ ts: new Date().toLocaleTimeString(), query: sql.slice(0, 80) + (sql.length > 80 ? "…" : ""), ms }, ...prev.slice(0, 9)]);
    setRunning(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleRun();
    }
    // Tab inserts spaces
    if (e.key === "Tab") {
      e.preventDefault();
      const el = textareaRef.current!;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      setSql(s => s.slice(0, start) + "  " + s.slice(end));
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 2;
      });
    }
  };

  const trino = { host: "trino.verdantiq.internal", port: 8080, catalog: "iceberg", schema: "verdantiq" };

  return (
    <div className="px-6 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">Query Console</h1>
          <p className="text-sm text-gray-400 mt-0.5">SQL queries via Trino + Apache Iceberg</p>
        </div>
        {/* Connection info badge */}
        <div className="flex items-center gap-2 bg-gray-900 rounded-lg px-3 py-2 text-xs font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
          <span className="text-gray-400">{trino.host}:{trino.port}</span>
          <span className="text-gray-600">·</span>
          <span className="text-emerald-400">{trino.catalog}.{trino.schema}</span>
          <span className="ml-2 text-yellow-500 text-[10px] bg-yellow-900/40 px-1.5 py-0.5 rounded">not connected</span>
        </div>
      </div>

      {!billingActive && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-center gap-4 mb-6">
          <svg className="w-5 h-5 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">Active billing required</p>
            <p className="text-xs text-amber-600 mt-0.5">Set up billing to enable query access.</p>
          </div>
          <Link to="/billing/setup"
            className="text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg transition-colors">
            Setup Billing
          </Link>
        </div>
      )}

      {/* SQL Editor */}
      <div className="bg-gray-950 rounded-2xl border border-gray-800 shadow-xl overflow-hidden mb-4">
        {/* Editor toolbar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800 bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/70" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
            </div>
            <span className="text-xs text-gray-500 font-mono">query.sql</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600">Ctrl+Enter to run</span>
            <button
              onClick={handleRun}
              disabled={running || !billingActive}
              className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              {running ? (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {running ? "Running…" : "Run Query"}
            </button>
          </div>
        </div>

        {/* Code area */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={sql}
            onChange={e => setSql(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            disabled={!billingActive}
            className="w-full bg-transparent text-emerald-300 font-mono text-sm px-6 py-5 resize-none focus:outline-none min-h-[200px] leading-relaxed disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ fontFamily: "'Fira Code', 'Cascadia Code', 'Courier New', monospace" }}
          />
        </div>
      </div>

      {/* Results panel */}
      <div className="bg-gray-950 rounded-2xl border border-gray-800 shadow-xl overflow-hidden">
        {/* Results toolbar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800 bg-gray-900">
          <span className="text-xs text-gray-500 font-mono">results</span>
          {execTime !== null && (
            <div className="flex items-center gap-3 text-xs">
              <span className="text-emerald-500">✓ completed</span>
              <span className="text-gray-500">{execTime} ms</span>
            </div>
          )}
        </div>

        <div className="px-6 py-5 min-h-[120px]">
          {results ? (
            <pre className="text-gray-400 font-mono text-xs whitespace-pre-wrap leading-relaxed">{results}</pre>
          ) : running ? (
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono">
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Executing query…
            </div>
          ) : (
            <p className="text-gray-700 text-xs font-mono">-- Results will appear here after running a query</p>
          )}
        </div>
      </div>

      {/* Query history */}
      {history.length > 0 && (
        <div className="mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-700">Query History</p>
          </div>
          <div className="divide-y divide-gray-50">
            {history.map((h, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => setSql(history[i].query.replace("…", ""))}>
                <span className="text-xs text-gray-400 font-mono shrink-0">{h.ts}</span>
                <span className="text-xs font-mono text-gray-600 flex-1 truncate">{h.query}</span>
                <span className="text-xs text-emerald-600 shrink-0">{h.ms} ms</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StorageQuery;
