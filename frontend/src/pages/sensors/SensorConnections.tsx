import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import usePageTitle from "../../hooks/usePageTitle";
import { useGetMeQuery } from "../../redux/apislices/authApiSlice";
import {
  useGetSensorsQuery,
  useUpdateSensorStatusMutation,
  useUpdateSensorMutation,
  useInitiateConnectionMutation,
  useLogConnectionEventMutation,
  type Sensor,
  type SensorStatus,
} from "../../redux/apislices/userDashboardApiSlice";
import { STATUS_STYLES, sensorIcon } from "./sensorUtils";

const DATA_SERVICE_URL = import.meta.env.VITE_DATA_SERVICE_URL ?? "http://localhost:8090";

async function fetchReplicationFactor(topic: string): Promise<number | null> {
  try {
    const r = await fetch(
      `${DATA_SERVICE_URL}/kafka/topic-info?topic=${encodeURIComponent(topic)}`,
      { signal: AbortSignal.timeout(4000) },
    );
    if (!r.ok) return null;
    const body = await r.json() as { replication_factor: number };
    return body.replication_factor;
  } catch { return null; }
}

// ── Pipeline step config ───────────────────────────────────────────────────────

const PIPELINE_STEPS = [
  "Registering connection",
  "Creating MQTT topic",
  "Creating Kafka topic",
  "Starting IoT simulator",
  "Activating Spark consumer",
  "Pipeline ready",
] as const;

type StepStatus = "idle" | "in_progress" | "done" | "error";

interface PipelineState {
  steps:      StepStatus[];
  error?:     string;
  done:       boolean;
  mqttTopic?:  string;
  kafkaTopic?: string;
}

