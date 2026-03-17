import { useParams, useNavigate, Link } from "react-router-dom";
import usePageTitle from "../../hooks/usePageTitle";
import { useGetFarmQuery, useGetSensorsQuery } from "../../redux/apislices/userDashboardApiSlice";
import { useGetMeQuery } from "../../redux/apislices/authApiSlice";

const FarmDetail = () => {
  usePageTitle("Farm Detail — VerdantIQ");
  const { farmId } = useParams<{ farmId: string }>();
  const navigate = useNavigate();

  const { data: me } = useGetMeQuery();
  const { data: farm, isLoading } = useGetFarmQuery(farmId!, { skip: !farmId });
  const { data: sensorsPage } = useGetSensorsQuery(
    { tenant_id: me?.tenant_id ?? 0, per_page: 100 },
    { skip: !me },
  );

  const farmSensors = (sensorsPage?.items ?? []).filter(s => s.farm_id === farmId);

  const farmTypeLabel: Record<string, string> = {
    open_field: "Open Field",
    greenhouse: "Greenhouse",
    mixed: "Mixed",
    hydroponic: "Hydroponic",
    aquaponic: "Aquaponic",
  };

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-4 border-emerald-500 border-t-transparent" />
    </div>
  );

  if (!farm) return (
    <div className="px-6 py-8">
      <p className="text-sm text-gray-400">Farm not found.</p>
      <button onClick={() => navigate(-1)} className="mt-3 text-emerald-600 text-sm font-medium">← Back</button>
    </div>
  );

  const StatRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex justify-between items-baseline py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-sm text-gray-700 font-medium">{value ?? "—"}</span>
    </div>
  );

  return (
    <div className="px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <button onClick={() => navigate(-1)} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium mb-1 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Farm Management
          </button>
          <h1 className="text-lg font-semibold text-gray-800">{farm.farm_name}</h1>
          {farm.farm_type && (
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full capitalize">
              {farmTypeLabel[farm.farm_type] ?? farm.farm_type}
            </span>
          )}
        </div>
        <Link to={`/farm/add`}
          className="text-xs text-emerald-600 hover:text-emerald-700 font-medium border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors">
          Edit farm
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Key Info */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">Details</h2>
          <StatRow label="Farm size" value={farm.farm_size_ha ? `${farm.farm_size_ha} ha` : null} />
          <StatRow label="Perimeter" value={farm.perimeter_km ? `${farm.perimeter_km} km` : null} />
          <StatRow label="Soil type" value={farm.soil_type} />
          <StatRow label="Avg rainfall" value={farm.rainfall_avg_mm ? `${farm.rainfall_avg_mm} mm/yr` : null} />
          <StatRow label="Avg sunlight" value={farm.sunlight_avg_hrs ? `${farm.sunlight_avg_hrs} hrs/day` : null} />
          <StatRow label="Added" value={new Date(farm.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })} />
        </div>

        {/* Location */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">Location</h2>
          <StatRow label="Country" value={farm.country} />
          <StatRow label="Address" value={farm.address} />
          <StatRow label="Coordinates" value={
            farm.latitude != null && farm.longitude != null
              ? `${farm.latitude.toFixed(4)}, ${farm.longitude.toFixed(4)}`
              : null
          } />
          {farm.notes && (
            <div className="mt-3 pt-3 border-t border-gray-50">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Notes</p>
              <p className="text-sm text-gray-600">{farm.notes}</p>
            </div>
          )}
        </div>

        {/* Crops */}
        {farm.crops && farm.crops.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Current Crops</h2>
            <div className="flex flex-wrap gap-2">
              {farm.crops.map(crop => (
                <span key={crop} className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full">{crop}</span>
              ))}
            </div>
          </div>
        )}

        {/* Crop History */}
        {farm.crop_history && farm.crop_history.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Crop History</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-2 text-left text-xs text-gray-400 font-medium">Year</th>
                  <th className="pb-2 text-left text-xs text-gray-400 font-medium">Crops</th>
                  <th className="pb-2 text-right text-xs text-gray-400 font-medium">Yield (t)</th>
                </tr>
              </thead>
              <tbody>
                {farm.crop_history.map((h, i) => (
                  <tr key={i} className="border-b border-gray-50 last:border-0">
                    <td className="py-2 text-gray-700">{String(h.year ?? "")}</td>
                    <td className="py-2 text-gray-600">
                      {Array.isArray(h.crops) ? (h.crops as string[]).join(", ") : String(h.crops ?? "")}
                    </td>
                    <td className="py-2 text-right text-gray-600">{h.yield_tons != null ? String(h.yield_tons) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Sensors on this farm */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-800">Sensors ({farmSensors.length})</h2>
            <Link to="/sensors/onboard" className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">+ Add sensor</Link>
          </div>
          {farmSensors.length === 0 ? (
            <p className="text-xs text-gray-400">No sensors assigned to this farm. Assign sensors from the Add Sensor page.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="pb-2 text-left text-xs text-gray-400 font-medium">Sensor</th>
                    <th className="pb-2 text-left text-xs text-gray-400 font-medium">Type</th>
                    <th className="pb-2 text-left text-xs text-gray-400 font-medium">Status</th>
                    <th className="pb-2 text-right text-xs text-gray-400 font-medium">Messages</th>
                  </tr>
                </thead>
                <tbody>
                  {farmSensors.map(s => (
                    <tr key={s.sensor_id} className="border-b border-gray-50 last:border-0">
                      <td className="py-2">
                        <Link to={`/sensors/${s.sensor_id}`} className="text-emerald-600 hover:text-emerald-700 font-medium">
                          {s.sensor_name}
                        </Link>
                      </td>
                      <td className="py-2 text-gray-500 capitalize">{s.sensor_type}</td>
                      <td className="py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                          s.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                        }`}>{s.status}</span>
                      </td>
                      <td className="py-2 text-right text-gray-600">{s.message_count.toLocaleString()}</td>
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

export default FarmDetail;
