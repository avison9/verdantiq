import { useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import usePageTitle from "../../hooks/usePageTitle";
import { useGetSensorQuery } from "../../redux/apislices/userDashboardApiSlice";

const STATUS_STYLES: Record<string, string> = {
  active:      "bg-emerald-100 text-emerald-700",
  inactive:    "bg-gray-100 text-gray-500",
  error:       "bg-red-100 text-red-600",
  maintenance: "bg-yellow-100 text-yellow-700",
};

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

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 uppercase tracking-wide shrink-0 w-36">{label}</span>
      <span className="text-sm text-gray-800 text-right">{value}</span>
    </div>
  );
}

// ── Terminal / message log ────────────────────────────────────────────────────

const PLACEHOLDER_LINES = [
  "VerdantIQ Sensor Terminal v1.0",
  "──────────────────────────────────────────────",
  "Kafka integration pending.",
  "Real-time messages will stream here once",
  "the Kafka pipeline is connected.",
  "──────────────────────────────────────────────",
  "Waiting for messages...",
  "_",
];

function Terminal() {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <div className="bg-gray-950 rounded-xl border border-gray-800 overflow-hidden">
      {/* Terminal title bar */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-900 border-b border-gray-800">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
        <span className="ml-3 text-xs text-gray-500 font-mono select-none">sensor-messages</span>
      </div>

      {/* Log body */}
      <div className="h-56 overflow-y-auto px-4 py-3 space-y-0.5 font-mono text-xs leading-5
                      [&::-webkit-scrollbar]:w-1.5
                      [&::-webkit-scrollbar-track]:bg-gray-900
                      [&::-webkit-scrollbar-thumb]:bg-gray-700
                      [&::-webkit-scrollbar-thumb]:rounded-full">
        {PLACEHOLDER_LINES.map((line, i) => (
          <p key={i} className={line === "_" ? "text-emerald-400 animate-pulse" : "text-gray-500"}>
            {line === "_" ? "█" : line}
          </p>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const SensorDetail = () => {
  const { sensorId } = useParams<{ sensorId: string }>();
  const navigate = useNavigate();
  const id = Number(sensorId);

  const { data: sensor, isLoading, isError } = useGetSensorQuery(id, { skip: !id });

  usePageTitle(sensor ? `${sensor.sensor_name} — VerdantIQ` : "Sensor — VerdantIQ");

  const meta = sensor?.sensor_metadata ?? {};
  const latitude  = meta.latitude  != null ? String(meta.latitude)  : null;
  const longitude = meta.longitude != null ? String(meta.longitude) : null;

  const lastSync = sensor?.last_message_at
    ? new Date(sensor.last_message_at).toLocaleString()
    : "No messages yet";

  return (
    <div className="px-6 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-gray-400 mb-6">
        <button onClick={() => navigate("/sensors/list")} className="hover:text-emerald-600 transition-colors">
          Sensors
        </button>
        <span>/</span>
        <span className="text-gray-600">{isLoading ? "…" : sensor?.sensor_name ?? "Not found"}</span>
      </div>

      {isLoading ? (
        <div className="text-sm text-gray-400 py-16 text-center">Loading sensor…</div>
      ) : isError || !sensor ? (
        <div className="text-sm text-gray-400 py-16 text-center">
          Sensor not found or you don't have access.
        </div>
      ) : (
        <div className="max-w-2xl space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
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

          {/* Details card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-2">
            <DetailRow
              label="Location"
              value={sensor.location ?? <span className="text-gray-300">—</span>}
            />
            <DetailRow
              label="Latitude"
              value={latitude ?? <span className="text-gray-300">—</span>}
            />
            <DetailRow
              label="Longitude"
              value={longitude ?? <span className="text-gray-300">—</span>}
            />
            <DetailRow
              label="Last message sync"
              value={lastSync}
            />
            <DetailRow
              label="Total messages"
              value={sensor.message_count.toLocaleString()}
            />
            <DetailRow
              label="Registered"
              value={new Date(sensor.created_at).toLocaleDateString(undefined, {
                year: "numeric", month: "short", day: "numeric",
              })}
            />
            <DetailRow
              label="Sensor ID"
              value={<span className="font-mono text-xs text-gray-500">#{sensor.sensor_id}</span>}
            />
          </div>

          {/* Message terminal */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-700">Live Message Stream</h2>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                Kafka — coming soon
              </span>
            </div>
            <Terminal />
            <p className="mt-2 text-xs text-gray-400">
              Displays up to the 20 most recent sensor messages in real time.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SensorDetail;
