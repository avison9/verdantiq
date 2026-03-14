import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import usePageTitle from "../../hooks/usePageTitle";
import {
  useGetSensorQuery,
  useUpdateSensorMutation,
} from "../../redux/apislices/userDashboardApiSlice";
import { STATUS_STYLES, sensorIcon } from "./sensorUtils";

// Data service URL — override with VITE_DATA_SERVICE_URL in .env
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
  } catch {
    return null;
  }
}

async function checkPipelineActive(tenantId: string | number, sensorId: string): Promise<boolean> {
  try {
    const r = await fetch(`${DATA_SERVICE_URL}/sensors/active`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!r.ok) return false;
    const body = await r.json() as { sensors: Array<{ key: string }> };
    return body.sensors.some(s => s.key === `${tenantId}.${sensorId}`);
  } catch {
    return false;
  }
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
  id:      number;
  type:    "info" | "data" | "error" | "system";
  text:    string;
  ts?:     string;
}

const MAX_LINES = 20;

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
  minHeight,
  lines,
  connectState,
  onConnect,
  onDisconnect,
}: {
  minHeight?:    number;
  lines:         TerminalLine[];
  connectState:  ConnectState;
  onConnect:     () => void;
  onDisconnect:  () => void;
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
      style={minHeight ? { minHeight } : undefined}
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
        <span className="ml-auto text-xs text-gray-600 font-mono">max {MAX_LINES} msgs</span>

        {/* Connect / Disconnect button */}
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

const SensorDetail = () => {
  const { sensorId } = useParams<{ sensorId: string }>();
  const navigate = useNavigate();

  const { data: sensor, isLoading, isError } = useGetSensorQuery(sensorId ?? "", {
    skip: !sensorId,
  });

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

  const [updateSensor] = useUpdateSensorMutation();

  // ── terminal / pipeline state ───────────────────────────────────────────
  const [connectState,      setConnectState]      = useState<ConnectState>("idle");
  const [lines,             setLines]             = useState<TerminalLine[]>([]);
  const [replicationFactor, setReplicationFactor] = useState<number | null>(null);
  const [pipelineActive,    setPipelineActive]    = useState(false);
  const [hwInfo,            setHwInfo]            = useState<HardwareInfo>({});
  const wsRef        = useRef<WebSocket | null>(null);
  const hwPatchedRef = useRef(false);

  const pushLine = useCallback((text: string, type: TerminalLine["type"] = "info", ts?: string) => {
    setLines((prev) => {
      const next: TerminalLine = { id: nextId(), type, text, ts };
      return prev.length >= MAX_LINES ? [...prev.slice(1), next] : [...prev, next];
    });
  }, []);

  // ── open WebSocket only (pipeline already running) ──────────────────────
  const openWebSocket = useCallback((quiet = false) => {
    if (!sensor) return;
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }

    setConnectState("connecting");
    const wsUrl = `${DATA_SERVICE_URL.replace(/^http/, "ws")}/ws/${sensor.tenant_id}/${sensor.sensor_id}`;
    const ws    = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectState("streaming");
      if (!quiet) pushLine("Stream connected ✓", "system");
    };

    ws.onmessage = (evt) => {
      try {
        const envelope  = JSON.parse(evt.data as string);
        const pl        = envelope.payload ?? {};
        const ts        = new Date(envelope.ts).toISOString().slice(11, 19);
        const metricsKey = Object.keys(pl).find(k =>
          ["soil_metrics", "air_quality", "weather_data",
           "temperature_data", "pollution_metrics"].includes(k),
        );
        const metrics = metricsKey ? pl[metricsKey] : pl;
        pushLine(`offset:${envelope.offset} ${JSON.stringify(metrics)}`, "data", ts);

        // Extract hardware_info and populate Hardware card
        if (pl.hardware_info) {
          const hw = pl.hardware_info as HardwareInfo;
          setHwInfo(hw);
          // Patch backend once so values persist across page refreshes
          if (!hwPatchedRef.current && sensor) {
            hwPatchedRef.current = true;
            updateSensor({
              sensor_id: sensor.sensor_id,
              sensor_metadata: {
                firmware_version:      hw.firmware_version,
                mac_address:           hw.mac_address,
                ip_address:            hw.ip_address,
                battery_level:         hw.battery_level_percent != null
                                         ? String(hw.battery_level_percent)
                                         : undefined,
                memory:                hw.memory_total_mb != null
                                         ? `${hw.memory_free_mb ?? "?"}/${hw.memory_total_mb} MB`
                                         : undefined,
              },
            });
          }
        }
      } catch {
        pushLine(evt.data as string, "data");
      }
    };

    ws.onerror = () => {
      setConnectState("error");
      pushLine("WebSocket error — check data service", "error");
    };

    ws.onclose = (ev) => {
      setConnectState("idle");
      pushLine(`Stream closed (code ${ev.code})`, "system");
    };
  }, [sensor, pushLine]);

  const handleConnect = useCallback(async () => {
    if (!sensor) return;
    setLines([]);

    // If pipeline is already active in data service, skip POST and just open WebSocket
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

      // Body always contains per-step results regardless of HTTP status
      let result: Record<string, unknown> = {};
      try { result = await resp.json(); } catch { /* ignore */ }

      // Print each step result to terminal
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

      pushLine("Pipeline ready — opening stream…", "system");
      openWebSocket();

    } catch (err) {
      setConnectState("error");
      pushLine(`Error: ${err instanceof Error ? err.message : String(err)}`, "error");
    }
  }, [sensor, pushLine, openWebSocket]);

  const handleDisconnect = useCallback(async () => {
    wsRef.current?.close();
    wsRef.current = null;

    if (sensor) {
      try {
        await fetch(
          `${DATA_SERVICE_URL}/sensors/${sensor.tenant_id}/${sensor.sensor_id}/disconnect`,
          { method: "DELETE" },
        );
      } catch {
        // best-effort
      }
    }

    setConnectState("idle");
    pushLine("Disconnected from pipeline", "system");
  }, [sensor, pushLine]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  // Poll data service every 5 s to keep Pipeline badge accurate
  useEffect(() => {
    if (!sensor) return;
    const check = () =>
      checkPipelineActive(sensor.tenant_id, sensor.sensor_id)
        .then(setPipelineActive);
    check();
    const id = setInterval(check, 5000);
    return () => clearInterval(id);
  }, [sensor]);

  // Fetch Kafka replication factor for "Backup Channels" (once per sensor)
  useEffect(() => {
    if (!sensor) return;
    const topic = `verdantiq.${sensor.tenant_id}.${sensor.sensor_id}`;
    fetchReplicationFactor(topic).then(rf => {
      if (rf !== null) setReplicationFactor(rf);
    });
  }, [sensor]);

  const meta = sensor?.sensor_metadata ?? {};
  const get  = (key: string) => (meta[key] != null ? String(meta[key]) : null);

  const latitude     = get("latitude");
  const longitude    = get("longitude");
  const manufacturer = get("manufacturer");
  const model        = get("model");
  const serialNo     = get("serial_number");
  const os           = get("operating_system");
  const powerType    = get("power_type");
  // Hardware — prefer live values from WS stream, fall back to saved sensor_metadata
  const firmware = hwInfo.firmware_version      ?? get("firmware_version");
  const macAddr  = hwInfo.mac_address           ?? get("mac_address");
  const ipAddr   = hwInfo.ip_address            ?? get("ip_address");
  const battery  = hwInfo.battery_level_percent != null
                     ? String(hwInfo.battery_level_percent)
                     : get("battery_level");
  const memory   = hwInfo.memory_total_mb != null
                     ? `${hwInfo.memory_free_mb ?? "?"}/${hwInfo.memory_total_mb} MB`
                     : get("memory");
  const network  = get("network");

  // Connection metadata — stored in sensor_metadata after first connect
  const protocol   = get("protocol");
  const dataFormat = get("data_format");

  const lastSeen = sensor?.last_message_at
    ? new Date(sensor.last_message_at).toLocaleString()
    : "No data yet";

  const messageTopic = sensor
    ? `verdantiq.sensors.${sensor.tenant_id}.${sensor.sensor_id}`
    : "—";

  const dataStatus = sensor?.status === "active" ? "Online" : "Offline";
  const gps        = latitude && longitude ? `${latitude}, ${longitude}` : null;

  // Pipeline badge — reflects data service state independently of WebSocket
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

  const matchStyle = cardHeight ? { minHeight: cardHeight } : undefined;

  return (
    <div className="px-6 py-8">
      {/* Back */}
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

            {/* Card 2 — Connection (reference — tallest due to full UUID + long message channel) */}
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
              <DetailRow label="Network"      value={network ?? <Nil />} />
              <DetailRow label="Total Messages" value={sensor.message_count.toLocaleString()} />
              <DetailRow label="Status"       value={
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                  sensor.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                }`}>{dataStatus}</span>
              } />
              {/* ── Pipeline status ── */}
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
              <DetailRow label="Power"   value={powerType ? powerType.toUpperCase() : <Nil />} />
              <DetailRow label="Battery" value={battery ? `${battery}%` : <Nil />} />
              <DetailRow label="Memory"  value={memory ?? <Nil />} />
              <DetailRow label="GPS"         value={gps ?? <Nil />} />
            </Card>
          </div>

          {/* ── Lower row ── */}
          <div className="grid grid-cols-3 gap-4">

            {/* Card 4 — Terminal (live WebSocket stream) */}
            <Terminal
              minHeight={cardHeight}
              lines={lines}
              connectState={connectState}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
            />

            {/* Card 5 — Analytics placeholder */}
            <div
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col"
              style={matchStyle}
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

            {/* Card 6 — Map placeholder */}
            <div
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col"
              style={matchStyle}
            >
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 shrink-0">Map View</p>
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-2">
                    <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                  </div>
                  <p className="text-xs text-gray-400">Map view coming soon</p>
                  <p className="text-xs text-gray-300 mt-0.5">Geographic sensor tracking</p>
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
