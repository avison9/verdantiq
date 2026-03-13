import { useParams, useNavigate } from "react-router-dom";
import usePageTitle from "../../hooks/usePageTitle";
import { useState } from "react";
import {
  useGetSensorQuery,
  useGetSensorConnectionEventsQuery,
  type SensorConnectionEvent,
} from "../../redux/apislices/userDashboardApiSlice";
import { STATUS_STYLES } from "./sensorUtils";

const PER_PAGE_OPTIONS = [10, 20, 50] as const;

// ── Event config ──────────────────────────────────────────────────────────────

const EVENT_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  sensor_registered: {
    label: "Sensor Registered",
    color: "bg-blue-500",
    icon: (
      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  connection_initiated: {
    label: "Connection Setup Started",
    color: "bg-orange-400",
    icon: (
      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
          d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  data_received: {
    label: "First Data Received",
    color: "bg-emerald-500",
    icon: (
      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  data_streaming: {
    label: "Data Streaming",
    color: "bg-emerald-500",
    icon: (
      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  warehouse_synced: {
    label: "Warehouse Synced",
    color: "bg-purple-500",
    icon: (
      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
};

const STATUS_BADGE: Record<string, string> = {
  success: "bg-emerald-100 text-emerald-700",
  pending: "bg-orange-100 text-orange-600",
  failed:  "bg-red-100 text-red-600",
};

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

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// ── Event card ────────────────────────────────────────────────────────────────

function EventCard({ event, isLast }: { event: SensorConnectionEvent; isLast: boolean }) {
  const meta = EVENT_META[event.event_type] ?? {
    label: event.event_type.replace(/_/g, " "),
    color: "bg-gray-400",
    icon: <span className="text-white text-xs">•</span>,
  };

  return (
    <div className="flex gap-4">
      {/* Timeline spine */}
      <div className="flex flex-col items-center shrink-0">
        <div className={`w-7 h-7 rounded-full ${meta.color} flex items-center justify-center shadow-sm z-10`}>
          {meta.icon}
        </div>
        {!isLast && <div className="w-px flex-1 bg-gray-200 mt-1" />}
      </div>

      {/* Card body */}
      <div className={`bg-white border border-gray-100 rounded-xl px-5 py-4 shadow-sm w-full ${isLast ? "mb-0" : "mb-4"}`}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-semibold text-gray-800">{meta.label}</p>
            {event.message && (
              <p className="text-xs text-gray-500 mt-0.5">{event.message}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_BADGE[event.status] ?? "bg-gray-100 text-gray-500"}`}>
              {event.status}
            </span>
            <span
              className="text-xs text-gray-400 whitespace-nowrap"
              title={new Date(event.created_at).toLocaleString()}
            >
              {formatRelative(event.created_at)}
            </span>
          </div>
        </div>

        {event.details && Object.keys(event.details).length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-50 flex flex-wrap gap-3">
            {Object.entries(event.details).map(([k, v]) => (
              <span key={k} className="text-xs bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 text-gray-600">
                <span className="text-gray-400 mr-1">{k}:</span>
                {String(v)}
              </span>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-300 mt-2">
          {new Date(event.created_at).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const SensorConnectionDetail = () => {
  const { sensorId } = useParams<{ sensorId: string }>();
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<(typeof PER_PAGE_OPTIONS)[number]>(20);

  const { data: sensor, isLoading: sensorLoading } = useGetSensorQuery(sensorId ?? "", {
    skip: !sensorId,
  });
  const { data: eventsPage, isLoading: eventsLoading, isFetching } = useGetSensorConnectionEventsQuery(
    { sensor_id: sensorId ?? "", page, per_page: perPage },
    { skip: !sensorId },
  );

  usePageTitle(sensor ? `${sensor.sensor_name} — Connection — VerdantIQ` : "Connection — VerdantIQ");

  const events     = eventsPage?.items ?? [];
  const total      = eventsPage?.total ?? 0;
  const totalPages = eventsPage?.pages ?? 1;
  const pageRange  = buildPageRange(page, totalPages);

  if (sensorLoading) {
    return <div className="px-6 py-16 text-center text-sm text-gray-400">Loading…</div>;
  }

  if (!sensor) {
    return <div className="px-6 py-16 text-center text-sm text-gray-400">Sensor not found.</div>;
  }

  return (
    <div className="px-6 py-8 max-w-3xl">
      {/* Back */}
      <button
        onClick={() => navigate("/sensors/connections")}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-emerald-600 transition-colors mb-6"
      >
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
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 mb-8 grid grid-cols-2 gap-4 text-xs">
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
            {sensor.last_message_at ? new Date(sensor.last_message_at).toLocaleString() : "No data yet"}
          </p>
        </div>
        <div>
          <p className="text-gray-400 uppercase tracking-wide mb-0.5">Total Messages</p>
          <p className="text-gray-700">{sensor.message_count.toLocaleString()}</p>
        </div>
      </div>

      {/* Event trail header */}
      <div className="mb-6">
        <h2 className="text-base font-semibold text-gray-800">Connection History</h2>
        <p className="text-sm text-gray-400 mt-0.5">
          {eventsLoading ? "Loading…" : `${total} event${total !== 1 ? "s" : ""}`}
        </p>
      </div>

      {/* Timeline */}
      {eventsLoading ? (
        <div className="py-12 text-center text-sm text-gray-400">Loading events…</div>
      ) : events.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-gray-400 text-sm">No connection events yet.</p>
          <p className="text-xs text-gray-300 mt-1">Events appear here once you connect this sensor to the network.</p>
        </div>
      ) : (
        <div className={`transition-opacity ${isFetching ? "opacity-60" : ""}`}>
          {events.map((e, idx) => (
            <EventCard key={e.id} event={e} isLast={idx === events.length - 1} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!eventsLoading && events.length > 0 && (
        <div className="mt-6 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs"
            >‹</button>

            {pageRange.map((p, idx) =>
              p === "..." ? (
                <span key={`e-${idx}`} className="w-5 h-5 flex items-center justify-center text-gray-400 text-xs">…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-5 h-5 flex items-center justify-center rounded-full text-xs font-medium transition-colors ${
                    p === page ? "bg-emerald-600 text-white" : "text-gray-500 hover:bg-gray-100"
                  }`}
                >{p}</button>
              )
            )}

            <button
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs"
            >›</button>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>Rows per page</span>
            <select
              value={perPage}
              onChange={(e) => { setPerPage(Number(e.target.value) as typeof perPage); setPage(1); }}
              className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              {PER_PAGE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
      )}
    </div>
  );
};

export default SensorConnectionDetail;
