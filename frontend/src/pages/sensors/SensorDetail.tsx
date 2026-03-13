import { useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import usePageTitle from "../../hooks/usePageTitle";
import { useGetSensorQuery } from "../../redux/apislices/userDashboardApiSlice";
import { STATUS_STYLES } from "./SensorList";

const SENSOR_TYPE_ICONS: Record<string, string> = {
  temperature: "🌡️",
  humidity:    "💧",
  soil:        "🌱",
  weather:     "🌤️",
  pressure:    "🔵",
  light:       "☀️",
  co2:         "🌫️",
  flow:        "💦",
  default:     "📡",
};

function sensorIcon(type: string) {
  return SENSOR_TYPE_ICONS[type.toLowerCase()] ?? SENSOR_TYPE_ICONS.default;
}

// ── Shared row component ──────────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 uppercase tracking-wide shrink-0">{label}</span>
      <span className="text-sm text-gray-800 text-right break-all">{value}</span>
    </div>
  );
}

// ── Terminal ──────────────────────────────────────────────────────────────────

const PLACEHOLDER_LINES = [
  "VerdantIQ Sensor Terminal v1.0",
  "──────────────────────────────────────────",
  "Kafka integration pending.",
  "Real-time messages will stream here once",
  "the Kafka pipeline is connected.",
  "──────────────────────────────────────────",
  "Waiting for messages...",
];

function Terminal() {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView(); }, []);

  return (
    <div className="bg-gray-950 rounded-xl border border-gray-800 overflow-hidden flex flex-col h-full">
      {/* Title bar */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-900 border-b border-gray-800 shrink-0">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
        <span className="ml-3 text-xs text-gray-500 font-mono select-none">sensor-messages</span>
        <span className="ml-auto text-xs text-gray-600 font-mono">max 20 msgs</span>
      </div>
      {/* Log body */}
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

// ── Main page ─────────────────────────────────────────────────────────────────

const SensorDetail = () => {
  const { sensorId } = useParams<{ sensorId: string }>();
  const navigate = useNavigate();

  const { data: sensor, isLoading, isError } = useGetSensorQuery(sensorId ?? "", {
    skip: !sensorId,
  });

  usePageTitle(sensor ? `${sensor.sensor_name} — VerdantIQ` : "Sensor — VerdantIQ");

  const meta = sensor?.sensor_metadata ?? {};
  const latitude  = meta.latitude  != null ? String(meta.latitude)  : null;
  const longitude = meta.longitude != null ? String(meta.longitude) : null;

  const lastSync = sensor?.last_message_at
    ? new Date(sensor.last_message_at).toLocaleString()
    : "No messages yet";

  // Derived connection values
  const kafkaTopic    = sensor ? `verdantiq.sensors.${sensor.sensor_type}` : "—";
  const backupChannels = 3; // cluster-level replication factor

  return (
    <div className="px-6 py-8">
      {/* Back button */}
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

          {/* ── Row 1: Details card + Connection card ── */}
          <div className="grid grid-cols-2 gap-4">
            {/* Details */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Sensor Info
              </p>
              <DetailRow label="Location"      value={sensor.location ?? <span className="text-gray-300">—</span>} />
              <DetailRow label="Latitude"      value={latitude  ?? <span className="text-gray-300">—</span>} />
              <DetailRow label="Longitude"     value={longitude ?? <span className="text-gray-300">—</span>} />
              <DetailRow label="Last sync"     value={lastSync} />
              <DetailRow label="Total messages" value={sensor.message_count.toLocaleString()} />
              <DetailRow label="Registered"    value={new Date(sensor.created_at).toLocaleDateString(undefined, {
                year: "numeric", month: "short", day: "numeric",
              })} />
              <DetailRow label="Sensor ID"     value={
                <span className="font-mono text-xs text-gray-500">{sensor.sensor_id}</span>
              } />
            </div>

            {/* Connection info */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Connection
              </p>
              <DetailRow label="MQTT Device ID" value={
                <span className="font-mono text-xs text-gray-500 break-all">{sensor.mqtt_token}</span>
              } />
              <DetailRow label="Channel" value={
                <span className="font-mono text-xs text-gray-500">{kafkaTopic}</span>
              } />
              <DetailRow label="Msg Backup Channels" value={
                <span className="font-mono text-xs text-gray-700 font-semibold">{backupChannels}</span>
              } />
              <DetailRow label="Protocol" value="MQTT / Kafka" />
              <DetailRow label="Data format" value="Avro (Schema Registry)" />
              <DetailRow label="Broker status" value={
                <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                  Pending integration
                </span>
              } />
            </div>
          </div>

          {/* ── Row 2: Terminal + Placeholder ── */}
          <div className="grid grid-cols-2 gap-4" style={{ height: "260px" }}>
            {/* Terminal */}
            <Terminal />

            {/* Bottom-right placeholder */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4 flex flex-col">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Analytics
              </p>
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
          </div>
        </div>
      )}
    </div>
  );
};

export default SensorDetail;
