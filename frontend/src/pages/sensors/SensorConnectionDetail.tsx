import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import usePageTitle from "../../hooks/usePageTitle";
import {
  useGetSensorQuery,
  useGetSensorConnectionEventsQuery,
  type SensorConnectionEvent,
} from "../../redux/apislices/userDashboardApiSlice";
import { STATUS_STYLES } from "./sensorUtils";

const DATA_SERVICE_URL = import.meta.env.VITE_DATA_SERVICE_URL ?? "http://localhost:8090";

const PER_PAGE_OPTIONS = [10, 20, 50] as const;

// ── Live ticker — forces re-render every second so relative times stay current ─

function useTick(ms = 1000) {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set(n => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

// ── UTC-safe date parser ──────────────────────────────────────────────────────
// The backend returns timestamps without the trailing "Z" (e.g. "2026-03-14T10:15:30").
// Without the Z, browsers parse the string as *local time*, making every event
// appear offset by the local UTC offset (e.g. 1 h in WAT/UTC+1).
// We force UTC interpretation by appending "Z" if no timezone is present.

function toUtcDate(iso: string): Date {
  // Already has timezone info (+HH:MM or Z) — leave as-is
  if (/[Z+]/.test(iso.slice(10))) return new Date(iso);
  // No timezone — treat as UTC
  return new Date(iso + "Z");
}

// ── Relative time (seconds-precision, always current because of useTick) ──────

function formatRelative(iso: string): string {
  const diffMs = Date.now() - toUtcDate(iso).getTime();
  const secs   = Math.floor(diffMs / 1000);
  const mins   = Math.floor(diffMs / 60_000);
  const hours  = Math.floor(diffMs / 3_600_000);
  const days   = Math.floor(diffMs / 86_400_000);
  if (secs  <  5)  return "just now";
  if (secs  < 60)  return `${secs}s ago`;
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  return `${days}d ago`;
}

// Short absolute date shown inline: "14 Mar 2026, 10:15:30"
function formatShort(iso: string): string {
  return toUtcDate(iso).toLocaleString(undefined, {
    day:    "numeric",
    month:  "short",
    year:   "numeric",
    hour:   "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// ── Event meta ────────────────────────────────────────────────────────────────

const checkSvg = (
  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
);

const EVENT_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  sensor_registered: {
    label: "Sensor Registered",
    color: "bg-blue-500",
    icon: (
      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  connection_initiated: {
    label: "Connection Setup Started",
    color: "bg-orange-400",
    icon: (
      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  mqtt_topic_created:   { label: "MQTT Topic Created",      color: "bg-sky-500",     icon: checkSvg },
  kafka_topic_created:  { label: "Kafka Topic Created",     color: "bg-sky-600",     icon: checkSvg },
  simulator_started:    { label: "IoT Simulator Started",   color: "bg-indigo-500",  icon: checkSvg },
  spark_consumer_active:{ label: "Spark Consumer Active",   color: "bg-violet-500",  icon: checkSvg },
  pipeline_ready:       { label: "Pipeline Ready",          color: "bg-emerald-600", icon: checkSvg },
  data_received:        { label: "First Data Received",     color: "bg-emerald-500", icon: checkSvg },
  data_streaming:       { label: "Data Streaming",          color: "bg-emerald-500", icon: checkSvg },
  warehouse_synced:     { label: "Warehouse Synced",        color: "bg-purple-500",  icon: checkSvg },
};

const STATUS_BADGE: Record<string, string> = {
  success: "bg-emerald-100 text-emerald-700",
  pending: "bg-orange-100  text-orange-600",
  failed:  "bg-red-100     text-red-600",
  running: "bg-yellow-100  text-yellow-700",
};

// ── Compact 2-line event row ──────────────────────────────────────────────────

function EventRow({ event, isLast }: { event: SensorConnectionEvent; isLast: boolean }) {
  const meta = EVENT_META[event.event_type] ?? {
    label: event.event_type.replace(/_/g, " "),
    color: "bg-gray-400",
    icon:  <span className="text-white text-xs font-bold">·</span>,
  };

  // Pull "initiated_by" from details to show inline on line 1
  const initiatedBy    = event.details?.initiated_by as string | undefined;
  const otherDetails   = Object.entries(event.details ?? {}).filter(([k]) => k !== "initiated_by");

  return (
    <div className="flex gap-3">
      {/* ── Timeline dot + spine ── */}
      <div className="flex flex-col items-center shrink-0 pt-0.5">
        <div className={`w-5 h-5 rounded-full ${meta.color} flex items-center justify-center shadow-sm z-10 shrink-0`}>
          {meta.icon}
        </div>
        {!isLast && <div className="w-px flex-1 bg-gray-200 mt-1 mb-1" />}
      </div>

      {/* ── 2-line content ── */}
      <div className={`flex-1 min-w-0 ${isLast ? "pb-0" : "pb-4"}`}>

        {/* Line 1: label · initiated by · date · badge · relative */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 leading-none">
          <span className="text-xs font-semibold text-gray-800">{meta.label}</span>

          {initiatedBy && (
            <>
              <span className="text-gray-300 select-none">·</span>
              <span className="text-xs text-gray-400">
                initiated by: <span className="text-gray-600">{initiatedBy}</span>
              </span>
            </>
          )}

          <span className="text-gray-300 select-none">·</span>
          <span className="text-xs text-gray-400 tabular-nums whitespace-nowrap">
            {formatShort(event.created_at)}
          </span>

          <span className="text-gray-300 select-none">·</span>
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full capitalize leading-tight ${
            STATUS_BADGE[event.status] ?? "bg-gray-100 text-gray-500"
          }`}>
            {event.status}
          </span>

          <span className="text-gray-300 select-none">·</span>
          <span className="text-xs text-gray-400 tabular-nums whitespace-nowrap">
            {formatRelative(event.created_at)}
          </span>
        </div>

        {/* Line 2: details + message */}
        {(otherDetails.length > 0 || event.message) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
            {event.message && (
              <span className="text-xs text-gray-400">{event.message}</span>
            )}
            {otherDetails.map(([k, v]) => (
              <span key={k} className="text-xs text-gray-400">
                <span className="text-gray-300">{k.replace(/_/g, " ")}:</span>{" "}
                <span className="text-gray-600 font-mono">{String(v)}</span>
              </span>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

// ── Pagination helper ─────────────────────────────────────────────────────────

function buildPageRange(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  if (current > 3) pages.push("...");
  const start = Math.max(2, current - 1);
  const end   = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}

// ── Pipeline status types ─────────────────────────────────────────────────────

interface PipelineStatus {
  active:       boolean;
  sensor_type?: string;
  topic?:       string;
}

// ── Main page ─────────────────────────────────────────────────────────────────

const SensorConnectionDetail = () => {
  const { sensorId } = useParams<{ sensorId: string }>();
  const navigate     = useNavigate();

  // Drives live relative-time updates across all rendered EventRows
  useTick(1000);

  const [page,           setPage]           = useState(1);
  const [perPage,        setPerPage]        = useState<(typeof PER_PAGE_OPTIONS)[number]>(20);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null);

  const { data: sensor, isLoading: sensorLoading } = useGetSensorQuery(sensorId ?? "", {
    skip: !sensorId,
  });

  // Poll every 4 s so new pipeline events appear without a manual refresh
  const { data: eventsPage, isLoading: eventsLoading, isFetching } = useGetSensorConnectionEventsQuery(
    { sensor_id: sensorId ?? "", page, per_page: perPage },
    { skip: !sensorId, pollingInterval: 4000 },
  );

  // Poll data service every 5 s to show live pipeline active/offline banner
  useEffect(() => {
    if (!sensor) return;
    const check = async () => {
      try {
        const r = await fetch(`${DATA_SERVICE_URL}/sensors/active`, {
          signal: AbortSignal.timeout(3000),
        });
        if (!r.ok) return;
        const body = await r.json() as {
          sensors: Array<{ key: string; sensor_type: string; topic: string }>;
        };
        const entry = body.sensors.find(s => s.key === `${sensor.tenant_id}.${sensorId}`);
        setPipelineStatus(
          entry
            ? { active: true, sensor_type: entry.sensor_type, topic: entry.topic }
            : { active: false },
        );
      } catch {
        // data service unreachable — leave banner as-is
      }
    };
    check();
    const id = setInterval(check, 5000);
    return () => clearInterval(id);
  }, [sensor, sensorId]);

  usePageTitle(sensor ? `${sensor.sensor_name} — Connection — VerdantIQ` : "Connection — VerdantIQ");

  const events     = eventsPage?.items ?? [];
  const total      = eventsPage?.total ?? 0;
  const totalPages = eventsPage?.pages ?? 1;
  const pageRange  = buildPageRange(page, totalPages);

  if (sensorLoading) return <div className="px-6 py-16 text-center text-sm text-gray-400">Loading…</div>;
  if (!sensor)       return <div className="px-6 py-16 text-center text-sm text-gray-400">Sensor not found.</div>;

  return (
    <div className="px-6 py-8 max-w-3xl">

      {/* Back */}
      <button onClick={() => navigate("/sensors/connections")}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-emerald-600 transition-colors mb-6">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Connections
      </button>

      {/* Sensor header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">{sensor.sensor_name}</h1>
          <p className="text-sm text-gray-400 mt-0.5 capitalize">{sensor.sensor_type} — Connection history</p>
        </div>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full capitalize ${
          STATUS_STYLES[sensor.status] ?? "bg-gray-100 text-gray-500"
        }`}>
          {sensor.status}
        </span>
      </div>

      {/* Connection info summary */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 mb-6 grid grid-cols-2 gap-4 text-xs">
        <div>
          <p className="text-gray-400 uppercase tracking-wide mb-0.5">Device Token</p>
          <p className="font-mono text-gray-700 break-all">{sensor.mqtt_token}</p>
        </div>
        <div>
          <p className="text-gray-400 uppercase tracking-wide mb-0.5">Message Channel</p>
          <p className="font-mono text-gray-700 break-all">
            verdantiq.sensors.{sensor.tenant_id}.{sensor.sensor_id}
          </p>
        </div>
        <div>
          <p className="text-gray-400 uppercase tracking-wide mb-0.5">Last Data Received</p>
          <p className="text-gray-700">
            {sensor.last_message_at ? formatShort(sensor.last_message_at) : "No data yet"}
          </p>
        </div>
        <div>
          <p className="text-gray-400 uppercase tracking-wide mb-0.5">Total Messages</p>
          <p className="text-gray-700">{sensor.message_count.toLocaleString()}</p>
        </div>
      </div>

      {/* Pipeline status banner */}
      {pipelineStatus !== null && (
        <div className={`mb-6 rounded-2xl border px-5 py-3 flex items-center gap-4 ${
          pipelineStatus.active ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-100"
        }`}>
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
            pipelineStatus.active ? "bg-emerald-500 animate-pulse" : "bg-gray-300"
          }`} />
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-semibold ${pipelineStatus.active ? "text-emerald-800" : "text-gray-500"}`}>
              {pipelineStatus.active ? "IoT Pipeline Active" : "Pipeline Offline"}
            </p>
            {pipelineStatus.active && pipelineStatus.topic && (
              <p className="text-xs text-emerald-600 font-mono mt-0.5 truncate">{pipelineStatus.topic}</p>
            )}
            {!pipelineStatus.active && (
              <p className="text-xs text-gray-400 mt-0.5">
                Go to <strong>Connections</strong> and click <strong>Connect to Network</strong> to start the pipeline.
              </p>
            )}
          </div>
          {pipelineStatus.active && (
            <button onClick={() => navigate(`/sensors/${sensorId}`)}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 underline shrink-0">
              Live terminal →
            </button>
          )}
        </div>
      )}

      {/* Event trail header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Connection History</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {eventsLoading ? "Loading…" : `${total} event${total !== 1 ? "s" : ""}`}
            {isFetching && !eventsLoading && <span className="ml-1 text-gray-300">· refreshing</span>}
          </p>
        </div>
      </div>

      {/* Timeline */}
      {eventsLoading ? (
        <div className="py-12 text-center text-sm text-gray-400">Loading events…</div>
      ) : events.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-gray-400 text-sm">No connection events yet.</p>
          <p className="text-xs text-gray-300 mt-1">
            Events appear here once you connect this sensor to the network.
          </p>
        </div>
      ) : (
        <div className={`transition-opacity ${isFetching ? "opacity-70" : ""}`}>
          {events.map((e, idx) => (
            <EventRow key={e.id} event={e} isLast={idx === events.length - 1} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!eventsLoading && events.length > 0 && (
        <div className="mt-6 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs">‹</button>

            {pageRange.map((p, idx) =>
              p === "..." ? (
                <span key={`e-${idx}`} className="w-5 h-5 flex items-center justify-center text-gray-400 text-xs">…</span>
              ) : (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-5 h-5 flex items-center justify-center rounded-full text-xs font-medium transition-colors ${
                    p === page ? "bg-emerald-600 text-white" : "text-gray-500 hover:bg-gray-100"
                  }`}>{p}</button>
              )
            )}

            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
              className="w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs">›</button>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>Rows per page</span>
            <select value={perPage}
              onChange={(e) => { setPerPage(Number(e.target.value) as typeof perPage); setPage(1); }}
              className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
              {PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
      )}
    </div>
  );
};

export default SensorConnectionDetail;
