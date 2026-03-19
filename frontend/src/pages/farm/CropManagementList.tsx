import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import usePageTitle from "../../hooks/usePageTitle";
import {
  useGetCropsQuery,
  useGetFarmsQuery,
  useDeleteCropMutation,
  type CropManagement,
} from "../../redux/apislices/userDashboardApiSlice";

const CropManagementList = () => {
  usePageTitle("Crop Management — VerdantIQ");
  const navigate = useNavigate();
  const [selectedFarmId, setSelectedFarmId] = useState<string>("");

  const { data: farmsPage } = useGetFarmsQuery({ per_page: 100 });
  const { data: cropsPage, isLoading, refetch } = useGetCropsQuery(
    { farm_id: selectedFarmId || undefined, per_page: 100 },
    { pollingInterval: 30_000 },
  );
  const [deleteCrop] = useDeleteCropMutation();

  const farms = farmsPage?.items ?? [];
  const crops = cropsPage?.items ?? [];

  const farmMap = Object.fromEntries(farms.map(f => [f.farm_id, f.farm_name]));

  const handleDelete = async (crop: CropManagement) => {
    if (!confirm(`Delete "${crop.crop_name}"?`)) return;
    try {
      await deleteCrop(crop.id).unwrap();
      toast.success("Crop deleted");
      refetch();
    } catch {
      toast.error("Failed to delete crop");
    }
  };

  const daysUntilHarvest = (dateStr: string | null) => {
    if (!dateStr) return null;
    const diff = new Date(dateStr).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="text-xs text-emerald-600 hover:text-emerald-700 font-medium mb-1 flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Farm Management
          </button>
          <h1 className="text-lg font-semibold text-gray-800">Crop Management</h1>
          <p className="text-sm text-gray-400 mt-0.5">All crops across your farms</p>
        </div>
        <Link
          to="/farm/crops/new"
          className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          + Add Crop
        </Link>
      </div>

      {/* Farm filter */}
      <div className="mb-4">
        <select
          value={selectedFarmId}
          onChange={e => setSelectedFarmId(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
        >
          <option value="">All farms</option>
          {farms.map(f => (
            <option key={f.farm_id} value={f.farm_id}>{f.farm_name}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-emerald-500 border-t-transparent" />
        </div>
      ) : crops.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
          <p className="text-sm text-gray-400 mb-3">No crops found. Add your first crop to start tracking.</p>
          <Link
            to="/farm/crops/new"
            className="text-xs text-emerald-600 hover:text-emerald-700 font-medium border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors"
          >
            + Add Crop
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {crops.map(crop => {
            const days = daysUntilHarvest(crop.expected_harvest_date);
            return (
              <div
                key={crop.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:border-emerald-200 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <Link
                      to={`/farm/crops/${crop.id}`}
                      className="text-sm font-semibold text-gray-800 hover:text-emerald-700 transition-colors"
                    >
                      {crop.crop_name}
                    </Link>
                    {crop.grain_type && (
                      <p className="text-xs text-gray-400 mt-0.5">{crop.grain_type}</p>
                    )}
                  </div>
                  {days !== null && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      days < 0 ? "bg-red-100 text-red-700" :
                      days <= 14 ? "bg-amber-100 text-amber-700" :
                      "bg-emerald-100 text-emerald-700"
                    }`}>
                      {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
                    </span>
                  )}
                </div>

                <div className="text-xs text-gray-500 space-y-1 mb-4">
                  <p>
                    <span className="text-gray-400">Farm:</span>{" "}
                    <span className="font-medium">{farmMap[crop.farm_id] ?? crop.farm_id}</span>
                  </p>
                  {crop.area_ha != null && (
                    <p><span className="text-gray-400">Area:</span> {crop.area_ha} ha</p>
                  )}
                  {crop.grains_planted != null && (
                    <p><span className="text-gray-400">Planted:</span> {crop.grains_planted.toLocaleString()} seeds</p>
                  )}
                  {crop.planting_date && (
                    <p>
                      <span className="text-gray-400">Planted:</span>{" "}
                      {new Date(crop.planting_date).toLocaleDateString(undefined, { dateStyle: "medium" })}
                    </p>
                  )}
                  {crop.expected_harvest_date && (
                    <p>
                      <span className="text-gray-400">Harvest:</span>{" "}
                      {new Date(crop.expected_harvest_date).toLocaleDateString(undefined, { dateStyle: "medium" })}
                    </p>
                  )}
                </div>

                {/* Live sensor indicators */}
                {(crop.avg_sunlight_hrs != null || crop.soil_ph != null || crop.soil_humidity != null) && (
                  <div className="flex gap-2 mb-3 flex-wrap">
                    {crop.avg_sunlight_hrs != null && (
                      <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                        ☀ {crop.avg_sunlight_hrs} hrs
                      </span>
                    )}
                    {crop.soil_ph != null && (
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                        pH {crop.soil_ph}
                      </span>
                    )}
                    {crop.soil_humidity != null && (
                      <span className="text-xs bg-cyan-50 text-cyan-700 px-2 py-0.5 rounded-full">
                        H₂O {crop.soil_humidity}%
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Link
                    to={`/farm/crops/${crop.id}`}
                    className="flex-1 text-center text-xs text-emerald-600 hover:text-emerald-700 font-medium border border-emerald-200 px-2 py-1 rounded-lg hover:bg-emerald-50 transition-colors"
                  >
                    View / Edit
                  </Link>
                  <button
                    onClick={() => handleDelete(crop)}
                    className="text-xs text-red-500 hover:text-red-600 font-medium border border-red-100 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CropManagementList;
