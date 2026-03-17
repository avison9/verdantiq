import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import usePageTitle from "../../hooks/usePageTitle";
import { useGetBillingQuery } from "../../redux/apislices/userDashboardApiSlice";

// ── Schema catalogue (static until Trino connects) ────────────────────────────

interface SchemaTable {
  name: string;
  cols: { name: string; type: string }[];
}
interface SchemaEntry {
  name: string;
  tables: SchemaTable[];
}
interface Catalog {
  name: string;
  schemas: SchemaEntry[];
}

const CATALOG: Catalog[] = [
  {
    name: "iceberg",
    schemas: [
      {
        name: "verdantiq",
        tables: [
          { name: "sensor_readings", cols: [
            { name: "ts",          type: "TIMESTAMP" },
            { name: "sensor_id",   type: "VARCHAR" },
            { name: "tenant_id",   type: "INTEGER" },
            { name: "value",       type: "DOUBLE" },
            { name: "unit",        type: "VARCHAR" },
          ]},
          { name: "farms", cols: [
            { name: "farm_id",      type: "VARCHAR" },
            { name: "tenant_id",    type: "INTEGER" },
            { name: "farm_name",    type: "VARCHAR" },
            { name: "country",      type: "VARCHAR" },
            { name: "farm_size_ha", type: "DOUBLE" },
          ]},
          { name: "sensors", cols: [
            { name: "sensor_id",   type: "VARCHAR" },
            { name: "sensor_name", type: "VARCHAR" },
            { name: "sensor_type", type: "VARCHAR" },
            { name: "status",      type: "VARCHAR" },
            { name: "created_at",  type: "TIMESTAMP" },
          ]},
          { name: "aggregates_daily", cols: [
            { name: "date",        type: "DATE" },
            { name: "sensor_id",   type: "VARCHAR" },
            { name: "avg_value",   type: "DOUBLE" },
            { name: "min_value",   type: "DOUBLE" },
            { name: "max_value",   type: "DOUBLE" },
            { name: "reading_cnt", type: "BIGINT" },
          ]},
        ],
      },
    ],
  },
];

const DEFAULT_SQL = `SELECT
  sensor_id,
  AVG(value)   AS avg_value,
  COUNT(*)     AS readings
FROM iceberg.verdantiq.sensor_readings
WHERE tenant_id = current_user_tenant()
  AND ts >= NOW() - INTERVAL '7' DAY
GROUP BY sensor_id
ORDER BY avg_value DESC
LIMIT 50;`;

interface ResultSet {
  columns: string[];
  rows:    string[][];
  ms:      number;
}

// ── Schema Explorer ────────────────────────────────────────────────────────────

