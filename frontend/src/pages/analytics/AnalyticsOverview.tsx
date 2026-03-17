import { useEffect, useRef, useState } from "react";
import usePageTitle from "../../hooks/usePageTitle";
import { useGetMeQuery } from "../../redux/apislices/authApiSlice";
import { useGetSensorsQuery, useGetSensorStorageListQuery } from "../../redux/apislices/userDashboardApiSlice";
import { useBillingRates } from "../../hooks/useBillingRates";
import { sensorIcon } from "../sensors/sensorUtils";

const DATA_SERVICE_URL = import.meta.env.VITE_DATA_SERVICE_URL ?? "http://localhost:8090";
const BYTES_PER_MSG = 300; // estimated bytes per IoT message

const AnalyticsOverview = () => {
  usePageTitle("Analytics — VerdantIQ");

  const { data: me } = useGetMeQuery();
  const { data: sensorsPage, refetch: refetchSensors } = useGetSensorsQuery(
    { tenant_id: me?.tenant_id ?? 0, per_page: 100 },
    { skip: !me, pollingInterval: 30_000 },
  );
  const { data: storageList } = useGetSensorStorageListQuery({});
  const [liveCounts, setLiveCounts] = useState<Record<string, number>>({});
  const [refreshing, setRefreshing] = useState(false);
  const { storage_rate } = useBillingRates();
  const fetchCountsRef = useRef<() => Promise<void>>();

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const r = await fetch(`${DATA_SERVICE_URL}/sensors/message-counts`);
        if (!r.ok) return;
        const data = await r.json();
        setLiveCounts(data);
      } catch { /* ignore */ }
    };
    fetchCountsRef.current = fetchCounts;
    fetchCounts();
    const id = setInterval(fetchCounts, 30_000);
    return () => clearInterval(id);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchSensors(), fetchCountsRef.current?.()]);
    setRefreshing(false);
  };

  const sensors = sensorsPage?.items ?? [];
  const storageItems = storageList?.items ?? [];

  const totalBytes = sensors.reduce((s, x) => {
    const bytes = (x.storage_bytes > 0 ? x.storage_bytes : (liveCounts[x.sensor_id] ?? x.message_count) * BYTES_PER_MSG);
    return s + bytes;
  }, 0);
  const totalVolumeGB = totalBytes / (1024 ** 3);
  const totalVolumeMB = totalBytes / (1024 ** 2);

  const activeSensors = sensors.filter(s => s.status === "active").length;
  const sensorTypes = new Set(sensors.map(s => s.sensor_type)).size;

  const sortedSensors = [...sensors].sort((a, b) => {
    const bytesA = a.storage_bytes > 0 ? a.storage_bytes : (liveCounts[a.sensor_id] ?? a.message_count) * BYTES_PER_MSG;
    const bytesB = b.storage_bytes > 0 ? b.storage_bytes : (liveCounts[b.sensor_id] ?? b.message_count) * BYTES_PER_MSG;
    return bytesB - bytesA;
  });

  return (
    <div className="px-6 py-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">Analytics Overview</h1>
          <p className="text-sm text-gray-400 mt-0.5">Storage and data insights from your IoT sensor network</p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors disabled:opacity-40"
          title="Refresh storage data">
          <svg className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Quick stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Volume</p>
          <p className="text-2xl font-bold text-blue-600">
            {totalVolumeGB >= 1 ? totalVolumeGB.toFixed(3) + " GB" : totalVolumeMB.toFixed(1) + " MB"}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Active Sensors</p>
          <p className="text-2xl font-bold text-emerald-600">{activeSensors}</p>
          <p className="text-xs text-gray-400 mt-1">streaming data</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Sensor Types</p>
          <p className="text-2xl font-bold text-purple-600">{sensorTypes}</p>
          <p className="text-xs text-gray-400 mt-1">unique types</p>
        </div>
      </div>

      {/* Storage Volume by Sensor */}
      {sensors.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-8">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800">Storage Volume by Sensor</h2>
            <p className="text-xs text-gray-400 mt-0.5">Data volume per sensor relative to allocated storage</p>
          </div>
          <div className="px-6 py-4 space-y-3">
            {sortedSensors.map(s => {
              const alloc = storageItems.find(a => a.sensor_id === s.sensor_id);
              const usedBytes = s.storage_bytes > 0 ? s.storage_bytes : (liveCounts[s.sensor_id] ?? s.message_count) * BYTES_PER_MSG;
              const usedMB = usedBytes / (1024 ** 2);
              const allocatedGB = alloc?.allocated_gb ?? 0;
              const allocatedMB = allocatedGB * 1024;
              const pct = allocatedMB > 0 ? Math.min((usedMB / allocatedMB) * 100, 100) : 0;
              const barColor = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-orange-400" : "bg-emerald-500";

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
                      {usedMB.toFixed(1)} MB{allocatedGB > 0 ? " / " + allocatedGB.toFixed(2) + " GB" : ""}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    {allocatedMB > 0 ? (
                      <div
                        className={`h-1.5 rounded-full transition-all ${barColor}`}
                        style={{ width: `${pct}%` }}
                      />
                    ) : (
                      <div className="h-1.5 rounded-full bg-gray-200" style={{ width: "0%" }} />
                    )}
                  </div>
                  {!alloc && (
                    <p className="text-xs text-gray-300 mt-0.5">(no storage allocated)</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sensor Storage Details table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-8">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Sensor Storage Details</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Sensor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Used (MB)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Allocated</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Cost/month</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sensors.map(s => {
                const alloc = storageItems.find(a => a.sensor_id === s.sensor_id);
                const usedBytes = s.storage_bytes > 0 ? s.storage_bytes : (liveCounts[s.sensor_id] ?? s.message_count) * BYTES_PER_MSG;
                const usedMB = usedBytes / (1024 ** 2);
                const allocatedGB = alloc?.allocated_gb ?? 0;

                return (
                  <tr key={s.sensor_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <span>{sensorIcon(s.sensor_type)}</span>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{s.sensor_name}</p>
                          <p className="text-xs text-gray-400 capitalize">{s.sensor_type}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-700 tabular-nums">{usedMB.toFixed(2)} MB</td>
                    <td className="px-6 py-3 text-sm text-gray-700 tabular-nums">
                      {allocatedGB > 0 ? allocatedGB.toFixed(2) + " GB" : "—"}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                        s.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                      }`}>{s.status}</span>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-700 tabular-nums">
                      {allocatedGB > 0 ? "$" + (allocatedGB * storage_rate).toFixed(4) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Placeholder charts */}
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

export default AnalyticsOverview;
