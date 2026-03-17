import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import usePageTitle from "../../hooks/usePageTitle";
import {
  useGetFarmsQuery,
  useDeleteFarmMutation,
  useUpdateFarmMutation,
  type Farm,
} from "../../redux/apislices/userDashboardApiSlice";

const FarmList = () => {
  usePageTitle("Farm Management — VerdantIQ");
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  const { data: farmsPage, isLoading, refetch } = useGetFarmsQuery({ page, per_page: 20 });
  const [deleteFarm, { isLoading: deleting }] = useDeleteFarmMutation();
  const [updateFarm] = useUpdateFarmMutation();

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const farms = farmsPage?.items ?? [];
  const total = farmsPage?.total ?? 0;
  const pages = farmsPage?.pages ?? 1;

  const startRename = (farm: Farm) => {
    setRenamingId(farm.farm_id);
    setRenameVal(farm.farm_name);
  };

  const submitRename = async (farmId: string) => {
    if (!renameVal.trim()) return;
    try {
      await updateFarm({ farm_id: farmId, farm_name: renameVal.trim() }).unwrap();
      toast.success("Farm renamed");
    } catch {
      toast.error("Failed to rename farm");
    } finally {
      setRenamingId(null);
    }
  };

  const handleDelete = async (farmId: string) => {
    try {
      await deleteFarm(farmId).unwrap();
      toast.success("Farm deleted");
      setConfirmDeleteId(null);
    } catch {
      toast.error("Failed to delete farm");
    }
  };

  const farmTypeLabel: Record<string, string> = {
    open_field: "Open Field",
    greenhouse: "Greenhouse",
    mixed: "Mixed",
    hydroponic: "Hydroponic",
    aquaponic: "Aquaponic",
  };

  return (
    <div className="px-6 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">Farm Management</h1>
          <p className="text-sm text-gray-400 mt-0.5">{total} farm{total !== 1 ? "s" : ""} registered</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => refetch()}
            className="p-2 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-300 transition-colors"
            title="Refresh">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <Link to="/farm/add"
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            <span className="text-base leading-none">+</span> Add Farm
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-emerald-500 border-t-transparent" />
        </div>
      ) : farms.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-20 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm font-medium">No farms registered yet</p>
          <p className="text-gray-400 text-xs mt-1">Add your first farm to get started</p>
          <Link to="/farm/add"
            className="mt-4 inline-block text-sm text-emerald-600 hover:text-emerald-700 font-medium">
            + Register a farm →
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Farm</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Size</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Crops</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Added</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {farms.map(farm => (
                <tr key={farm.farm_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3">
                    {renamingId === farm.farm_id ? (
                      <div className="flex items-center gap-2">
                        <input
                          value={renameVal}
                          onChange={e => setRenameVal(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter") submitRename(farm.farm_id);
                            if (e.key === "Escape") setRenamingId(null);
                          }}
                          autoFocus
                          className="border border-emerald-400 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <button onClick={() => submitRename(farm.farm_id)}
                          className="text-xs text-emerald-600 font-semibold hover:text-emerald-700">Save</button>
                        <button onClick={() => setRenamingId(null)}
                          className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => navigate(`/farm/${farm.farm_id}`)}
                        className="text-sm font-medium text-gray-800 hover:text-emerald-700 text-left">
                        {farm.farm_name}
                      </button>
                    )}
                  </td>
                  <td className="px-6 py-3 text-gray-500 capitalize">
                    {farmTypeLabel[farm.farm_type ?? ""] ?? farm.farm_type ?? "—"}
                  </td>
                  <td className="px-6 py-3 text-gray-500">
                    {farm.farm_size_ha ? `${farm.farm_size_ha} ha` : "—"}
                  </td>
                  <td className="px-6 py-3">
                    {farm.crops && farm.crops.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {farm.crops.slice(0, 3).map(c => (
                          <span key={c} className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">{c}</span>
                        ))}
                        {farm.crops.length > 3 && (
                          <span className="text-xs text-gray-400">+{farm.crops.length - 3}</span>
                        )}
                      </div>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-6 py-3 text-gray-500 text-xs">
                    {[farm.address, farm.country].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-6 py-3 text-gray-400 text-xs">
                    {new Date(farm.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => navigate(`/farm/${farm.farm_id}`)}
                        className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">View</button>
                      <button onClick={() => startRename(farm)}
                        className="text-xs text-gray-500 hover:text-gray-700 font-medium">Rename</button>
                      {confirmDeleteId === farm.farm_id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDelete(farm.farm_id)} disabled={deleting}
                            className="text-xs text-red-600 hover:text-red-700 font-semibold">Confirm</button>
                          <button onClick={() => setConfirmDeleteId(null)}
                            className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDeleteId(farm.farm_id)}
                          className="text-xs text-gray-400 hover:text-red-500 transition-colors">Delete</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {pages > 1 && (
            <div className="px-6 py-3 border-t border-gray-50 flex items-center justify-between">
              <p className="text-xs text-gray-400">{total} farms total</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                  className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
                  Previous
                </button>
                <span className="text-xs text-gray-500">Page {page} of {pages}</span>
                <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages}
                  className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FarmList;