const initPipeline = (): PipelineState => ({
  steps: PIPELINE_STEPS.map(() => "idle" as StepStatus),
  done:  false,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

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
    <button onClick={copy} title="Copy"
      className="ml-1 p-0.5 text-gray-300 hover:text-gray-500 transition-colors">
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

// ── Step indicator ────────────────────────────────────────────────────────────

function StepRow({ label, status }: { label: string; status: StepStatus }) {
  const icon =
    status === "done"        ? <span className="text-emerald-500">✓</span> :
    status === "in_progress" ? <span className="animate-spin inline-block text-yellow-500">⟳</span> :
    status === "error"       ? <span className="text-red-500">✕</span> :
                               <span className="text-gray-300">○</span>;

  const textCls =
    status === "done"        ? "text-gray-700" :
    status === "in_progress" ? "text-yellow-700 font-medium" :
    status === "error"       ? "text-red-600" :
    "text-gray-400";

  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="w-4 text-center text-xs leading-none">{icon}</span>
      <span className={`text-xs ${textCls}`}>{label}</span>
    </div>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────

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

// ── Main component ────────────────────────────────────────────────────────────

const SensorConnections = () => {
  usePageTitle("Sensor Connections — VerdantIQ");
  const navigate = useNavigate();

  const [page,    setPage]    = useState(1);
  const [perPage, setPerPage] = useState<(typeof PER_PAGE_OPTIONS)[number]>(10);

  const { data: me }                    = useGetMeQuery();
  // Bug 1: poll every 30 s so message_count updates from pipeline
  const { data, isLoading, isFetching } = useGetSensorsQuery(
    { tenant_id: me?.tenant_id ?? 0, page, per_page: perPage },
    { skip: !me, pollingInterval: 30_000 },
  );
  const [updateStatus]      = useUpdateSensorStatusMutation();
  const [updateSensor]      = useUpdateSensorMutation();
  const [initiateConnection]= useInitiateConnectionMutation();
  const [logConnectionEvent]= useLogConnectionEventMutation();

  const [disconnectingId, setDisconnectingId]     = useState<string | null>(null);
  const [pipelines,       setPipelines]           = useState<Record<string, PipelineState>>({});
  const [replicationFactor, setReplicationFactor] = useState<number | null>(null);

  useEffect(() => {
    if (!data?.items.length || !me) return;
    const first = data.items[0];
    const topic = `verdantiq.${me.tenant_id}.${first.sensor_id}`;
    fetchReplicationFactor(topic).then(rf => { if (rf !== null) setReplicationFactor(rf); });
  }, [data, me]);

  const sensors    = data?.items ?? [];
  const total      = data?.total ?? 0;
  const totalPages = data?.pages ?? 1;
  const pageRange  = buildPageRange(page, totalPages);

  const setStep = (sid: string, idx: number, status: StepStatus) =>
    setPipelines(prev => {
      const p     = { ...(prev[sid] ?? initPipeline()) };
      const steps = [...p.steps] as StepStatus[];
      steps[idx]  = status;
      return { ...prev, [sid]: { ...p, steps } };
    });

  const markAllDone = (sid: string, extras: Partial<PipelineState> = {}) =>
    setPipelines(prev => ({
      ...prev,
      [sid]: {
        ...(prev[sid] ?? initPipeline()),
        steps: PIPELINE_STEPS.map(() => "done" as StepStatus),
        done:  true,
        ...extras,
      },
    }));

  const markError = (sid: string, error: string) =>
    setPipelines(prev => {
      const p     = { ...(prev[sid] ?? initPipeline()) };
      const steps = p.steps.map(s => s === "in_progress" ? "error" : s) as StepStatus[];
      return { ...prev, [sid]: { ...p, steps, error, done: false } };
    });

  // ── connect handler ────────────────────────────────────────────────────────

  const handleConnect = async (sensor: Sensor) => {
    const sid = sensor.sensor_id;
    setPipelines(prev => ({ ...prev, [sid]: initPipeline() }));
    setStep(sid, 0, "in_progress");

    try {
      await initiateConnection(sid).unwrap();
      setStep(sid, 0, "done");
    } catch {
      setStep(sid, 0, "done"); // non-fatal
    }

    setStep(sid, 1, "in_progress");
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setStep(sid, 2, "in_progress"), 900));
    timers.push(setTimeout(() => setStep(sid, 3, "in_progress"), 1800));
    timers.push(setTimeout(() => setStep(sid, 4, "in_progress"), 2700));

    try {
      const payload = {
        sensor_id:   sid,
        tenant_id:   sensor.tenant_id,
        sensor_type: sensor.sensor_type,
        device_id:   sid,
        location: {
          latitude:  parseFloat(String(sensor.sensor_metadata?.latitude  ?? 0)) || 0,
          longitude: parseFloat(String(sensor.sensor_metadata?.longitude ?? 0)) || 0,
        },
      };

      const resp = await fetch(`${DATA_SERVICE_URL}/sensors/connect`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });

      let result: Record<string, unknown> = {};
      try { result = await resp.json(); } catch { /* ignore */ }

      timers.forEach(clearTimeout);

      const stepEventMap: Record<string, string> = {
        kafka_topic_created: "kafka_topic_created",
        mqtt_topic_created:  "mqtt_topic_created",
        simulator_started:   "simulator_started",
      };
      const steps = (result.steps ?? {}) as Record<string, { status: string; message: string }>;
      Object.entries(stepEventMap).forEach(([stepKey, eventType]) => {
        const step = steps[stepKey];
        if (!step) return;
        logConnectionEvent({
          sensor_id:  sid,
          event_type: eventType,
          status:     step.status === "success" ? "success" : step.status === "skipped" ? "pending" : "failed",
          message:    step.message,
        });
      });

      if (!resp.ok) {
        const errText = result.detail ? String(result.detail) : `HTTP ${resp.status}`;
        markError(sid, errText);
        toast.error(`Pipeline setup failed: ${errText}`);
        return;
      }

      setStep(sid, 5, "in_progress");
      setTimeout(() => {
        markAllDone(sid, {
          mqttTopic:  String(result.mqtt_topic  ?? ""),
          kafkaTopic: String(result.kafka_topic ?? ""),
        });
        toast.success("Sensor pipeline is live!");
      }, 350);

      logConnectionEvent({
        sensor_id:  sid,
        event_type: "pipeline_ready",
        status:     "success",
        message:    "Full IoT pipeline is ready and streaming",
      });

      // Bug 5: log reconnect event if sensor was previously inactive
      if (sensor.status === "inactive" || sensor.status === "error") {
        logConnectionEvent({
          sensor_id:  sid,
          event_type: "sensor_reconnected",
          status:     "success",
          message:    "Sensor reconnected to network — resuming data pipeline",
        });
      }

      // Update backend: active status, Bug 3: persist protocol, data_format, network
      updateStatus({ sensor_id: sid, status: "active" });
      updateSensor({
        sensor_id:       sid,
        sensor_metadata: {
          protocol:    String(result.protocol    ?? "mqtt"),
          data_format: String(result.data_format ?? "json"),
          network:     String(result.network     ?? "WiFi"),
        },
      });

    } catch (err) {
      timers.forEach(clearTimeout);
      const msg = err instanceof Error ? err.message : String(err);
      markError(sid, msg);
      toast.error(`Pipeline setup failed: ${msg}`);
      logConnectionEvent({
        sensor_id:  sid,
        event_type: "connection_initiated",
        status:     "failed",
        message:    msg,
      });
    }
  };

  // ── Bug 5: disconnect stops pipeline and IoT simulator ────────────────────

  const handleDisconnect = async (sensor: Sensor) => {
    const sid = sensor.sensor_id;
    setDisconnectingId(sid);
    try {
      // Stop data service pipeline for this sensor
      await fetch(`${DATA_SERVICE_URL}/sensors/${sensor.tenant_id}/${sid}/disconnect`, {
        method: "DELETE",
      });
    } catch {
      // If data service is unreachable still update status
    }
    try {
      await updateStatus({ sensor_id: sid, status: "inactive" as SensorStatus }).unwrap();
      // Log disconnect event in trail
      logConnectionEvent({
        sensor_id:  sid,
        event_type: "sensor_disconnected",
        status:     "success",
        message:    "Sensor disconnected from network — pipeline stopped",
      });
      toast.success("Sensor disconnected from network");
    } catch {
      toast.error("Failed to disconnect sensor");
    }
    setDisconnectingId(null);
  };

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="px-6 py-8">
      <div className="mb-8">
        <h1 className="text-lg font-semibold text-gray-800">Sensor Connections</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {isLoading ? "Loading…" : `${total} sensor${total !== 1 ? "s" : ""} — configure and monitor data pipeline connections.`}
        </p>
      </div>

      <div className="mb-6 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-sm text-amber-800 max-w-3xl">
        <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>
          Use the <strong>Device Token</strong> to configure your hardware, then click{" "}
          <strong>Connect to Network</strong> to provision the full IoT pipeline (MQTT → Kafka → Spark → Iceberg).
        </span>
      </div>

      {isLoading ? (
        <div className="text-sm text-gray-400 py-12 text-center">Loading sensors…</div>
      ) : sensors.length === 0 ? (
        <div className="text-sm text-gray-400 py-12 text-center">No sensors registered yet.</div>
      ) : (
        <div className={`space-y-4 max-w-3xl transition-opacity ${isFetching ? "opacity-60" : ""}`}>
          {sensors.map((s) => {
            const messageTopic  = `verdantiq.sensors.${me?.tenant_id}.${s.sensor_id}`;
            const isDisconn     = disconnectingId === s.sensor_id;
            const pipeline      = pipelines[s.sensor_id];
            const isConnecting  = pipeline && !pipeline.done && !pipeline.error;
            // Bug 3: read network from sensor_metadata
            const network       = s.sensor_metadata?.network ? String(s.sensor_metadata.network) : null;

            return (
              <div key={s.sensor_id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">

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
                      {s.mqtt_token.slice(0, 16)}…<CopyButton value={s.mqtt_token} />
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 uppercase tracking-wide">Message Channel</span>
                    <span className="flex items-center font-mono text-gray-600 text-right max-w-[240px] truncate">
                      {messageTopic}<CopyButton value={messageTopic} />
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 uppercase tracking-wide">Backup Channels</span>
                    <span className="font-mono text-gray-700 font-semibold">
                      {replicationFactor !== null ? replicationFactor : "—"}
                    </span>
                  </div>
                  {/* Bug 3: network field dynamically populated */}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 uppercase tracking-wide">Network</span>
                    <span className="text-gray-600">
                      {network ?? "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 uppercase tracking-wide">Data Format</span>
                    <span className="text-gray-600">
                      {s.sensor_metadata?.data_format
                        ? String(s.sensor_metadata.data_format).toUpperCase()
                        : "—"}
                    </span>
                  </div>
                  {/* Bug 1: message count from pipeline polling */}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 uppercase tracking-wide">Total Messages</span>
                    <span className="font-semibold text-gray-700">{s.message_count.toLocaleString()}</span>
                  </div>
                </div>

                {/* ── Pipeline progress panel ── */}
                {pipeline && (
                  <div className="mb-4 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Pipeline Setup
                    </p>
                    <div className="space-y-0">
                      {PIPELINE_STEPS.map((label, i) => (
                        <StepRow key={i} label={label} status={pipeline.steps[i]} />
                      ))}
                    </div>
                    {pipeline.done && pipeline.mqttTopic && (
                      <div className="mt-3 pt-2 border-t border-gray-100 space-y-1">
                        <p className="text-xs text-gray-500">
                          <span className="text-gray-400">MQTT  </span>
                          <span className="font-mono">{pipeline.mqttTopic}</span>
                        </p>
                        <p className="text-xs text-gray-500">
                          <span className="text-gray-400">Kafka </span>
                          <span className="font-mono">{pipeline.kafkaTopic}</span>
                        </p>
                        <p className="text-xs text-emerald-600 font-medium mt-1">
                          ✓ Data is flowing — open{" "}
                          <button
                            onClick={() => navigate(`/sensors/${s.sensor_id}`)}
                            className="underline hover:text-emerald-700"
                          >
                            Sensor Detail
                          </button>{" "}
                          to see the live terminal.
                        </p>
                      </div>
                    )}
                    {pipeline.error && (
                      <p className="mt-2 text-xs text-red-600 break-all">{pipeline.error}</p>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="border-t border-gray-50 pt-3 flex items-center justify-between">
                  <p className="text-xs text-gray-400">
                    {pipeline?.done
                      ? "Pipeline live — data streaming to Iceberg."
                      : s.status === "pending"
                      ? "Configure your device with the token above, then connect it to the network."
                      : s.status === "active"
                      ? "Sensor is connected and data is flowing."
                      : "Reconnect your device to resume data flow."}
                  </p>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    {/* Connect / Reconnect button */}
                    {(s.status === "pending" || s.status === "inactive" || s.status === "error") && !pipeline?.done && (
                      <button
                        disabled={!!isConnecting}
                        onClick={() => handleConnect(s)}
                        className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {isConnecting ? "Setting up…" :
                         s.status === "inactive" || s.status === "error" ? "Reconnect to Network" :
                         "Connect to Network"}
                      </button>
                    )}
                    {/* Bug 5: Disconnect stops pipeline and IoT simulator */}
                    {s.status === "active" && !pipeline && (
                      <button
                        disabled={isDisconn}
                        onClick={() => handleDisconnect(s)}
                        className="text-xs font-medium border border-red-200 text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {isDisconn ? "Disconnecting…" : "Disconnect"}
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
                <span>Per page</span>
                <select value={perPage}
                  onChange={(e) => { setPerPage(Number(e.target.value) as typeof perPage); setPage(1); }}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                  {PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
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
