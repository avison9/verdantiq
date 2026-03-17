import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import usePageTitle from "../../hooks/usePageTitle";
import {
  useGetSensorStorageListQuery,
  useDeleteSensorStorageMutation,
  useGetSensorsQuery,
} from "../../redux/apislices/userDashboardApiSlice";
import { useGetMeQuery } from "../../redux/apislices/authApiSlice";
import { useBillingRates } from "../../hooks/useBillingRates";
import { sensorIcon } from "../sensors/sensorUtils";

const StorageList = () => {
  usePageTitle("Storage List — VerdantIQ");

  const { data: me } = useGetMeQuery();
  const { data: storageList } = useGetSensorStorageListQuery({ per_page: 100 });
  const { data: sensorsPage } = useGetSensorsQuery(
    { tenant_id: me?.tenant_id ?? 0, per_page: 100 },
    { skip: !me },
  );
  const { storage_rate } = useBillingRates();
  const [deleteStorage, { isLoading: deleting }] = useDeleteSensorStorageMutation();

  const sensorMap = Object.fromEntries((sensorsPage?.items ?? []).map(s => [s.sensor_id, s]));
  const items = storageList?.items ?? [];

  const handleDelete = async (storageId: string) => {
    try {
      await deleteStorage(storageId).unwrap();
      toast.success("Storage allocation deleted.");
    } catch {
      toast.error("Failed to delete storage allocation.");
    }
  };

  return (
    <div className="px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">Storage Allocations</h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage storage capacity across your sensors</p>
        </div>
        <Link
          to="/storage/add"
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          Add Storage
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 flex flex-col items-center justify-center">
          <p className="text-sm font-medium text-gray-500 mb-1">No storage allocations yet</p>
          <p className="text-xs text-gray-300 mb-4">Allocate storage to your sensors to get started</p>
          <Link
            to="/storage/add"
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            Add Storage
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Sensor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Allocated</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Used</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Cost/month</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map(item => {
                  const sensor = sensorMap[item.sensor_id ?? ""];
                  const usedMB = item.used_bytes / (1024 ** 2);
                  const allocatedBytes = item.allocated_gb * 1024 * 1024 * 1024;
                  const pct = allocatedBytes > 0 ? Math.min((item.used_bytes / allocatedBytes) * 100, 100) : 0;
                  const barColor = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-orange-400" : "bg-emerald-500";

                  return (
                    <tr key={item.storage_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3">
                        {sensor ? (
                          <div className="flex items-center gap-2">
                            <span>{sensorIcon(sensor.sensor_type)}</span>
                            <div>
                              <p className="text-sm font-medium text-gray-800">{sensor.sensor_name}</p>
                              <p className="text-xs text-gray-400 capitalize">{sensor.sensor_type}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-700 tabular-nums">
                        {item.allocated_gb.toFixed(2)} GB
                      </td>
                      <td className="px-6 py-3">
                        <div>
                          <p className="text-sm text-gray-700 tabular-nums mb-1">{usedMB.toFixed(2)} MB</p>
                          <div className="w-24 bg-gray-100 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full transition-all ${barColor}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                          item.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                        }`}>{item.status}</span>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-700 tabular-nums">
                        ${(item.allocated_gb * storage_rate).toFixed(4)}/mo
                      </td>
                      <td className="px-6 py-3">
                        <button
                          onClick={() => handleDelete(item.storage_id)}
                          disabled={deleting}
                          title="Delete allocation"
                          className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default StorageList;
