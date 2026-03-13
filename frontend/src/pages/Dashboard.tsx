import { Link } from "react-router-dom";
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

const Dashboard = () => {
  usePageTitle("Dashboard — VerdantIQ");

  const { data: me, isLoading: meLoading } = useGetMeQuery();
  const { data: sensors = [], isLoading: sensorsLoading } = useGetSensorsQuery(
    { tenant_id: me?.tenant_id ?? 0 },
    { skip: !me },
  );
  const { data: billing } = useGetBillingQuery(undefined, { skip: !me });

  const activeSensors = sensors.filter((s) => s.status === "active").length;
  const errorSensors  = sensors.filter((s) => s.status === "error").length;

  if (meLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-400 text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 space-y-8">
      {/* Page heading */}
      <div>
        <h1 className="text-lg font-semibold text-gray-800">Overview</h1>
        <p className="text-sm text-gray-400 mt-0.5">Your farm IoT platform at a glance</p>
      </div>

      {/* Billing inactive warning */}
      {billing && billing.status !== "active" && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-center gap-4">
          <svg className="w-5 h-5 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">Billing is not active</p>
            <p className="text-xs text-amber-600 mt-0.5">Top up your account to start onboarding sensors.</p>
          </div>
          <Link
            to="/billing/setup"
            className="text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            Setup Billing
          </Link>
        </div>
      )}

      {!billing && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-center gap-4">
          <svg className="w-5 h-5 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">No billing set up</p>
            <p className="text-xs text-amber-600 mt-0.5">You must activate billing before onboarding sensors.</p>
          </div>
          <Link
            to="/billing/setup"
            className="text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            Setup Billing
          </Link>
        </div>
      )}

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
          sub={
            billing
              ? `Balance $${(billing.balance ?? 0).toFixed(2)}`
              : "No billing set up"
          }
          color={billing?.status === "active" ? "emerald" : "gray"}
          badge={billing ? BILLING_STATUS_STYLES[billing.status] : undefined}
        />
      </div>

      {/* Sensors section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">Sensors</h2>
          <div className="flex items-center gap-3">
            {errorSensors > 0 && (
              <span className="text-xs bg-red-100 text-red-600 font-medium px-2 py-0.5 rounded-full">
                {errorSensors} error{errorSensors > 1 ? "s" : ""}
              </span>
            )}
            <Link
              to="/sensors/list"
              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
            >
              View all
            </Link>
            <Link
              to="/sensors/onboard"
              className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              <span className="text-base leading-none">+</span>
              <span>Add sensor</span>
            </Link>
          </div>
        </div>

        {sensorsLoading ? (
          <div className="px-6 py-10 text-center text-sm text-gray-400">Loading sensors…</div>
        ) : sensors.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-gray-400 text-sm">No sensors registered yet.</p>
            <Link
              to="/sensors/onboard"
              className="mt-3 inline-block text-xs text-emerald-600 hover:text-emerald-700 font-medium"
            >
              + Onboard your first sensor
            </Link>
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
                {sensors.slice(0, 10).map((s) => (
                  <tr key={s.sensor_id} className="hover:bg-gray-50 transition-colors">
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
            {sensors.length > 10 && (
              <div className="px-6 py-3 border-t border-gray-50 text-center">
                <Link
                  to="/sensors/list"
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  View all {sensors.length} sensors →
                </Link>
              </div>
            )}
          </div>
        )}
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
