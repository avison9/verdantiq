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

// ── Farm tile animation ────────────────────────────────────────────────────────

interface FarmTileData { d?: number; icon: React.ReactNode; label: string; v1: string; v2: string; color: string; }

const FARM_TILES: FarmTileData[] = [
  {
    d: 0.0, label: "Sunlight", v1: "7.8 hrs/day", v2: "UV: 3.4",
    color: "amber",
    icon: (
      <svg className="w-9 h-9 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="5" strokeWidth={1.5} />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M12 2v2m0 16v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M2 12h2m16 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
    ),
  },
  {
    d: 0.4, label: "Rainfall", v1: "1 240 mm/yr", v2: "15.2 mm/wk",
    color: "blue",
    icon: (
      <svg className="w-9 h-9 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M20 17.58A5 5 0 0018 8h-1.26A8 8 0 104 15.25M8 19v1m4-2v2m4-1v1" />
      </svg>
    ),
  },
  {
    d: 0.8, label: "Soil", v1: "6.8 pH  Loam", v2: "42% VWC",
    color: "brown",
    icon: (
      <svg className="w-9 h-9 text-yellow-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M12 3C8 3 4 7 4 12c0 2 .5 4 2 5.5S9 20 12 20s4.5-1 6-2.5S20 14 20 12c0-5-4-9-8-9z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v17" />
      </svg>
    ),
  },
  {
    d: 1.2, label: "Crop Growth", v1: "Stage 3 / 5", v2: "32% complete",
    color: "emerald",
    icon: (
      <svg className="w-9 h-9 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M12 22V12m0 0C12 7 7 4 4 6c2 4 5 6 8 6zm0 0c0-5 5-8 8-6-2 4-5 6-8 6z" />
      </svg>
    ),
  },
  // center top
  {
    d: 0.6, label: "Field Size", v1: "25.5 ha", v2: "4.2 km perimeter",
    color: "green",
    icon: (
      <svg className="w-9 h-9 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    d: 0.2, label: "Temperature", v1: "28.4°C", v2: "Low: 18.1°C",
    color: "orange",
    icon: (
      <svg className="w-9 h-9 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M14 14.76V3.5a2.5 2.5 0 10-5 0v11.26a4.5 4.5 0 105 0z" />
      </svg>
    ),
  },
  {
    d: 0.6, label: "Humidity", v1: "72% RH", v2: "Dew: 21.2°C",
    color: "cyan",
    icon: (
      <svg className="w-9 h-9 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" />
      </svg>
    ),
  },
  {
    d: 1.0, label: "Wind", v1: "8.5 km/h", v2: "Direction: N",
    color: "slate",
    icon: (
      <svg className="w-9 h-9 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9.59 4.59A2 2 0 1111 8H2m10.59 11.41A2 2 0 1014 16H2m15.73-8.27A2.5 2.5 0 1119.5 12H2" />
      </svg>
    ),
  },
  {
    d: 1.4, label: "Nitrogen", v1: "120 kg/ha", v2: "K: 80 / P: 60",
    color: "purple",
    icon: (
      <svg className="w-9 h-9 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
  },
  // center bottom
  {
    d: 0.9, label: "Harvest ETA", v1: "~45 days", v2: "Season: Dry",
    color: "emerald",
    icon: (
      <svg className="w-9 h-9 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
];

const TILE_BG: Record<string, string> = {
  amber: "bg-amber-50 border-amber-100",
  blue: "bg-blue-50 border-blue-100",
  brown: "bg-yellow-50 border-yellow-100",
  emerald: "bg-emerald-50 border-emerald-100",
  green: "bg-green-50 border-green-100",
  orange: "bg-orange-50 border-orange-100",
  cyan: "bg-cyan-50 border-cyan-100",
  slate: "bg-slate-50 border-slate-100",
  purple: "bg-purple-50 border-purple-100",
};

const TILE_TEXT: Record<string, string> = {
  amber: "text-amber-700", blue: "text-blue-700", brown: "text-yellow-800",
  emerald: "text-emerald-700", green: "text-green-700", orange: "text-orange-700",
  cyan: "text-cyan-700", slate: "text-slate-700", purple: "text-purple-700",
};

const FarmTile = ({ d = 0, icon, label, v1, v2, color }: FarmTileData) => (
  <div className="relative flex items-center justify-center w-full h-full select-none pointer-events-none">
    <div className="relative z-10 flex flex-col items-center gap-2">
      {/* Icon card */}
      <div className={`w-16 h-16 rounded-2xl shadow-sm flex items-center justify-center border ${TILE_BG[color] ?? "bg-gray-50 border-gray-100"}`}>
        {icon}
      </div>

      {/* Data uplink bars */}
      <div className="flex items-end gap-0.5 h-4">
        {[0.3, 0.6, 1.0].map((h, i) => (
          <div key={i} className="w-1 rounded-sm bg-emerald-400 animate-pulse"
            style={{ height: `${h * 16}px`, animationDelay: `${d + i * 0.15}s` }} />
        ))}
      </div>

      <p className={`text-xs font-semibold tracking-wide ${TILE_TEXT[color] ?? "text-gray-600"}`}>{label}</p>

      {/* Floating data tags */}
      <div className="absolute top-0 right-0 translate-x-6 -translate-y-3">
        <div className={`border rounded-lg px-2 py-1 text-xs font-mono animate-bounce ${TILE_BG[color] ?? ""} ${TILE_TEXT[color] ?? ""}`}
          style={{ animationDuration: "2.2s", animationDelay: `${d}s` }}>
          {v1}
        </div>
      </div>
      <div className="absolute bottom-6 left-0 -translate-x-8">
        <div className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-600 font-mono animate-bounce"
          style={{ animationDuration: "3s", animationDelay: `${d + 0.6}s` }}>
          {v2}
        </div>
      </div>
    </div>

    {/* Subtle dot grid */}
    <div className="absolute inset-0 opacity-[0.03]"
      style={{ backgroundImage: "radial-gradient(circle, #16a34a 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
  </div>
);

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

      {/* Two-column layout: form left, animation right */}
      <div className="flex gap-8 items-start">
        <div className="flex-1 min-w-0">
      <form onSubmit={handleSubmit} className="space-y-6">
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
        </div>{/* end form col */}

        {/* Right: farm tile animations — same flex-1 width as form col */}
        <div className="hidden lg:flex flex-1 sticky top-8 self-start overflow-hidden rounded-3xl bg-gradient-to-br from-green-50/80 via-white to-amber-50/40 border border-green-100/60" style={{ height: "calc(100vh - 120px)" }}>
          <div className="absolute inset-0 overflow-hidden grid grid-cols-2" style={{ gridAutoRows: "220px" }}>
            {FARM_TILES.slice(0, 4).map((tile, i) => (
              <div key={i} className="relative overflow-hidden">
                <FarmTile {...tile} />
              </div>
            ))}
            <div className="relative overflow-hidden col-span-2 flex items-center justify-center" style={{ height: "220px" }}>
              <div className="relative w-1/2 h-full">
                <FarmTile {...FARM_TILES[4]} />
              </div>
            </div>
            {FARM_TILES.slice(5, 9).map((tile, i) => (
              <div key={i + 5} className="relative overflow-hidden">
                <FarmTile {...tile} />
              </div>
            ))}
            <div className="relative overflow-hidden col-span-2 flex items-center justify-center" style={{ height: "220px" }}>
              <div className="relative w-1/2 h-full">
                <FarmTile {...FARM_TILES[9]} />
              </div>
            </div>
          </div>
        </div>

      </div>{/* end two-column */}
    </div>
  );
};

export default FarmAdd;
