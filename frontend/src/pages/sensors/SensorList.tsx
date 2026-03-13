import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import usePageTitle from "../../hooks/usePageTitle";
import { useGetMeQuery } from "../../redux/apislices/authApiSlice";
import { useGetSensorsQuery } from "../../redux/apislices/userDashboardApiSlice";

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

const STATUS_OPTIONS = ["all", "active", "inactive", "error", "maintenance"] as const;

const SensorList = () => {
  usePageTitle("Sensors — VerdantIQ");
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: me } = useGetMeQuery();
  const { data: sensors = [], isLoading } = useGetSensorsQuery(
    { tenant_id: me?.tenant_id ?? 0 },
    { skip: !me },
  );

  const filtered = sensors.filter((s) => {
    const matchStatus = statusFilter === "all" || s.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      s.sensor_name.toLowerCase().includes(q) ||
      s.sensor_type.toLowerCase().includes(q) ||
      (s.location ?? "").toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  return (
    <div className="px-6 py-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">Sensors</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {isLoading ? "Loading…" : `${sensors.length} registered device${sensors.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Link
          to="/sensors/onboard"
          className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          <span className="text-base leading-none">+</span>
          <span>Add Sensor</span>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, type or location…"
          className="flex-1 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                statusFilter === s
                  ? "bg-emerald-600 text-white"
                  : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-50"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        {isLoading ? (
          <div className="px-6 py-12 text-center text-sm text-gray-400">Loading sensors…</div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-gray-400 text-sm">
              {sensors.length === 0 ? "No sensors registered yet." : "No sensors match your filter."}
            </p>
            {sensors.length === 0 && (
              <Link
                to="/sensors/onboard"
                className="mt-3 inline-block text-xs text-emerald-600 hover:text-emerald-700 font-medium"
              >
                + Onboard your first sensor
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                  <th className="px-6 py-3 text-left">Sensor</th>
                  <th className="px-6 py-3 text-left">Type</th>
                  <th className="px-6 py-3 text-left">Location</th>
                  <th className="px-6 py-3 text-right">Messages</th>
                  <th className="px-6 py-3 text-left">Status</th>
                  <th className="px-6 py-3 text-left">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((s) => (
                  <tr
                    key={s.sensor_id}
                    onClick={() => navigate(`/sensors/${s.sensor_id}`)}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-3 font-medium text-gray-800">{s.sensor_name}</td>
                    <td className="px-6 py-3 text-gray-500">
                      <span className="mr-1">{sensorIcon(s.sensor_type)}</span>
                      {s.sensor_type}
                    </td>
                    <td className="px-6 py-3 text-gray-500">
                      {s.location ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-6 py-3 text-right text-gray-600">
                      {s.message_count.toLocaleString()}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          STATUS_STYLES[s.status] ?? "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-400">
                      {new Date(s.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SensorList;
