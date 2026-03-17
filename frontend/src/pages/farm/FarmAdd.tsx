import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import usePageTitle from "../../hooks/usePageTitle";
import { useCreateFarmMutation } from "../../redux/apislices/userDashboardApiSlice";
import CountrySelect from "../../components/CountrySelect";

const FARM_TYPES = [
  { value: "open_field", label: "Open Field" },
  { value: "greenhouse", label: "Greenhouse" },
  { value: "mixed",      label: "Mixed (Open + Greenhouse)" },
  { value: "hydroponic", label: "Hydroponic" },
  { value: "aquaponic",  label: "Aquaponic" },
];

const SOIL_TYPES = [
  "Sandy", "Clay", "Silt", "Loam", "Sandy Loam", "Clay Loam", "Silty Clay",
  "Peat", "Chalk", "Other",
];

const COMMON_CROPS = [
  "Maize", "Cassava", "Yam", "Rice", "Wheat", "Soybean", "Tomato",
  "Pepper", "Onion", "Cabbage", "Lettuce", "Carrot", "Potato", "Sweet Potato",
  "Cowpea", "Groundnut", "Sorghum", "Millet", "Plantain", "Banana",
  "Cocoa", "Coffee", "Palm Oil", "Rubber", "Cotton", "Sugarcane",
];

const labelCls = "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5";
const inputCls = "w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition";

