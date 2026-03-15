import usePageTitle from "../../hooks/usePageTitle";
import { useGetMeQuery } from "../../redux/apislices/authApiSlice";
import { useGetSensorsQuery } from "../../redux/apislices/userDashboardApiSlice";
import { sensorIcon } from "../sensors/sensorUtils";

const Analytics = () => {
  usePageTitle("Analytics — VerdantIQ");
  const { data: me }      = useGetMeQuery();
  const { data: sensorsPage } = useGetSensorsQuery(
    { tenant_id: me?.tenant_id ?? 0, per_page: 100 },
    { skip: !me, pollingInterval: 30_000 },
  );

  const sensors = sensorsPage?.items ?? [];
  const totalMessages = sensors.reduce((s, x) => s + x.message_count, 0);

  return (
    <div className="px-6 py-8">
      <div className="mb-8">
        <h1 className="text-lg font-semibold text-gray-800">Analytics</h1>
        <p className="text-sm text-gray-400 mt-0.5">Data insights from your IoT sensor network</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Messages</p>
          <p className="text-2xl font-bold text-blue-600">{totalMessages.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">across all sensors</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Active Sensors</p>
          <p className="text-2xl font-bold text-emerald-600">
            {sensors.filter(s => s.status === "active").length}
          </p>
          <p className="text-xs text-gray-400 mt-1">streaming data</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Sensor Types</p>
          <p className="text-2xl font-bold text-purple-600">
            {new Set(sensors.map(s => s.sensor_type)).size}
          </p>
          <p className="text-xs text-gray-400 mt-1">unique types</p>
        </div>
      </div>

      {/* Per-sensor message breakdown */}
      {sensors.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-8">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800">Message Volume by Sensor</h2>
            <p className="text-xs text-gray-400 mt-0.5">Relative message count per sensor</p>
          </div>
          <div className="px-6 py-4 space-y-3">
            {[...sensors]
              .sort((a, b) => b.message_count - a.message_count)
              .map(s => {
                const pct = totalMessages > 0 ? (s.message_count / totalMessages) * 100 : 0;
                return (
                  <div key={s.sensor_id}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span>{sensorIcon(s.sensor_type)}</span>
                        <span className="text-sm text-gray-700">{s.sensor_name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full capitalize ${
                          s.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                        }`}>{s.status}</span>
                      </div>
                      <span className="text-xs text-gray-500 tabular-nums">
                        {s.message_count.toLocaleString()} ({pct.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Charts placeholder */}
      <div className="grid grid-cols-2 gap-4">
        {["Time-series Data", "Sensor Health Map"].map(title => (
          <div key={title} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-xs text-gray-300 mt-1">Trino + Iceberg integration coming soon</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Analytics;
