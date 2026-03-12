import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import type { RootState } from "../redux/store";
import usePageTitle from "../hooks/usePageTitle";
import { useGetMeQuery } from "../redux/apislices/authApiSlice";
import { useGetSensorsQuery, useGetBillingQuery } from "../redux/apislices/userDashboardApiSlice";

const STATUS_STYLES: Record<string, string> = {
  active:      "bg-emerald-100 text-emerald-700",
  inactive:    "bg-gray-100 text-gray-500",
  error:       "bg-red-100 text-red-600",
  maintenance: "bg-yellow-100 text-yellow-700",
};

const BILLING_STATUS_STYLES: Record<string, string> = {
  active:    "bg-emerald-100 text-emerald-700",
  inactive:  "bg-gray-100 text-gray-500",
  suspended: "bg-red-100 text-red-600",
};

const SENSOR_TYPE_ICONS: Record<string, string> = {
  temperature: "🌡️",
  humidity:    "💧",
  soil:        "🌱",
  weather:     "🌤️",
  default:     "📡",
};

function sensorIcon(type: string) {
  return SENSOR_TYPE_ICONS[type.toLowerCase()] ?? SENSOR_TYPE_ICONS.default;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const Dashboard = () => {
  usePageTitle("Dashboard");
  const userInfo = useSelector((state: RootState) => state.auth.userInfo);

  const { data: me, isLoading: meLoading } = useGetMeQuery();
  const { data: sensors = [], isLoading: sensorsLoading } = useGetSensorsQuery(
    { tenant_id: me?.tenant_id ?? 0 },
    { skip: !me },
  );
  const { data: billing } = useGetBillingQuery(undefined, { skip: !userInfo });

  const activeSensors  = sensors.filter((s) => s.status === "active").length;
  const errorSensors   = sensors.filter((s) => s.status === "error").length;

  if (meLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500 text-sm">Loading dashboard…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{greeting()},</p>
          <h1 className="text-lg font-semibold text-gray-800">
            {me ? `${me.first_name} ${me.last_name}` : "—"}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <Link
            to="/profile/user"
            className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
          >
            My profile
          </Link>
          <Link
            to="/profile/tenant"
            className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
          >
            Organisation
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total sensors"
            value={sensorsLoading ? "…" : String(sensors.length)}
            sub="registered devices"
            color="emerald"
          />
          <StatCard
            label="Active sensors"
            value={sensorsLoading ? "…" : String(activeSensors)}
            sub={`of ${sensors.length} online`}
            color="blue"
          />
          <StatCard
            label="Messages processed"
            value={billing ? billing.message_count.toLocaleString() : "—"}
            sub="total IoT messages"
            color="purple"
          />
          <StatCard
            label="Billing status"
            value={billing ? billing.status : "—"}
            sub={billing ? `${billing.frequency} · $${billing.amount_due.toFixed(2)} due` : "No billing set up"}
            color={billing?.status === "active" ? "emerald" : "gray"}
            badge={billing ? BILLING_STATUS_STYLES[billing.status] : undefined}
          />
        </div>

        {/* Sensors section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-800">Sensors</h2>
            {errorSensors > 0 && (
              <span className="text-xs bg-red-100 text-red-600 font-medium px-2 py-0.5 rounded-full">
                {errorSensors} error{errorSensors > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {sensorsLoading ? (
            <div className="px-6 py-10 text-center text-sm text-gray-400">Loading sensors…</div>
          ) : sensors.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="text-gray-400 text-sm">No sensors registered yet.</p>
              <p className="text-gray-400 text-xs mt-1">
                Use the API to onboard your first IoT device.
              </p>
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
                  {sensors.map((s) => (
                    <tr key={s.sensor_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3 font-medium text-gray-800">
                        {s.sensor_name}
                      </td>
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
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[s.status] ?? "bg-gray-100 text-gray-500"}`}
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
    </div>
  );
};

// ── StatCard ──────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  sub: string;
  color: "emerald" | "blue" | "purple" | "gray";
  badge?: string;
}

const COLOR_MAP: Record<string, string> = {
  emerald: "text-emerald-600",
  blue:    "text-blue-600",
  purple:  "text-purple-600",
  gray:    "text-gray-400",
};

const StatCard = ({ label, value, sub, color, badge }: StatCardProps) => (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4">
    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</p>
    {badge ? (
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${badge}`}>
        {value}
      </span>
    ) : (
      <p className={`text-2xl font-bold ${COLOR_MAP[color]}`}>{value}</p>
    )}
    <p className="text-xs text-gray-400 mt-1">{sub}</p>
  </div>
);

export default Dashboard;
