import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import usePageTitle from "../../hooks/usePageTitle";
import {
  useGetSensorQuery,
  useUpdateSensorMutation,
  useUpdateSensorStatusMutation,
  useLogConnectionEventMutation,
  useGetBillingQuery,
} from "../../redux/apislices/userDashboardApiSlice";
import { STATUS_STYLES, sensorIcon } from "./sensorUtils";

const DATA_SERVICE_URL  = import.meta.env.VITE_DATA_SERVICE_URL ?? "http://localhost:8090";
const COST_PER_MESSAGE  = 0.00005;   // $0.00005 per message = $0.05 per 1 000 msgs
const ONE_HOUR_MS       = 3_600_000; // hardware pipeline refresh cadence
const MSG_POLL_MS       = 30_000;    // message count pipeline refresh cadence

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

// Fetch message count directly from Kafka watermarks via data service (no terminal needed)
async function fetchMessageCountFromPipeline(
  tenantId: string | number,
  sensorId: string,
): Promise<number | null> {
  try {
    const r = await fetch(
      `${DATA_SERVICE_URL}/sensors/${tenantId}/${sensorId}/message-count`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!r.ok) return null;
    const body = await r.json() as { message_count: number };
    return body.message_count ?? null;
  } catch { return null; }
}

// Fetch hardware_info directly from Kafka via data service (pipeline, no terminal needed)
async function fetchHardwareFromPipeline(
  tenantId: string | number,
  sensorId: string,
): Promise<HardwareInfo | null> {
  try {
    const r = await fetch(
      `${DATA_SERVICE_URL}/sensors/${tenantId}/${sensorId}/hardware`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!r.ok) return null;
    const body = await r.json() as { hardware_info: HardwareInfo };
    return body.hardware_info ?? null;
  } catch { return null; }
}

async function checkPipelineActive(tenantId: string | number, sensorId: string): Promise<boolean> {
  try {
    const r = await fetch(`${DATA_SERVICE_URL}/sensors/active`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!r.ok) return false;
    const body = await r.json() as { sensors: Array<{ key: string }> };
    return body.sensors.some(s => s.key === `${tenantId}.${sensorId}`);
  } catch { return false; }
}

// ── Shared row ────────────────────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 uppercase tracking-wide shrink-0 leading-4">{label}</span>
      <span className="text-xs text-gray-800 text-right break-all leading-4">{value}</span>
    </div>
  );
}

// ── Card wrapper ───────────────────────────────────────────────────────────────

function Card({ title, children, minHeight }: { title: string; children: React.ReactNode; minHeight?: number }) {
  return (
    <div
      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col overflow-hidden w-full h-full"
      style={minHeight ? { minHeight } : undefined}
    >
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 shrink-0">{title}</p>
      <div className="flex-1 overflow-y-auto space-y-0 pr-0.5
                      [&::-webkit-scrollbar]:w-1
                      [&::-webkit-scrollbar-track]:bg-transparent
                      [&::-webkit-scrollbar-thumb]:bg-gray-200
                      [&::-webkit-scrollbar-thumb]:rounded-full">
        {children}
      </div>
    </div>
  );
}

// ── Terminal types ────────────────────────────────────────────────────────────

type ConnectState = "idle" | "connecting" | "streaming" | "error";

interface TerminalLine {
  id:   number;
  type: "info" | "data" | "error" | "system";
  text: string;
  ts?:  string;
}

const MAX_LINES = 5;

interface HardwareInfo {
  firmware_version?:      string;
  mac_address?:           string;
  ip_address?:            string;
  battery_level_percent?: number;
  memory_free_mb?:        number;
  memory_total_mb?:       number;
}

// ── Terminal component ────────────────────────────────────────────────────────

