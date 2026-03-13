import { useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import usePageTitle from "../../hooks/usePageTitle";
import { useGetSensorQuery } from "../../redux/apislices/userDashboardApiSlice";
import { STATUS_STYLES, sensorIcon } from "./sensorUtils";

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

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col h-full overflow-hidden">
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

// ── Terminal ──────────────────────────────────────────────────────────────────

const PLACEHOLDER_LINES = [
  "VerdantIQ Sensor Terminal v1.0",
  "──────────────────────────────────",
  "Data services integration pending.",
  "Real-time messages will stream here",
  "once the pipeline is connected.",
  "──────────────────────────────────",
  "Waiting for messages...",
];

function Terminal() {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView(); }, []);

  return (
    <div className="bg-gray-950 rounded-2xl border border-gray-800 overflow-hidden flex flex-col h-full">
      <div className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-900 border-b border-gray-800 shrink-0">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
        <span className="ml-3 text-xs text-gray-500 font-mono select-none">sensor-messages</span>
        <span className="ml-auto text-xs text-gray-600 font-mono">max 20 msgs</span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-0.5 font-mono text-xs leading-5
                      [&::-webkit-scrollbar]:w-1.5
                      [&::-webkit-scrollbar-track]:bg-gray-900
                      [&::-webkit-scrollbar-thumb]:bg-gray-700
                      [&::-webkit-scrollbar-thumb]:rounded-full">
        {PLACEHOLDER_LINES.map((line, i) => (
          <p key={i} className="text-gray-500">{line}</p>
        ))}
        <p className="text-emerald-400 animate-pulse">█</p>
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ── Nil value ─────────────────────────────────────────────────────────────────

const Nil = () => <span className="text-gray-300">—</span>;

// ── Main page ─────────────────────────────────────────────────────────────────

const SensorDetail = () => {
  const { sensorId } = useParams<{ sensorId: string }>();
  const navigate = useNavigate();

  const { data: sensor, isLoading, isError } = useGetSensorQuery(sensorId ?? "", {
    skip: !sensorId,
  });

  usePageTitle(sensor ? `${sensor.sensor_name} — VerdantIQ` : "Sensor — VerdantIQ");

  const meta = sensor?.sensor_metadata ?? {};

  const get = (key: string) => (meta[key] != null ? String(meta[key]) : null);

  const latitude    = get("latitude");
  const longitude   = get("longitude");
  const manufacturer = get("manufacturer");
  const model        = get("model");
  const serialNo     = get("serial_number");
  const os           = get("operating_system");
  const powerType    = get("power_type");
  const firmware     = get("firmware_version");
  const macAddr      = get("mac_address");
  const ipAddr       = get("ip_address");
  const battery      = get("battery_level");
  const memory       = get("memory");
  const network      = get("network");

  const lastSeen = sensor?.last_message_at
    ? new Date(sensor.last_message_at).toLocaleString()
    : "No data yet";

  const messageTopic = sensor
    ? `verdantiq.sensors.${sensor.tenant_id}.${sensor.sensor_id}`
    : "—";

  const dataStatus = sensor?.status === "active" ? "Online" : "Offline";

  const gps = latitude && longitude ? `${latitude}, ${longitude}` : null;

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
        <div className="space-y-4 max-w-5xl">
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

          {/* ── 6 cards in one grid so rows match height ── */}
          <div className="grid grid-cols-3 gap-4" style={{ gridAutoRows: "1fr" }}>

            {/* Card 1 — Sensor Info */}
            <Card title="Sensor Info">
              <DetailRow label="Sensor ID"    value={<span className="font-mono text-gray-500">{sensor.sensor_id.slice(0, 16)}…</span>} />
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

            {/* Card 2 — Connection */}
            <Card title="Connection">
              <DetailRow label="Device Token" value={<span className="font-mono text-gray-500">{sensor.mqtt_token.slice(0, 16)}…</span>} />
              <DetailRow label="Message Channel" value={<span className="font-mono text-gray-500 break-all" style={{fontSize:"10px"}}>{messageTopic}</span>} />
              <DetailRow label="Backup Channels" value={<span className="font-mono font-semibold text-gray-700">3</span>} />
              <DetailRow label="Protocol"     value="MQTT / Kafka" />
              <DetailRow label="Data Format"  value="Avro (Schema Registry)" />
              <DetailRow label="Network"      value={network ?? <Nil />} />
              <DetailRow label="Total Messages" value={sensor.message_count.toLocaleString()} />
              <DetailRow label="Status"       value={
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                  sensor.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                }`}>{dataStatus}</span>
              } />
            </Card>

            {/* Card 3 — Hardware */}
            <Card title="Hardware">
              <DetailRow label="Firmware"  value={firmware ?? <Nil />} />
              <DetailRow label="OS"        value={os ?? <Nil />} />
              <DetailRow label="MAC Address" value={macAddr ? <span className="font-mono text-gray-500">{macAddr}</span> : <Nil />} />
              <DetailRow label="IP Address"  value={ipAddr  ? <span className="font-mono text-gray-500">{ipAddr}</span>  : <Nil />} />
              <DetailRow label="Power"     value={powerType ? powerType.toUpperCase() : <Nil />} />
              {powerType === "dc" && (
                <DetailRow label="Battery" value={battery ? `${battery}%` : <Nil />} />
              )}
              <DetailRow label="Memory"    value={memory ?? <Nil />} />
              <DetailRow label="GPS"       value={gps ?? <Nil />} />
            </Card>

            {/* Card 4 — Terminal */}
            <Terminal />

            {/* Card 5 — Analytics placeholder */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col h-full">
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

            {/* Card 6 — Placeholder */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col h-full">
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
