import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import usePageTitle from "../../hooks/usePageTitle";
import { useGetMeQuery } from "../../redux/apislices/authApiSlice";
import { useGetSensorsQuery, useGetSensorStorageListQuery } from "../../redux/apislices/userDashboardApiSlice";
import { useBillingRates } from "../../hooks/useBillingRates";

const DATA_SERVICE_URL = import.meta.env.VITE_DATA_SERVICE_URL ?? "http://localhost:8090";
const BYTES_PER_MSG = 300;

const RunningCostDetail = () => {
  usePageTitle("Running Cost Breakdown — VerdantIQ");

  const { data: me } = useGetMeQuery();
  const { data: sensorsPage } = useGetSensorsQuery(
    { tenant_id: me?.tenant_id ?? 0, per_page: 100 },
    { skip: !me },
  );
  const { data: storageList } = useGetSensorStorageListQuery({});
  const { message_rate, storage_rate, query_rate } = useBillingRates();
  const [liveCounts, setLiveCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch(`${DATA_SERVICE_URL}/sensors/message-counts`)
      .then(r => r.json())
      .then(data => setLiveCounts(data))
      .catch(() => {});
  }, []);

  const sensors = sensorsPage?.items ?? [];
  const storageItems = storageList?.items ?? [];

  // Per-sensor costs
  const sensorRows = sensors.map(s => {
    const msgs = liveCounts[s.sensor_id] ?? s.message_count;
    const msgCost = msgs * message_rate;
    const storageBytes = s.storage_bytes > 0 ? s.storage_bytes : msgs * BYTES_PER_MSG;
    const storageGB = storageBytes / (1024 ** 3);
    const alloc = storageItems.find(a => a.sensor_id === s.sensor_id);
    const allocGB = alloc?.allocated_gb ?? 0;
    const storageCost = allocGB * storage_rate;
    return { sensor: s, msgs, msgCost, storageGB, storageCost, total: msgCost + storageCost };
  });

  const totalMsgCost = sensorRows.reduce((s, r) => s + r.msgCost, 0);
  const totalStorageCost = sensorRows.reduce((s, r) => s + r.storageCost, 0);
  const totalQueryCost = 0; // Trino integration pending
  const grandTotal = totalMsgCost + totalStorageCost + totalQueryCost;

  const pct = (val: number) => grandTotal > 0 ? ((val / grandTotal) * 100).toFixed(1) : "0.0";

  const CostBar = ({ value, color }: { value: number; color: string }) => (
    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
      <div className={`h-1.5 rounded-full ${color}`}
        style={{ width: grandTotal > 0 ? `${Math.min((value / grandTotal) * 100, 100)}%` : "0%" }} />
    </div>
  );

  return (
    <div className="px-6 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Link to="/billing/setup" className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1 mb-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Setup Billing
          </Link>
          <h1 className="text-lg font-semibold text-gray-800">Running Cost Breakdown</h1>
          <p className="text-sm text-gray-400 mt-0.5">Costs accrued since the last billing cycle</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Total</p>
          <p className="text-2xl font-bold text-purple-600">${grandTotal.toFixed(4)}</p>
        </div>
      </div>

      {/* Cost breakdown by service */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Messages</p>
          <p className="text-xl font-bold text-blue-600">${totalMsgCost.toFixed(4)}</p>
          <p className="text-xs text-gray-400 mt-1">{pct(totalMsgCost)}% of total</p>
          <CostBar value={totalMsgCost} color="bg-blue-500" />
          <p className="text-xs text-gray-300 mt-2">@ ${message_rate}/msg</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Storage</p>
          <p className="text-xl font-bold text-emerald-600">${totalStorageCost.toFixed(4)}</p>
          <p className="text-xs text-gray-400 mt-1">{pct(totalStorageCost)}% of total</p>
          <CostBar value={totalStorageCost} color="bg-emerald-500" />
          <p className="text-xs text-gray-300 mt-2">@ ${storage_rate}/GB/mo</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Queries</p>
          <p className="text-xl font-bold text-purple-600">${totalQueryCost.toFixed(4)}</p>
          <p className="text-xs text-gray-400 mt-1">{pct(totalQueryCost)}% of total</p>
          <CostBar value={totalQueryCost} color="bg-purple-500" />
          <p className="text-xs text-gray-300 mt-2">@ ${query_rate}/query</p>
        </div>
      </div>

      {/* Per-sensor breakdown */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-6">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Per-Sensor Breakdown</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Sensor</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wide">Messages</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wide">Msg Cost</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wide">Storage (GB)</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wide">Storage Cost</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wide">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sensorRows.sort((a, b) => b.total - a.total).map(row => (
                <tr key={row.sensor.sensor_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3">
                    <p className="text-sm font-medium text-gray-800">{row.sensor.sensor_name}</p>
                    <p className="text-xs text-gray-400 capitalize">{row.sensor.sensor_type}</p>
                  </td>
                  <td className="px-6 py-3 text-right tabular-nums text-gray-600">{row.msgs.toLocaleString()}</td>
                  <td className="px-6 py-3 text-right tabular-nums text-blue-600">${row.msgCost.toFixed(4)}</td>
                  <td className="px-6 py-3 text-right tabular-nums text-gray-600">{row.storageGB.toFixed(4)}</td>
                  <td className="px-6 py-3 text-right tabular-nums text-emerald-600">${row.storageCost.toFixed(4)}</td>
                  <td className="px-6 py-3 text-right tabular-nums font-semibold text-gray-800">${row.total.toFixed(4)}</td>
                </tr>
              ))}
              {sensors.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-400">No sensors found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rate reference */}
      <div className="bg-gray-50 rounded-xl border border-gray-100 px-5 py-4 text-xs text-gray-500 space-y-1">
        <p className="font-semibold text-gray-700 mb-2">Billing Rates</p>
        <p>Message processing: <span className="font-mono">${message_rate}</span> per message</p>
        <p>Storage: <span className="font-mono">${storage_rate}</span> per GB per month (allocated)</p>
        <p>Queries (Trino): <span className="font-mono">${query_rate}</span> per query — integration coming soon</p>
      </div>
    </div>
  );
};

export default RunningCostDetail;