function SchemaExplorer({ onInsert }: { onInsert: (text: string) => void }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "iceberg": true,
    "iceberg.verdantiq": true,
  });
  const [search, setSearch] = useState("");

  const toggle = (key: string) =>
    setExpanded(p => ({ ...p, [key]: !p[key] }));

  return (
    <div className="flex flex-col h-full border-r border-gray-200 bg-gray-50">
      {/* Header */}
      <div className="px-3 py-3 border-b border-gray-200">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Explorer</p>
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tables…"
            className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-2 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
        {CATALOG.map(cat => (
          <div key={cat.name}>
            {/* Catalog */}
            <button
              onClick={() => toggle(cat.name)}
              className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-gray-100 transition-colors text-left"
            >
              <svg className={`w-3 h-3 text-gray-400 transition-transform shrink-0 ${expanded[cat.name] ? "rotate-90" : ""}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <svg className="w-3.5 h-3.5 text-blue-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-xs font-semibold text-gray-700">{cat.name}</span>
            </button>

            {expanded[cat.name] && cat.schemas.map(schema => {
              const schemaKey = `${cat.name}.${schema.name}`;
              const filteredTables = schema.tables.filter(t =>
                !search || t.name.toLowerCase().includes(search.toLowerCase())
              );
              if (search && filteredTables.length === 0) return null;

              return (
                <div key={schema.name} className="ml-3">
                  <button
                    onClick={() => toggle(schemaKey)}
                    className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-gray-100 transition-colors text-left"
                  >
                    <svg className={`w-3 h-3 text-gray-400 transition-transform shrink-0 ${expanded[schemaKey] ? "rotate-90" : ""}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                    </svg>
                    <span className="text-xs font-medium text-gray-600">{schema.name}</span>
                  </button>

                  {expanded[schemaKey] && filteredTables.map(table => {
                    const tableKey = `${schemaKey}.${table.name}`;
                    const fqn = `${cat.name}.${schema.name}.${table.name}`;
                    return (
                      <div key={table.name} className="ml-3">
                        <button
                          onClick={() => toggle(tableKey)}
                          onDoubleClick={() => onInsert(fqn)}
                          title={`Double-click to insert ${fqn}`}
                          className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-emerald-50 hover:text-emerald-700 transition-colors text-left group"
                        >
                          <svg className={`w-3 h-3 text-gray-300 group-hover:text-emerald-400 transition-transform shrink-0 ${expanded[tableKey] ? "rotate-90" : ""}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M3 10h18M3 14h18M10 4v16M14 4v16M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />
                          </svg>
                          <span className="text-xs text-gray-700 group-hover:text-emerald-700 font-medium">{table.name}</span>
                        </button>

                        {expanded[tableKey] && (
                          <div className="ml-6 pb-1">
                            {table.cols.map(col => (
                              <div key={col.name}
                                className="flex items-center gap-2 px-2 py-0.5 hover:bg-gray-100 rounded cursor-pointer"
                                onClick={() => onInsert(col.name)}>
                                <svg className="w-3 h-3 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                                <span className="text-xs text-gray-600">{col.name}</span>
                                <span className="text-[10px] text-gray-400 ml-auto font-mono">{col.type}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const StorageQuery = () => {
  usePageTitle("Query — VerdantIQ Analytics");
  const { data: billing } = useGetBillingQuery();
  const billingActive = billing?.status === "active";

  const [sql, setSql]         = useState(DEFAULT_SQL);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ResultSet | null>(null);
  const [activeTab, setActiveTab] = useState<"results" | "history">("results");
  const [history, setHistory] = useState<{ ts: string; query: string; ms: number }[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInsert = (text: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end   = el.selectionEnd;
    const next  = sql.slice(0, start) + text + sql.slice(end);
    setSql(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + text.length;
    });
  };

  const handleRun = async () => {
    if (!billingActive || !sql.trim()) return;
    setRunning(true);
    setResults(null);
    setActiveTab("results");
    const start = Date.now();
    await new Promise(r => setTimeout(r, 650));
    const ms = Date.now() - start;
    // Trino pending — return empty result set with expected columns
    setResults({ columns: ["sensor_id", "avg_value", "readings"], rows: [], ms });
    setHistory(prev => [{
      ts: new Date().toLocaleTimeString(),
      query: sql.trim().slice(0, 100) + (sql.trim().length > 100 ? "…" : ""),
      ms,
    }, ...prev.slice(0, 19)]);
    setRunning(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleRun();
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const el = textareaRef.current!;
      const s  = el.selectionStart;
      const en = el.selectionEnd;
      setSql(v => v.slice(0, s) + "  " + v.slice(en));
      requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + 2; });
    }
  };

  const lineCount = sql.split("\n").length;

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-gray-800">Query Console</h1>
          <span className="text-gray-300">·</span>
          <span className="text-xs font-mono text-gray-500">iceberg.verdantiq</span>
          {/* Connection status */}
          <span className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Trino not connected
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!billingActive && (
            <Link to="/billing/setup"
              className="text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg transition-colors">
              Setup Billing
            </Link>
          )}
          <button
            onClick={() => setSql(DEFAULT_SQL)}
            className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Reset
          </button>
          <button
            onClick={handleRun}
            disabled={running || !billingActive}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors"
          >
            {running ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
            {running ? "Running…" : "Run"}
            <span className="text-blue-200 text-[10px] ml-0.5">⌘↵</span>
          </button>
        </div>
      </div>

      {/* ── Body: schema | editor + results ─────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: Schema Explorer */}
        <div className="w-56 shrink-0 overflow-hidden flex flex-col">
          <SchemaExplorer onInsert={handleInsert} />
        </div>

        {/* Right: Editor + Results */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Editor section */}
          <div className="flex flex-col border-b border-gray-200" style={{ minHeight: "220px", maxHeight: "50%" }}>
            {/* Editor tab bar */}
            <div className="flex items-center gap-0 border-b border-gray-200 bg-gray-50 px-4 shrink-0">
              <div className="flex items-center gap-1.5 px-3 py-2 border-b-2 border-blue-600 bg-white -mb-px">
                <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                <span className="text-xs font-medium text-gray-700">query.sql</span>
              </div>
            </div>

            {/* Editor area with line numbers */}
            <div className="flex flex-1 overflow-auto bg-white">
              {/* Line numbers */}
              <div className="shrink-0 select-none bg-gray-50 border-r border-gray-100 px-3 py-4 text-right"
                aria-hidden="true">
                {Array.from({ length: lineCount }, (_, i) => (
                  <div key={i} className="text-xs leading-6 text-gray-300 font-mono">{i + 1}</div>
                ))}
              </div>
              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={sql}
                onChange={e => setSql(e.target.value)}
                onKeyDown={handleKeyDown}
                spellCheck={false}
                disabled={!billingActive}
                className="flex-1 py-4 px-4 text-sm font-mono text-gray-800 leading-6 resize-none focus:outline-none bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ fontFamily: "'Fira Code', 'Cascadia Code', 'Courier New', monospace" }}
              />
            </div>
          </div>

          {/* Results section */}
          <div className="flex-1 flex flex-col overflow-hidden bg-white">
            {/* Results tab bar */}
            <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 shrink-0">
              <div className="flex items-center gap-0">
                {(["results", "history"] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`px-3 py-2 text-xs font-medium capitalize transition-colors border-b-2 -mb-px ${
                      activeTab === tab
                        ? "border-blue-600 text-blue-600 bg-white"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}>
                    {tab}
                    {tab === "history" && history.length > 0 && (
                      <span className="ml-1.5 text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">
                        {history.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {results && (
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1 text-emerald-600">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {results.rows.length} rows
                  </span>
                  <span>{results.ms} ms</span>
                </div>
              )}
            </div>

            {/* Results / History content */}
            <div className="flex-1 overflow-auto">
              {activeTab === "results" && (
                <>
                  {!results && !running && (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
                      <svg className="w-10 h-10 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M3 10h18M3 14h18M10 4v16M14 4v16M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />
                      </svg>
                      <p className="text-sm text-gray-400">Run a query to see results</p>
                    </div>
                  )}
                  {running && (
                    <div className="flex items-center justify-center h-full gap-2 text-gray-500">
                      <svg className="w-4 h-4 animate-spin text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span className="text-sm">Executing query…</span>
                    </div>
                  )}
                  {results && !running && (
                    <table className="w-full text-sm border-collapse">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 w-10 tabular-nums">#</th>
                          {results.columns.map(col => (
                            <th key={col} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {results.rows.length === 0 ? (
                          <tr>
                            <td colSpan={results.columns.length + 1}
                              className="px-4 py-12 text-center text-sm text-gray-400">
                              <div className="flex flex-col items-center gap-2">
                                <svg className="w-8 h-8 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                </svg>
                                <p>0 rows returned</p>
                                <p className="text-xs text-gray-300">Trino + Iceberg integration pending</p>
                              </div>
                            </td>
                          </tr>
                        ) : results.rows.map((row, ri) => (
                          <tr key={ri} className={`border-b border-gray-50 hover:bg-blue-50/30 transition-colors ${ri % 2 === 0 ? "" : "bg-gray-50/40"}`}>
                            <td className="px-4 py-2 text-xs text-gray-300 tabular-nums">{ri + 1}</td>
                            {row.map((cell, ci) => (
                              <td key={ci} className="px-4 py-2 text-xs text-gray-700 font-mono whitespace-nowrap max-w-xs truncate">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}

              {activeTab === "history" && (
                <div className="divide-y divide-gray-50">
                  {history.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-sm text-gray-400">
                      No query history yet
                    </div>
                  ) : history.map((h, i) => (
                    <button key={i} onClick={() => { setSql(h.query); setActiveTab("results"); }}
                      className="w-full flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors text-left">
                      <span className="text-xs text-gray-400 font-mono shrink-0 w-16">{h.ts}</span>
                      <span className="text-xs font-mono text-gray-700 flex-1 truncate">{h.query}</span>
                      <span className="text-xs text-emerald-600 shrink-0">{h.ms} ms</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StorageQuery;
