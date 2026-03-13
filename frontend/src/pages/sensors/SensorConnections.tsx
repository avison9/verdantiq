import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import usePageTitle from "../../hooks/usePageTitle";
import { useGetMeQuery } from "../../redux/apislices/authApiSlice";
import {
  useGetSensorsQuery,
  useUpdateSensorStatusMutation,
  useInitiateConnectionMutation,
  type SensorStatus,
} from "../../redux/apislices/userDashboardApiSlice";
import { STATUS_STYLES, sensorIcon } from "./SensorList";

const STATUS_DOT: Record<string, string> = {
  pending:     "bg-orange-400",
  active:      "bg-emerald-500",
  inactive:    "bg-gray-400",
  error:       "bg-red-500",
  maintenance: "bg-yellow-400",
};

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={copy}
      title="Copy"
      className="ml-1 p-0.5 text-gray-300 hover:text-gray-500 transition-colors"
    >
      {copied ? (
        <svg className="w-3 h-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  );
}

const PER_PAGE_OPTIONS = [5, 10, 20] as const;

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

const SensorConnections = () => {
  usePageTitle("Sensor Connections — VerdantIQ");
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<(typeof PER_PAGE_OPTIONS)[number]>(10);

  const { data: me } = useGetMeQuery();
  const { data, isLoading, isFetching } = useGetSensorsQuery(
    { tenant_id: me?.tenant_id ?? 0, page, per_page: perPage },
    { skip: !me },
  );
  const [updateStatus] = useUpdateSensorStatusMutation();
  const [initiateConnection] = useInitiateConnectionMutation();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  const sensors    = data?.items ?? [];
  const total      = data?.total ?? 0;
  const totalPages = data?.pages ?? 1;
  const pageRange  = buildPageRange(page, totalPages);

  const handleConnect = async (sensor_id: string) => {
    setConnectingId(sensor_id);
    try {
      await initiateConnection(sensor_id).unwrap();
      toast.success("Connection setup initiated — configure your device with the token below.");
      navigate(`/sensors/${sensor_id}/connection`);
    } catch {
      toast.error("Failed to initiate connection");
    }
    setConnectingId(null);
  };

  const handleStatusChange = async (sensor_id: string, newStatus: SensorStatus) => {
    setUpdatingId(sensor_id);
    try {
      await updateStatus({ sensor_id, status: newStatus }).unwrap();
      toast.success(`Status updated to ${newStatus}`);
    } catch {
      toast.error("Failed to update status");
    }
    setUpdatingId(null);
  };

  return (
    <div className="px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-lg font-semibold text-gray-800">Sensor Connections</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {isLoading ? "Loading…" : `${total} sensor${total !== 1 ? "s" : ""} — configure and monitor data pipeline connections.`}
        </p>
      </div>

      {/* Info banner */}
      <div className="mb-6 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-sm text-amber-800 max-w-3xl">
        <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>
          Data services integration is pending. Once connected, your sensor status will update automatically when data starts flowing.
          Use the <strong>Device Token</strong> to configure your hardware, then click <strong>Connect to Network</strong> to begin setup.
        </span>
      </div>

      {isLoading ? (
        <div className="text-sm text-gray-400 py-12 text-center">Loading sensors…</div>
      ) : sensors.length === 0 ? (
        <div className="text-sm text-gray-400 py-12 text-center">No sensors registered yet.</div>
      ) : (
        <div className={`space-y-4 max-w-3xl transition-opacity ${isFetching ? "opacity-60" : ""}`}>
          {sensors.map((s) => {
            const messageTopic = `verdantiq.sensors.${me?.tenant_id}.${s.sensor_id}`;
            const isUpdating  = updatingId === s.sensor_id;
            const isConnecting = connectingId === s.sensor_id;

            return (
              <div
                key={s.sensor_id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4"
              >
                {/* Card header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{sensorIcon(s.sensor_type)}</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{s.sensor_name}</p>
                      <p className="text-xs text-gray-400 capitalize">{s.sensor_type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => navigate(`/sensors/${s.sensor_id}/connection`)}
                      className="text-xs text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
                    >
                      View details →
                    </button>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${STATUS_DOT[s.status] ?? "bg-gray-400"}`} />
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${
                        STATUS_STYLES[s.status] ?? "bg-gray-100 text-gray-500"
                      }`}>
                        {s.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Connection details */}
                <div className="space-y-2 text-xs mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 uppercase tracking-wide">Device Token</span>
                    <span className="flex items-center font-mono text-gray-600">
                      {s.mqtt_token.slice(0, 16)}…
                      <CopyButton value={s.mqtt_token} />
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 uppercase tracking-wide">Message Channel</span>
                    <span className="flex items-center font-mono text-gray-600 text-right max-w-[240px] truncate">
                      {messageTopic}
                      <CopyButton value={messageTopic} />
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 uppercase tracking-wide">Backup Channels</span>
                    <span className="font-mono text-gray-700 font-semibold">3</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 uppercase tracking-wide">Data Format</span>
                    <span className="text-gray-600">Avro (Schema Registry)</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="border-t border-gray-50 pt-3 flex items-center justify-between">
                  <p className="text-xs text-gray-400">
                    {s.status === "pending"
                      ? "Configure your device with the token above, then connect it to the network."
                      : s.status === "active"
                      ? "Sensor is connected and data is flowing."
                      : "Reconnect your device to resume data flow."}
                  </p>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    {s.status === "pending" && (
                      <button
                        disabled={isConnecting}
                        onClick={() => handleConnect(s.sensor_id)}
                        className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {isConnecting ? "Setting up…" : "Connect to Network"}
                      </button>
                    )}
                    {s.status === "active" && (
                      <button
                        disabled={isUpdating}
                        onClick={() => handleStatusChange(s.sensor_id, "inactive")}
                        className="text-xs font-medium border border-gray-200 text-gray-500 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {isUpdating ? "Updating…" : "Deactivate"}
                      </button>
                    )}
                    {(s.status === "inactive" || s.status === "error") && (
                      <button
                        disabled={isConnecting}
                        onClick={() => handleConnect(s.sensor_id)}
                        className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {isConnecting ? "Setting up…" : "Reconnect to Network"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pt-4 flex items-center justify-between gap-4 flex-wrap">
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
                <span>Per page</span>
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
      )}
    </div>
  );
};

export default SensorConnections;