const FarmAdd = () => {
  usePageTitle("Add Farm — VerdantIQ");
  const navigate = useNavigate();
  const [createFarm, { isLoading }] = useCreateFarmMutation();

  const [form, setForm] = useState({
    farm_name: "",
    address: "",
    country: "",
    farm_size_ha: "",
    farm_type: "",
    latitude: "",
    longitude: "",
    perimeter_km: "",
    soil_type: "",
    rainfall_avg_mm: "",
    sunlight_avg_hrs: "",
    notes: "",
  });

  const [selectedCrops, setSelectedCrops] = useState<string[]>([]);
  const [customCrop, setCustomCrop] = useState("");
  const [cropHistory, setCropHistory] = useState<{ year: string; crops: string; yield_tons: string }[]>([]);

  const set = (field: keyof typeof form, val: string) =>
    setForm(f => ({ ...f, [field]: val }));

  const toggleCrop = (crop: string) => {
    setSelectedCrops(prev =>
      prev.includes(crop) ? prev.filter(c => c !== crop) : [...prev, crop]
    );
  };

  const addCustomCrop = () => {
    const t = customCrop.trim();
    if (t && !selectedCrops.includes(t)) {
      setSelectedCrops(prev => [...prev, t]);
    }
    setCustomCrop("");
  };

  const addHistoryRow = () =>
    setCropHistory(prev => [...prev, { year: "", crops: "", yield_tons: "" }]);

  const updateHistoryRow = (i: number, field: string, val: string) =>
    setCropHistory(prev => prev.map((row, idx) => idx === i ? { ...row, [field]: val } : row));

  const removeHistoryRow = (i: number) =>
    setCropHistory(prev => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.farm_name.trim()) { toast.error("Farm name is required"); return; }
    try {
      const lat = parseFloat(form.latitude);
      const lon = parseFloat(form.longitude);
      const history = cropHistory
        .filter(r => r.year && r.crops)
        .map(r => ({ year: parseInt(r.year), crops: r.crops.split(",").map(c => c.trim()), yield_tons: r.yield_tons ? parseFloat(r.yield_tons) : undefined }));

      await createFarm({
        farm_name:         form.farm_name.trim(),
        address:           form.address.trim() || undefined,
        country:           form.country || undefined,
        farm_size_ha:      form.farm_size_ha ? parseFloat(form.farm_size_ha) : undefined,
        farm_type:         form.farm_type || undefined,
        latitude:          !isNaN(lat) ? lat : undefined,
        longitude:         !isNaN(lon) ? lon : undefined,
        perimeter_km:      form.perimeter_km ? parseFloat(form.perimeter_km) : undefined,
        crops:             selectedCrops.length ? selectedCrops : undefined,
        rainfall_avg_mm:   form.rainfall_avg_mm ? parseFloat(form.rainfall_avg_mm) : undefined,
        sunlight_avg_hrs:  form.sunlight_avg_hrs ? parseFloat(form.sunlight_avg_hrs) : undefined,
        soil_type:         form.soil_type || undefined,
        crop_history:      history.length ? history : undefined,
        notes:             form.notes.trim() || undefined,
      }).unwrap();
      toast.success(`Farm "${form.farm_name}" created successfully`);
      navigate("/farm/management");
    } catch (err) {
      toast.error((err as { data?: { detail?: string } })?.data?.detail ?? "Failed to create farm");
    }
  };

  return (
    <div className="px-6 py-8">
      <div className="mb-8">
        <p className="text-xs text-gray-400 mb-0.5">Farms / Add</p>
        <h1 className="text-lg font-semibold text-gray-800">Register a Farm</h1>
        <p className="text-sm text-gray-400 mt-0.5">Add a farm to your organisation. Sensors can be assigned to farms.</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        {/* Basic Info */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-800">Basic Information</h2>
          <div>
            <label className={labelCls}>Farm name *</label>
            <input required value={form.farm_name} onChange={e => set("farm_name", e.target.value)}
              placeholder="e.g. Greenfield North Farm" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Farm type</label>
              <select value={form.farm_type} onChange={e => set("farm_type", e.target.value)} className={inputCls}>
                <option value="">— Select type —</option>
                {FARM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Size (hectares)</label>
              <input type="number" min="0" step="0.01" value={form.farm_size_ha}
                onChange={e => set("farm_size_ha", e.target.value)}
                placeholder="e.g. 25.5" className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <input value={form.notes} onChange={e => set("notes", e.target.value)}
              placeholder="Any additional details about this farm" className={inputCls} />
          </div>
        </section>

        {/* Location */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-800">Location</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Country</label>
              <CountrySelect value={form.country} onChange={v => set("country", v)} />
            </div>
            <div>
              <label className={labelCls}>Address</label>
              <input value={form.address} onChange={e => set("address", e.target.value)}
                placeholder="e.g. 12 Farm Lane, Ogun State" className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Latitude</label>
              <input type="number" step="any" value={form.latitude}
                onChange={e => set("latitude", e.target.value)}
                placeholder="e.g. 6.5244" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Longitude</label>
              <input type="number" step="any" value={form.longitude}
                onChange={e => set("longitude", e.target.value)}
                placeholder="e.g. 3.3792" className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Perimeter (km)</label>
            <input type="number" min="0" step="0.01" value={form.perimeter_km}
              onChange={e => set("perimeter_km", e.target.value)}
              placeholder="e.g. 4.2" className={inputCls + " max-w-xs"} />
          </div>
        </section>

        {/* Agricultural Data */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-800">Agricultural Data</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Soil type</label>
              <select value={form.soil_type} onChange={e => set("soil_type", e.target.value)} className={inputCls}>
                <option value="">— Select —</option>
                {SOIL_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Avg rainfall (mm/yr)</label>
              <input type="number" min="0" step="1" value={form.rainfall_avg_mm}
                onChange={e => set("rainfall_avg_mm", e.target.value)}
                placeholder="e.g. 1200" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Avg sunlight (hrs/day)</label>
              <input type="number" min="0" max="24" step="0.5" value={form.sunlight_avg_hrs}
                onChange={e => set("sunlight_avg_hrs", e.target.value)}
                placeholder="e.g. 7.5" className={inputCls} />
            </div>
          </div>

          {/* Crops */}
          <div>
            <label className={labelCls}>Current crops</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {COMMON_CROPS.map(crop => (
                <button key={crop} type="button" onClick={() => toggleCrop(crop)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    selectedCrops.includes(crop)
                      ? "bg-emerald-100 border-emerald-400 text-emerald-700 font-semibold"
                      : "border-gray-200 text-gray-500 hover:border-emerald-300"
                  }`}>
                  {crop}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={customCrop} onChange={e => setCustomCrop(e.target.value)}
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addCustomCrop())}
                placeholder="Add custom crop…" className={inputCls + " max-w-xs"} />
              <button type="button" onClick={addCustomCrop}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors">
                Add
              </button>
            </div>
            {selectedCrops.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {selectedCrops.map(crop => (
                  <span key={crop} className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                    {crop}
                    <button type="button" onClick={() => toggleCrop(crop)} className="hover:text-red-500">&times;</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Crop History */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">Crop History</h2>
            <button type="button" onClick={addHistoryRow}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">
              + Add year
            </button>
          </div>
          {cropHistory.length === 0 && (
            <p className="text-xs text-gray-400">No crop history recorded yet. Add years above.</p>
          )}
          {cropHistory.map((row, i) => (
            <div key={i} className="grid grid-cols-3 gap-3 items-end">
              <div>
                <label className={labelCls}>Year</label>
                <input type="number" min="1900" max="2100" value={row.year}
                  onChange={e => updateHistoryRow(i, "year", e.target.value)}
                  placeholder="e.g. 2023" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Crops grown</label>
                <input value={row.crops} onChange={e => updateHistoryRow(i, "crops", e.target.value)}
                  placeholder="e.g. Maize, Soybean" className={inputCls} />
              </div>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className={labelCls}>Yield (tons)</label>
                  <input type="number" min="0" step="0.01" value={row.yield_tons}
                    onChange={e => updateHistoryRow(i, "yield_tons", e.target.value)}
                    placeholder="e.g. 12.5" className={inputCls} />
                </div>
                <button type="button" onClick={() => removeHistoryRow(i)}
                  className="pb-2.5 text-gray-300 hover:text-red-400 transition-colors text-lg leading-none">&times;</button>
              </div>
            </div>
          ))}
        </section>

        {/* Actions */}
        <div className="flex gap-3">
          <button type="submit" disabled={isLoading}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors">
            {isLoading ? "Creating…" : "Create Farm"}
          </button>
          <button type="button" onClick={() => navigate(-1)}
            className="px-6 py-3 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default FarmAdd;
