import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import usePageTitle from "../../hooks/usePageTitle";
import {
  useGetCropQuery,
  useCreateCropMutation,
  useUpdateCropMutation,
  useGetFarmsQuery,
  useGetSensorsQuery,
} from "../../redux/apislices/userDashboardApiSlice";
import { useGetMeQuery } from "../../redux/apislices/authApiSlice";

const DATA_SERVICE_URL = import.meta.env.VITE_DATA_SERVICE_URL ?? "http://localhost:8090";

type Tab = "view" | "edit";

const CropDetail = () => {
  usePageTitle("Crop Detail — VerdantIQ");
  const { cropId } = useParams<{ cropId: string }>();
  const navigate = useNavigate();
  const isNew = cropId === "new";

  const [tab, setTab] = useState<Tab>(isNew ? "edit" : "view");

  const { data: crop, isLoading } = useGetCropQuery(cropId!, { skip: isNew || !cropId });
  const { data: me } = useGetMeQuery();
  const { data: farmsPage } = useGetFarmsQuery({ per_page: 100 });
  const { data: sensorsPage } = useGetSensorsQuery(
    { tenant_id: me?.tenant_id ?? 0, per_page: 100 },
    { skip: !me },
  );
  const [createCrop, { isLoading: creating }] = useCreateCropMutation();
  const [updateCrop, { isLoading: updating }] = useUpdateCropMutation();

  const farms = farmsPage?.items ?? [];
  const sensors = sensorsPage?.items ?? [];

  // Live sensor readings for the view tab
  const [liveData, setLiveData] = useState<Record<string, number>>({});
  useEffect(() => {
    if (isNew) return;
    const fetchLive = async () => {
      try {
        const r = await fetch(`${DATA_SERVICE_URL}/sensors/message-counts`, {
          signal: AbortSignal.timeout(8000),
        });
        if (!r.ok) return;
        const body = await r.json() as { counts: Record<string, number> };
        setLiveData(body.counts ?? {});
      } catch { /* ignore */ }
    };
    fetchLive();
    const id = setInterval(fetchLive, 30_000);
    return () => clearInterval(id);
  }, [isNew]);

  // Edit form state
  const [form, setForm] = useState({
    farm_id: "",
    crop_name: "",
    area_ha: "",
    grain_type: "",
    grains_planted: "",
    planting_date: "",
    expected_harvest_date: "",
    notes: "",
    avg_sunlight_hrs: "",
    soil_ph: "",
    soil_humidity: "",
  });

  useEffect(() => {
    if (crop) {
      setForm({
        farm_id: crop.farm_id,
        crop_name: crop.crop_name,
        area_ha: crop.area_ha != null ? String(crop.area_ha) : "",
        grain_type: crop.grain_type ?? "",
        grains_planted: crop.grains_planted != null ? String(crop.grains_planted) : "",
        planting_date: crop.planting_date ?? "",
        expected_harvest_date: crop.expected_harvest_date ?? "",
        notes: crop.notes ?? "",
        avg_sunlight_hrs: crop.avg_sunlight_hrs != null ? String(crop.avg_sunlight_hrs) : "",
        soil_ph: crop.soil_ph != null ? String(crop.soil_ph) : "",
        soil_humidity: crop.soil_humidity != null ? String(crop.soil_humidity) : "",
      });
    }
  }, [crop]);

  const handleSave = async () => {
    if (!form.farm_id || !form.crop_name) {
      toast.error("Farm and crop name are required");
      return;
    }
    const payload = {
      farm_id: form.farm_id,
      crop_name: form.crop_name,
      area_ha: form.area_ha ? parseFloat(form.area_ha) : undefined,
      grain_type: form.grain_type || undefined,
      grains_planted: form.grains_planted ? parseInt(form.grains_planted) : undefined,
      planting_date: form.planting_date || undefined,
      expected_harvest_date: form.expected_harvest_date || undefined,
      notes: form.notes || undefined,
      avg_sunlight_hrs: form.avg_sunlight_hrs ? parseFloat(form.avg_sunlight_hrs) : undefined,
      soil_ph: form.soil_ph ? parseFloat(form.soil_ph) : undefined,
      soil_humidity: form.soil_humidity ? parseFloat(form.soil_humidity) : undefined,
    };
    try {
      if (isNew) {
        await createCrop(payload).unwrap();
        toast.success("Crop added");
        navigate("/farm/crops");
      } else {
        await updateCrop({ id: cropId!, ...payload }).unwrap();
        toast.success("Crop updated");
        setTab("view");
      }
    } catch {
      toast.error("Failed to save crop");
    }
  };

  const inputCls = "w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white";
  const labelCls = "block text-xs text-gray-500 mb-1 font-medium";

  // Sensors assigned to this crop's farm
  const farmSensors = crop
    ? sensors.filter(s => s.farm_id === crop.farm_id || String(s.sensor_metadata?.farm_id ?? "") === crop.farm_id)
    : [];

  const daysUntilHarvest = crop?.expected_harvest_date
    ? Math.ceil((new Date(crop.expected_harvest_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  if (!isNew && isLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-4 border-emerald-500 border-t-transparent" />
    </div>
  );

  if (!isNew && !crop) return (
    <div className="px-6 py-8">
      <p className="text-sm text-gray-400">Crop not found.</p>
      <button onClick={() => navigate(-1)} className="mt-3 text-emerald-600 text-sm font-medium">← Back</button>
    </div>
  );

  return (
    <div className="px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            to="/farm/crops"
            className="text-xs text-emerald-600 hover:text-emerald-700 font-medium mb-1 flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Crop Management
          </Link>
          <h1 className="text-lg font-semibold text-gray-800">
            {isNew ? "Add Crop" : crop!.crop_name}
          </h1>
          {!isNew && crop!.grain_type && (
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
              {crop!.grain_type}
            </span>
          )}
        </div>
        {!isNew && daysUntilHarvest !== null && (
          <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
            daysUntilHarvest < 0 ? "bg-red-100 text-red-700" :
            daysUntilHarvest <= 14 ? "bg-amber-100 text-amber-700" :
            "bg-emerald-100 text-emerald-700"
          }`}>
            {daysUntilHarvest < 0
              ? `${Math.abs(daysUntilHarvest)} days overdue`
              : `${daysUntilHarvest} days to harvest`}
          </span>
        )}
      </div>

      {/* Tabs (only for existing crops) */}
      {!isNew && (
        <div className="flex gap-1 mb-6 border-b border-gray-100">
          {(["view", "edit"] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                tab === t
                  ? "border-emerald-500 text-emerald-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "view" ? "Live Data" : "Edit"}
            </button>
          ))}
        </div>
      )}

      {/* View tab — live sensor data */}
      {tab === "view" && !isNew && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Crop info summary */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Crop Info</h2>
            {[
              { label: "Farm", value: farms.find(f => f.farm_id === crop!.farm_id)?.farm_name ?? crop!.farm_id },
              { label: "Area", value: crop!.area_ha ? `${crop!.area_ha} ha` : null },
              { label: "Grain type", value: crop!.grain_type },
              { label: "Seeds planted", value: crop!.grains_planted?.toLocaleString() },
              { label: "Planting date", value: crop!.planting_date ? new Date(crop!.planting_date).toLocaleDateString(undefined, { dateStyle: "medium" }) : null },
              { label: "Expected harvest", value: crop!.expected_harvest_date ? new Date(crop!.expected_harvest_date).toLocaleDateString(undefined, { dateStyle: "medium" }) : null },
            ].map(row => (
              <div key={row.label} className="flex justify-between items-baseline py-2 border-b border-gray-50 last:border-0">
                <span className="text-xs text-gray-400 uppercase tracking-wide">{row.label}</span>
                <span className="text-sm text-gray-700 font-medium">{row.value ?? "—"}</span>
              </div>
            ))}
            {crop!.notes && (
              <div className="mt-3 pt-3 border-t border-gray-50">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Notes</p>
                <p className="text-sm text-gray-600">{crop!.notes}</p>
              </div>
            )}
          </div>

          {/* Live sensor readings */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-800">Live Sensor Data</h2>
              <span className="text-xs text-gray-400">30 s</span>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-amber-50 rounded-xl p-3 text-center">
                <p className="text-xs text-amber-600 mb-1">Sunlight</p>
                <p className="text-lg font-bold text-amber-700">
                  {crop!.avg_sunlight_hrs != null ? `${crop!.avg_sunlight_hrs}` : "—"}
                </p>
                <p className="text-xs text-amber-500">hrs/day</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <p className="text-xs text-blue-600 mb-1">Soil pH</p>
                <p className="text-lg font-bold text-blue-700">
                  {crop!.soil_ph != null ? crop!.soil_ph.toFixed(1) : "—"}
                </p>
                <p className="text-xs text-blue-500">pH</p>
              </div>
              <div className="bg-cyan-50 rounded-xl p-3 text-center">
                <p className="text-xs text-cyan-600 mb-1">Humidity</p>
                <p className="text-lg font-bold text-cyan-700">
                  {crop!.soil_humidity != null ? `${crop!.soil_humidity}` : "—"}
                </p>
                <p className="text-xs text-cyan-500">%</p>
              </div>
            </div>

            {/* Farm sensors */}
            {farmSensors.length > 0 ? (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Farm Sensors ({farmSensors.length})</p>
                <div className="space-y-2">
                  {farmSensors.map(s => (
                    <div key={s.sensor_id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                      <div>
                        <Link to={`/sensors/${s.sensor_id}`} className="text-xs font-medium text-emerald-600 hover:text-emerald-700">
                          {s.sensor_name}
                        </Link>
                        <p className="text-xs text-gray-400 capitalize">{s.sensor_type}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          s.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                        }`}>{s.status}</span>
                        <p className="text-xs text-gray-400 mt-0.5">{(liveData[s.sensor_id] ?? s.message_count).toLocaleString()} msgs</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400">No sensors assigned to this farm.</p>
            )}
          </div>
        </div>
      )}

      {/* Edit tab */}
      {(tab === "edit" || isNew) && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 max-w-2xl">
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Farm *</label>
              <select
                value={form.farm_id}
                onChange={e => setForm(f => ({ ...f, farm_id: e.target.value }))}
                className={inputCls}
              >
                <option value="">Select a farm</option>
                {farms.map(f => (
                  <option key={f.farm_id} value={f.farm_id}>{f.farm_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Crop Name *</label>
              <input
                type="text"
                value={form.crop_name}
                onChange={e => setForm(f => ({ ...f, crop_name: e.target.value }))}
                placeholder="e.g. Maize, Rice, Cassava"
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Area (ha)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.area_ha}
                  onChange={e => setForm(f => ({ ...f, area_ha: e.target.value }))}
                  placeholder="0.00"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Grain Type</label>
                <input
                  type="text"
                  value={form.grain_type}
                  onChange={e => setForm(f => ({ ...f, grain_type: e.target.value }))}
                  placeholder="e.g. Hybrid, Organic"
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Seeds / Grains Planted</label>
              <input
                type="number"
                value={form.grains_planted}
                onChange={e => setForm(f => ({ ...f, grains_planted: e.target.value }))}
                placeholder="e.g. 50000"
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Planting Date</label>
                <input
                  type="date"
                  value={form.planting_date}
                  onChange={e => setForm(f => ({ ...f, planting_date: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Expected Harvest Date</label>
                <input
                  type="date"
                  value={form.expected_harvest_date}
                  onChange={e => setForm(f => ({ ...f, expected_harvest_date: e.target.value }))}
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-500 font-medium mb-2 uppercase tracking-wide">Sensor Readings (optional)</p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Avg Sunlight (hrs/day)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.avg_sunlight_hrs}
                    onChange={e => setForm(f => ({ ...f, avg_sunlight_hrs: e.target.value }))}
                    placeholder="0.0"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Soil pH</label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.soil_ph}
                    onChange={e => setForm(f => ({ ...f, soil_ph: e.target.value }))}
                    placeholder="6.5"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Soil Humidity (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.soil_humidity}
                    onChange={e => setForm(f => ({ ...f, soil_humidity: e.target.value }))}
                    placeholder="0.0"
                    className={inputCls}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className={labelCls}>Notes</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Any additional notes about this crop..."
                rows={3}
                className={inputCls + " resize-none"}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={creating || updating}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
              >
                {creating || updating ? "Saving..." : isNew ? "Add Crop" : "Save Changes"}
              </button>
              {!isNew && (
                <button
                  onClick={() => setTab("view")}
                  className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CropDetail;
