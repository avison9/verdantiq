import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import usePageTitle from "../../hooks/usePageTitle";
import { useGetMeQuery } from "../../redux/apislices/authApiSlice";
import {
  useGetSensorsQuery,
  useGetBillingQuery,
  useGetSensorStorageListQuery,
  useCreateSensorStorageMutation,
} from "../../redux/apislices/userDashboardApiSlice";
import { useBillingRates } from "../../hooks/useBillingRates";

const StorageAdd = () => {
  usePageTitle("Add Storage — VerdantIQ");

  const navigate = useNavigate();
  const { data: me } = useGetMeQuery();
  const { data: billing } = useGetBillingQuery(undefined, { skip: !me });
  const { data: sensorsPage } = useGetSensorsQuery(
    { tenant_id: me?.tenant_id ?? 0, per_page: 100 },
    { skip: !me },
  );
  const { data: storageList, isLoading: storageLoading } = useGetSensorStorageListQuery({});
  const { storage_rate } = useBillingRates();
  const [createStorage, { isLoading }] = useCreateSensorStorageMutation();

  const [selectedSensorId, setSelectedSensorId] = useState("");
  const [allocatedGb, setAllocatedGb] = useState("");

  if (!billing || billing.status !== "active") {
    return (
      <div className="px-6 py-8 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 flex flex-col items-center max-w-md w-full">
          <p className="text-sm font-medium text-gray-700 mb-4">
            Billing must be active before adding storage.
          </p>
          <button
            onClick={() => navigate("/billing/setup")}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            Setup Billing
          </button>
        </div>
      </div>
    );
  }

  const sensors = sensorsPage?.items ?? [];
  const allocatedSensorIds = new Set((storageList?.items ?? []).map(s => s.sensor_id));
  const availableSensors = sensors.filter(s => !allocatedSensorIds.has(s.sensor_id));
  const parsedGb = parseFloat(allocatedGb);
  const costPreview = !isNaN(parsedGb) && parsedGb > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (allocatedSensorIds.has(selectedSensorId)) {
      toast.error("This sensor already has a storage allocation.");
      return;
    }
    try {
      await createStorage({ sensor_id: selectedSensorId, allocated_gb: parseFloat(allocatedGb) }).unwrap();
      toast.success("Storage allocated successfully.");
      navigate("/storage/list");
    } catch {
      toast.error("Failed to allocate storage.");
    }
  };

  return (
    <div className="px-6 py-8">
      <div className="mb-8">
        <h1 className="text-lg font-semibold text-gray-800">Add Storage</h1>
        <p className="text-sm text-gray-400 mt-0.5">Allocate storage capacity to a sensor</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-lg">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Sensor</label>
            <select
              value={selectedSensorId}
              onChange={e => setSelectedSensorId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">— Select sensor —</option>
              {availableSensors.map(s => (
                <option key={s.sensor_id} value={s.sensor_id}>
                  {s.sensor_name}
                </option>
              ))}
              {availableSensors.length === 0 && sensors.length > 0 && (
                <option disabled value="">All sensors already have storage allocated</option>
              )}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Allocated Storage (GB)</label>
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={allocatedGb}
              onChange={e => setAllocatedGb(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="e.g. 1.0"
            />
          </div>

          {costPreview && (
            <p className="text-sm text-purple-600">
              Estimated monthly cost: ${(parsedGb * storage_rate).toFixed(2)}
            </p>
          )}

          <button
            type="submit"
            disabled={!selectedSensorId || !allocatedGb || isLoading || storageLoading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            {isLoading ? "Allocating…" : "Allocate Storage"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default StorageAdd;