function Terminal({
  height,
  lines,
  connectState,
  onConnect,
  onDisconnect,
}: {
  height?:      number;
  lines:        TerminalLine[];
  connectState: ConnectState;
  onConnect:    () => void;
  onDisconnect: () => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const statusDot =
    connectState === "streaming"  ? "bg-emerald-500" :
    connectState === "connecting" ? "bg-yellow-400 animate-pulse" :
    connectState === "error"      ? "bg-red-500" :
    "bg-gray-500";

  const statusLabel =
    connectState === "streaming"  ? "live" :
    connectState === "connecting" ? "connecting…" :
    connectState === "error"      ? "error" :
    "offline";

  return (
    <div
      className="bg-gray-950 rounded-2xl border border-gray-800 overflow-hidden flex flex-col"
      style={height ? { height } : undefined}
    >
      {/* Title bar */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-900 border-b border-gray-800 shrink-0">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
        <span className={`w-2.5 h-2.5 rounded-full ${statusDot}`} />
        <span className="ml-3 text-xs text-gray-500 font-mono select-none">sensor-messages</span>
        <span className={`ml-2 text-xs font-mono ${
          connectState === "streaming" ? "text-emerald-400" :
          connectState === "error"     ? "text-red-400" : "text-gray-600"
        }`}>{statusLabel}</span>
        <span className="ml-auto text-xs text-gray-600 font-mono">last {MAX_LINES} msgs</span>

        {connectState === "idle" || connectState === "error" ? (
          <button
            onClick={onConnect}
            className="ml-2 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
          >
            Connect
          </button>
        ) : connectState === "connecting" ? (
          <span className="ml-2 px-2 py-0.5 rounded text-xs font-semibold bg-gray-700 text-gray-400 cursor-not-allowed">
            …
          </span>
        ) : (
          <button
            onClick={onDisconnect}
            className="ml-2 px-2 py-0.5 rounded text-xs font-semibold bg-gray-700 hover:bg-red-700 text-gray-300 hover:text-white transition-colors"
          >
            Disconnect
          </button>
        )}
      </div>

      {/* Message area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-0.5 font-mono text-xs leading-5
                      [&::-webkit-scrollbar]:w-1.5
                      [&::-webkit-scrollbar-track]:bg-gray-900
                      [&::-webkit-scrollbar-thumb]:bg-gray-700
                      [&::-webkit-scrollbar-thumb]:rounded-full">
        {lines.length === 0 && (
          <>
            <p className="text-gray-500">VerdantIQ Sensor Terminal v2.0</p>
            <p className="text-gray-700">──────────────────────────────────</p>
            <p className="text-gray-500">Press <span className="text-emerald-400">Connect</span> to stream live data.</p>
            <p className="text-gray-700">──────────────────────────────────</p>
            <p className="text-emerald-400 animate-pulse">█</p>
          </>
        )}

        {lines.map((line) => (
          <p
            key={line.id}
            className={
              line.type === "data"   ? "text-emerald-300" :
              line.type === "error"  ? "text-red-400" :
              line.type === "system" ? "text-yellow-300" :
              "text-gray-400"
            }
          >
            {line.ts && <span className="text-gray-600 mr-1">[{line.ts}]</span>}
            {line.text}
          </p>
        ))}

        {connectState === "streaming" && (
          <p className="text-emerald-400 animate-pulse">█</p>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ── Nil value ─────────────────────────────────────────────────────────────────

const Nil = () => <span className="text-gray-300">—</span>;

// ── Main page ─────────────────────────────────────────────────────────────────

let _lineId = 0;
const nextId = () => ++_lineId;

// Persistent WebSocket registry — survives navigation
const _liveStreams = new Map<string, WebSocket>();

const SensorDetail = () => {
  const { sensorId } = useParams<{ sensorId: string }>();
  const navigate     = useNavigate();

  // Bug 1: poll every 30 s so message_count updates from pipeline without terminal
  const { data: sensor, isLoading, isError } = useGetSensorQuery(sensorId ?? "", {
    skip:            !sensorId,
    pollingInterval: 30_000,
  });

  const { data: billing } = useGetBillingQuery();

  usePageTitle(sensor ? `${sensor.sensor_name} — VerdantIQ` : "Sensor — VerdantIQ");

  // ── card height sync ────────────────────────────────────────────────────
  const refCardRef = useRef<HTMLDivElement>(null);
  const [cardHeight, setCardHeight] = useState<number | undefined>();

  useLayoutEffect(() => {
    if (!refCardRef.current) return;
    const ro = new ResizeObserver(() => {
      setCardHeight(refCardRef.current?.offsetHeight);
    });
    ro.observe(refCardRef.current);
    return () => ro.disconnect();
  }, [sensor]);

  const [updateSensor]      = useUpdateSensorMutation();
  const [updateStatus]      = useUpdateSensorStatusMutation();
  const [logConnectionEvent]= useLogConnectionEventMutation();

  // ── terminal / pipeline state ───────────────────────────────────────────
  const [connectState,      setConnectState]      = useState<ConnectState>("idle");
  const [lines,             setLines]             = useState<TerminalLine[]>([]);
  const [replicationFactor, setReplicationFactor] = useState<number | null>(null);
  const [pipelineActive,    setPipelineActive]    = useState(false);
  const [hwInfo,            setHwInfo]            = useState<HardwareInfo>({});
  const [liveMessageCount,  setLiveMessageCount]  = useState<number | null>(null);
  const wsRef          = useRef<WebSocket | null>(null);
  const hwPatchedRef   = useRef(false);

  const pushLine = useCallback((text: string, type: TerminalLine["type"] = "info", ts?: string) => {
    setLines((prev) => {
      const next: TerminalLine = { id: nextId(), type, text, ts };
      return prev.length >= MAX_LINES ? [...prev.slice(1), next] : [...prev, next];
    });
  }, []);

  // ── open WebSocket only (pipeline already running) ──────────────────────
  const openWebSocket = useCallback((quiet = false) => {
    if (!sensor) return;
    const key = `${sensor.tenant_id}.${sensor.sensor_id}`;

    const attachHandlers = (ws: WebSocket) => {
      // Terminal only — hardware updates come from pipeline poll, not WebSocket
      ws.onmessage = (evt) => {
        try {
          const envelope   = JSON.parse(evt.data as string);
          const pl         = envelope.payload ?? {};
          const ts         = new Date(envelope.ts).toISOString().slice(11, 19);
          const metricsKey = Object.keys(pl).find(k =>
            ["soil_metrics", "air_quality", "weather_data",
             "temperature_data", "pollution_metrics"].includes(k),
          );
          const metrics = metricsKey ? pl[metricsKey] : pl;
          pushLine(`offset:${envelope.offset} ${JSON.stringify(metrics)}`, "data", ts);
        } catch {
          pushLine(evt.data as string, "data");
        }
      };

      ws.onerror = () => {
        setConnectState("error");
        pushLine("WebSocket error — check data service", "error");
      };

      ws.onclose = (ev) => {
        _liveStreams.delete(key);
        wsRef.current = null;
        setConnectState("idle");
        pushLine(`Stream closed (code ${ev.code})`, "system");
      };
    };

    const existing = _liveStreams.get(key);
    if (existing && existing.readyState === WebSocket.OPEN) {
      wsRef.current = existing;
      setConnectState("streaming");
      if (!quiet) pushLine("Reconnected to stream ✓", "system");
      attachHandlers(existing);
      return;
    }

    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }

    setConnectState("connecting");
    const wsUrl = `${DATA_SERVICE_URL.replace(/^http/, "ws")}/ws/${sensor.tenant_id}/${sensor.sensor_id}`;
    const ws    = new WebSocket(wsUrl);
    wsRef.current = ws;
    _liveStreams.set(key, ws);

    ws.onopen = () => {
      setConnectState("streaming");
      if (!quiet) pushLine("Stream connected ✓", "system");
      // Bug 4: log terminal connection as event in trail
      logConnectionEvent({
        sensor_id:  sensor.sensor_id,
        event_type: "terminal_connected",
        status:     "success",
        message:    "Live terminal stream opened",
      });
    };
    attachHandlers(ws);
  }, [sensor, pushLine, logConnectionEvent]);

  const handleConnect = useCallback(async () => {
    if (!sensor) return;
    setLines([]);

    const alreadyActive = await checkPipelineActive(sensor.tenant_id, sensor.sensor_id);
    if (alreadyActive) {
      pushLine("Pipeline already active — connecting to stream…", "system");
      openWebSocket();
      return;
    }

    setConnectState("connecting");
    pushLine("Initiating IoT pipeline…", "system");

    const payload = {
      sensor_id:   sensor.sensor_id,
      tenant_id:   sensor.tenant_id,
      sensor_type: sensor.sensor_type,
      device_id:   sensor.sensor_id,
      location: {
        latitude:  parseFloat((sensor.sensor_metadata?.latitude  as string) ?? "0") || 0,
        longitude: parseFloat((sensor.sensor_metadata?.longitude as string) ?? "0") || 0,
      },
    };

    try {
      const resp = await fetch(`${DATA_SERVICE_URL}/sensors/connect`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });

      let result: Record<string, unknown> = {};
      try { result = await resp.json(); } catch { /* ignore */ }

      const steps = (result.steps ?? {}) as Record<string, { status: string; message: string }>;
      const stepLabels: Record<string, string> = {
        kafka_topic_created: "Kafka topic",
        mqtt_topic_created:  "MQTT topic ",
        simulator_started:   "Simulator  ",
      };
      Object.entries(stepLabels).forEach(([key, label]) => {
        const s = steps[key];
        if (!s) return;
        const icon = s.status === "success" ? "✓" : s.status === "skipped" ? "—" : "✗";
        pushLine(`${icon} ${label}: ${s.message}`,
          s.status === "success" ? "system" : s.status === "skipped" ? "info" : "error");
      });

      if (!resp.ok) {
        const detail = result.detail ? String(result.detail) : `HTTP ${resp.status}`;
        setConnectState("error");
        pushLine(`Pipeline failed: ${detail}`, "error");
        return;
      }

      // Bug 3: save network type from pipeline into sensor_metadata
      updateSensor({
        sensor_id:       sensor.sensor_id,
        sensor_metadata: {
          protocol:    String(result.protocol    ?? "mqtt"),
          data_format: String(result.data_format ?? "json"),
          network:     String(result.network     ?? "WiFi"),
        },
      });

      pushLine("Pipeline ready — opening stream…", "system");
      openWebSocket();

    } catch (err) {
      setConnectState("error");
      pushLine(`Error: ${err instanceof Error ? err.message : String(err)}`, "error");
    }
  }, [sensor, pushLine, openWebSocket, updateSensor]);

  // Bug 4: disconnect closes WebSocket view and logs the event
  const handleDisconnect = useCallback(() => {
    if (!sensor) return;
    const key = `${sensor.tenant_id}.${sensor.sensor_id}`;
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    _liveStreams.delete(key);
    setConnectState("idle");
    pushLine("Stream view closed — pipeline is still running", "system");
    // Bug 4: log terminal disconnect as trail event
    logConnectionEvent({
      sensor_id:  sensor.sensor_id,
      event_type: "terminal_disconnected",
      status:     "success",
      message:    "Live terminal stream closed (pipeline still active)",
    });
  }, [sensor, pushLine, logConnectionEvent]);

  // On unmount: detach wsRef but leave WS running
  useEffect(() => { return () => { wsRef.current = null; }; }, []);

  // On mount: if a stream is already open for this sensor, reattach silently
  const openWebSocketRef = useRef(openWebSocket);
  useEffect(() => { openWebSocketRef.current = openWebSocket; }, [openWebSocket]);
  useEffect(() => {
    if (!sensor) return;
    const key = `${sensor.tenant_id}.${sensor.sensor_id}`;
    const existing = _liveStreams.get(key);
    if (existing && existing.readyState === WebSocket.OPEN) {
      openWebSocketRef.current(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sensor?.sensor_id]);

  // Poll data service every 5 s for Pipeline badge
  useEffect(() => {
    if (!sensor) return;
    const check = () =>
      checkPipelineActive(sensor.tenant_id, sensor.sensor_id).then(setPipelineActive);
    check();
    const id = setInterval(check, 5000);
    return () => clearInterval(id);
  }, [sensor]);

  // Fetch Kafka replication factor once per sensor
  useEffect(() => {
    if (!sensor) return;
    const topic = `verdantiq.${sensor.tenant_id}.${sensor.sensor_id}`;
    fetchReplicationFactor(topic).then(rf => { if (rf !== null) setReplicationFactor(rf); });
  }, [sensor]);

  // Hardware polling from pipeline — runs every hour, independent of terminal
  // Battery and memory come from Kafka data, not WebSocket
  useEffect(() => {
    if (!sensor) return;

    const applyHardware = (hw: HardwareInfo) => {
      setHwInfo(hw);
      // Patch backend so values persist across page refreshes (once per session)
      if (!hwPatchedRef.current) {
        hwPatchedRef.current = true;
        updateSensor({
          sensor_id:       sensor.sensor_id,
          sensor_metadata: {
            firmware_version: hw.firmware_version,
            mac_address:      hw.mac_address,
            ip_address:       hw.ip_address,
            battery_level:    hw.battery_level_percent != null
                                ? String(hw.battery_level_percent)
                                : undefined,
            memory:           hw.memory_total_mb != null
                                ? `${hw.memory_free_mb ?? "?"}/${hw.memory_total_mb} MB`
                                : undefined,
          },
        });
      }
    };

    // Fetch immediately on mount
    fetchHardwareFromPipeline(sensor.tenant_id, sensor.sensor_id)
      .then(hw => { if (hw) applyHardware(hw); });

    // Then refresh every hour
    const id = setInterval(() => {
      fetchHardwareFromPipeline(sensor.tenant_id, sensor.sensor_id)
        .then(hw => { if (hw) applyHardware(hw); });
    }, ONE_HOUR_MS);

    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sensor?.sensor_id]);

  // Message count polling from pipeline — runs every 30 s, independent of terminal
  useEffect(() => {
    if (!sensor) return;
    const poll = () =>
      fetchMessageCountFromPipeline(sensor.tenant_id, sensor.sensor_id)
        .then(c => { if (c !== null) setLiveMessageCount(c); });
    poll();
    const id = setInterval(poll, MSG_POLL_MS);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sensor?.sensor_id]);

  // Feature 1: auto-deactivate if running cost exceeds sensor budget
  useEffect(() => {
    if (!sensor) return;
    const budget = sensor.sensor_metadata?.budget;
    if (!budget) return;
    const budgetNum    = parseFloat(String(budget));
    const count        = liveMessageCount ?? sensor.message_count;
    const runningCost  = count * COST_PER_MESSAGE;
    if (!isNaN(budgetNum) && budgetNum > 0 && runningCost >= budgetNum && sensor.status === "active") {
      updateStatus({ sensor_id: sensor.sensor_id, status: "inactive" });
      fetch(`${DATA_SERVICE_URL}/sensors/${sensor.tenant_id}/${sensor.sensor_id}/disconnect`, {
        method: "DELETE",
      }).catch(() => {});
      logConnectionEvent({
        sensor_id:  sensor.sensor_id,
        event_type: "budget_exceeded",
        status:     "success",
        message:    `Budget limit of $${budgetNum.toFixed(2)} reached — sensor auto-deactivated`,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sensor?.message_count, liveMessageCount]);

  const meta = sensor?.sensor_metadata ?? {};
  const get  = (key: string) => (meta[key] != null ? String(meta[key]) : null);

  const latitude     = get("latitude");
  const longitude    = get("longitude");
  const manufacturer = get("manufacturer");
  const model        = get("model");
  const serialNo     = get("serial_number");
  const os           = get("operating_system");
  const powerType    = get("power_type");

  // Hardware comes from pipeline poll (fetchHardwareFromPipeline), falls back to sensor_metadata
  const firmware = hwInfo.firmware_version      ?? get("firmware_version");
  const macAddr  = hwInfo.mac_address           ?? get("mac_address");
  const ipAddr   = hwInfo.ip_address            ?? get("ip_address");
  const battery  = hwInfo.battery_level_percent != null
                     ? String(hwInfo.battery_level_percent)
                     : get("battery_level");
  const memory   = hwInfo.memory_total_mb != null
                     ? `${hwInfo.memory_free_mb ?? "?"}/${hwInfo.memory_total_mb} MB`
                     : get("memory");
  // Bug 3: read network from sensor_metadata (populated on pipeline connect)
  const network  = get("network");

  const protocol   = get("protocol");
  const dataFormat = get("data_format");

  const lastSeen   = sensor?.last_message_at
    ? new Date(sensor.last_message_at).toLocaleString()
    : "No data yet";

  const messageTopic = sensor
    ? `verdantiq.sensors.${sensor.tenant_id}.${sensor.sensor_id}`
    : "—";

  const dataStatus = sensor?.status === "active" ? "Online" : "Offline";
  const gps        = latitude && longitude ? `${latitude}, ${longitude}` : null;

  const pipelineLabel =
    connectState === "streaming"  ? "Streaming"   :
    connectState === "connecting" ? "Connecting…" :
    connectState === "error"      ? "Error"       :
    pipelineActive                ? "Connected"   : "Offline";

  const pipelineBadgeCls =
    connectState === "streaming"  ? "bg-emerald-100 text-emerald-700" :
    connectState === "connecting" ? "bg-yellow-100  text-yellow-700"  :
    connectState === "error"      ? "bg-red-100     text-red-700"     :
    pipelineActive                ? "bg-blue-100    text-blue-700"    :
    "bg-gray-100 text-gray-500";

  // Feature 1: billing card values — prefer live Kafka count over stale DB value
  const messageCount  = liveMessageCount ?? sensor?.message_count ?? 0;
  const runningCost   = messageCount * COST_PER_MESSAGE;
  const lastMonthCost = get("last_month_cost");
  const budgetRaw     = get("budget");
  const budgetNum     = budgetRaw ? parseFloat(budgetRaw) : null;
  const budgetPct     = budgetNum && budgetNum > 0 ? (runningCost / budgetNum) * 100 : null;
  const budgetWarning = budgetPct !== null && budgetPct >= 80;
  const budgetCritical= budgetPct !== null && budgetPct >= 100;

  const matchStyle = cardHeight ? { minHeight: cardHeight } : undefined;
  const fixedStyle = cardHeight ? { height: cardHeight }    : undefined;

  return (
    <div className="px-6 py-8">
      <button
        onClick={() => navigate("/sensors/list")}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-emerald-600 transition-colors mb-6"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to sensors
      </button>

      {isLoading ? (
        <div className="text-sm text-gray-400 py-16 text-center">Loading sensor…</div>
      ) : isError || !sensor ? (
        <div className="text-sm text-gray-400 py-16 text-center">
          Sensor not found or you don't have access.
        </div>
      ) : (
        <div className="space-y-4 max-w-[1340px]">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <span className="text-3xl leading-none">{sensorIcon(sensor.sensor_type)}</span>
              <div>
                <h1 className="text-lg font-semibold text-gray-800">{sensor.sensor_name}</h1>
                <p className="text-sm text-gray-400 capitalize">{sensor.sensor_type}</p>
              </div>
            </div>
            <span className={`text-xs font-semibold px-3 py-1 rounded-full capitalize ${
              STATUS_STYLES[sensor.status] ?? "bg-gray-100 text-gray-500"
            }`}>
              {sensor.status}
            </span>
          </div>

          {/* ── Upper row: 3 content cards ── */}
          <div className="grid grid-cols-3 gap-4">

            {/* Card 1 — Sensor Info */}
            <div style={matchStyle}>
            <Card title="Sensor Info">
              <DetailRow label="Sensor ID"    value={<span className="font-mono text-gray-500 break-all">{sensor.sensor_id}</span>} />
              <DetailRow label="Name"         value={sensor.sensor_name} />
              <DetailRow label="Manufacturer" value={manufacturer ?? <Nil />} />
              <DetailRow label="Model"        value={model ?? <Nil />} />
              <DetailRow label="Location"     value={sensor.location ?? <Nil />} />
              <DetailRow label="Last Seen"    value={lastSeen} />
              <DetailRow label="Registered"   value={new Date(sensor.created_at).toLocaleDateString(undefined, {
                year: "numeric", month: "short", day: "numeric",
              })} />
              <DetailRow label="Serial No."   value={serialNo ?? <Nil />} />
            </Card>
            </div>

            {/* Card 2 — Connection (reference card for height) */}
            <div ref={refCardRef}>
            <Card title="Connection">
              <DetailRow label="Device Token" value={<span className="font-mono text-gray-500 break-all">{sensor.mqtt_token}</span>} />
              <DetailRow label="Message Channel" value={<span className="font-mono text-gray-500 break-all" style={{fontSize:"10px"}}>{messageTopic}</span>} />
              <DetailRow label="Backup Channels" value={
                <span className="font-mono font-semibold text-gray-700">
                  {replicationFactor !== null ? replicationFactor : "—"}
                </span>
              } />
              <DetailRow label="Protocol"    value={protocol   ? protocol.toUpperCase()   : <Nil />} />
              <DetailRow label="Data Format" value={dataFormat ? dataFormat.toUpperCase() : <Nil />} />
              {/* Bug 3: network populated from pipeline metadata */}
              <DetailRow label="Network"     value={network ?? <Nil />} />
              <DetailRow label="Status"      value={
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                  sensor.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                }`}>{dataStatus}</span>
              } />
              <div className="pt-3 border-t border-gray-50 mt-1">
                <DetailRow label="Pipeline" value={
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${pipelineBadgeCls}`}>
                    {pipelineLabel}
                  </span>
                } />
              </div>
            </Card>
            </div>

            {/* Card 3 — Hardware */}
            <Card title="Hardware" minHeight={cardHeight}>
              <DetailRow label="Firmware"    value={firmware ?? <Nil />} />
              <DetailRow label="OS"          value={os ?? <Nil />} />
              <DetailRow label="MAC Address" value={macAddr ? <span className="font-mono text-gray-500">{macAddr}</span> : <Nil />} />
              <DetailRow label="IP Address"  value={ipAddr  ? <span className="font-mono text-gray-500">{ipAddr}</span>  : <Nil />} />
              <DetailRow label="Power"       value={powerType ? powerType.toUpperCase() : <Nil />} />
              {/* Battery and memory from pipeline poll every 1 hour, not WebSocket */}
              <DetailRow label="Battery"     value={battery ? `${battery}%` : <Nil />} />
              <DetailRow label="Memory"      value={memory ?? <Nil />} />
              <DetailRow label="GPS"         value={gps ?? <Nil />} />
            </Card>
          </div>

          {/* ── Lower row ── */}
          <div className="grid grid-cols-3 gap-4">

            {/* Card 4 — Terminal (live WebSocket stream — view only) */}
            <Terminal
              height={cardHeight}
              lines={lines}
              connectState={connectState}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
            />

            {/* Card 5 — Analytics placeholder */}
            <div
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col"
              style={fixedStyle}
            >
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 shrink-0">Analytics</p>
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-2">
                    <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <p className="text-xs text-gray-400">Charts coming soon</p>
                  <p className="text-xs text-gray-300 mt-0.5">Trino + Iceberg integration</p>
                </div>
              </div>
            </div>

            {/* Card 6 — Billing (Feature 1: replaces Map placeholder) */}
            <div
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col"
              style={fixedStyle}
            >
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 shrink-0">Billing</p>
              <div className="flex-1 overflow-y-auto space-y-0">
                <DetailRow
                  label="Total Messages"
                  value={<span className="font-semibold text-gray-700">{messageCount.toLocaleString()}</span>}
                />
                <DetailRow
                  label="Running Cost"
                  value={
                    <span className={`font-semibold ${budgetCritical ? "text-red-600" : budgetWarning ? "text-orange-500" : "text-gray-700"}`}>
                      ${runningCost.toFixed(5)}
                    </span>
                  }
                />
                <DetailRow
                  label="Last Month"
                  value={
                    lastMonthCost
                      ? <span className="font-semibold text-gray-700">${parseFloat(lastMonthCost).toFixed(2)}</span>
                      : <Nil />
                  }
                />
                <DetailRow
                  label="Budget"
                  value={
                    budgetNum !== null
                      ? <span className={`font-semibold ${budgetCritical ? "text-red-600" : "text-gray-700"}`}>
                          ${budgetNum.toFixed(2)}
                        </span>
                      : <span className="text-gray-300 text-xs">Not set</span>
                  }
                />

                {/* Budget progress bar */}
                {budgetNum !== null && budgetNum > 0 && (
                  <div className="pt-2 mt-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400">Budget used</span>
                      <span className={`font-semibold ${budgetCritical ? "text-red-600" : budgetWarning ? "text-orange-500" : "text-emerald-600"}`}>
                        {Math.min(budgetPct!, 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all ${budgetCritical ? "bg-red-500" : budgetWarning ? "bg-orange-400" : "bg-emerald-500"}`}
                        style={{ width: `${Math.min(budgetPct!, 100)}%` }}
                      />
                    </div>
                    {budgetCritical && (
                      <p className="mt-2 text-xs text-red-600 font-medium">
                        Budget exceeded — sensor auto-deactivated
                      </p>
                    )}
                    {budgetWarning && !budgetCritical && (
                      <p className="mt-2 text-xs text-orange-500">
                        Approaching budget limit
                      </p>
                    )}
                  </div>
                )}

                {/* Rate info */}
                <div className="pt-2 mt-1 border-t border-gray-50">
                  <p className="text-xs text-gray-300">
                    Rate: ${COST_PER_MESSAGE.toFixed(5)}/msg
                    {billing?.balance !== undefined && (
                      <> · Balance: ${billing.balance.toFixed(2)}</>
                    )}
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default SensorDetail;
