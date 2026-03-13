import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import usePageTitle from "../../hooks/usePageTitle";
import { useGetMeQuery } from "../../redux/apislices/authApiSlice";
import {
  useGetSensorsQuery,
  useRenameSensorMutation,
  useDeleteSensorMutation,
} from "../../redux/apislices/userDashboardApiSlice";

export const STATUS_STYLES: Record<string, string> = {
  pending:     "bg-orange-100 text-orange-600",
  active:      "bg-emerald-100 text-emerald-700",
  inactive:    "bg-gray-100 text-gray-500",
  error:       "bg-red-100 text-red-600",
  maintenance: "bg-yellow-100 text-yellow-700",
};

export const SENSOR_TYPE_ICONS: Record<string, string> = {
  temperature: "🌡️",
  humidity:    "💧",
  soil:        "🌱",
  weather:     "🌤️",
  pressure:    "🔵",
  light:       "☀️",
  co2:         "🌫️",
  flow:        "💦",
  default:     "📡",
};

export function sensorIcon(type: string) {
  return SENSOR_TYPE_ICONS[type.toLowerCase()] ?? SENSOR_TYPE_ICONS.default;
}

const PER_PAGE_OPTIONS = [5, 10, 20, 50] as const;

function buildPageRange(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  if (current > 3) pages.push("...");
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}

const SensorList = () => {
  usePageTitle("Sensors — VerdantIQ");
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<(typeof PER_PAGE_OPTIONS)[number]>(10);

  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Delete confirm state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: me } = useGetMeQuery();
  const { data, isLoading, isFetching } = useGetSensorsQuery(
    { tenant_id: me?.tenant_id ?? 0, page, per_page: perPage },
    { skip: !me },
  );
  const [renameSensor, { isLoading: isRenaming }] = useRenameSensorMutation();
  const [deleteSensor, { isLoading: isDeleting }] = useDeleteSensorMutation();

  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus();
  }, [renamingId]);

  const sensors   = data?.items ?? [];
  const total     = data?.total ?? 0;
  const totalPages = data?.pages ?? 1;
  const pageRange = buildPageRange(page, totalPages);

  const startRename = (id: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingId(id);
    setRenameValue(currentName);
    setDeletingId(null);
  };

  const commitRename = async (id: string) => {
    const trimmed = renameValue.trim();
    if (!trimmed) { setRenamingId(null); return; }
    const original = sensors.find((s) => s.sensor_id === id)?.sensor_name;
    if (trimmed === original) { setRenamingId(null); return; }
    try {
      await renameSensor({ sensor_id: id, sensor_name: trimmed }).unwrap();
      toast.success("Sensor renamed");
    } catch {
      toast.error("Failed to rename sensor");
    }
    setRenamingId(null);
  };

  const startDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(id);
    setRenamingId(null);
  };

  const confirmDelete = async (id: string) => {
    try {
      await deleteSensor(id).unwrap();
      toast.success("Sensor deleted");
      if (sensors.length === 1 && page > 1) setPage((p) => p - 1);
    } catch {
      toast.error("Failed to delete sensor");
    }
    setDeletingId(null);
  };

  return (
    <div className="px-6 py-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">Sensors</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {isLoading ? "Loading…" : `${total} registered device${total !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Link
          to="/sensors/onboard"
          className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          <span className="text-base leading-none">+</span>
          <span>Add Sensor</span>
        </Link>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        {isLoading ? (
          <div className="px-6 py-12 text-center text-sm text-gray-400">Loading sensors…</div>
        ) : sensors.length === 0 && total === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-gray-400 text-sm">No sensors registered yet.</p>
            <Link to="/sensors/onboard" className="mt-3 inline-block text-xs text-emerald-600 hover:text-emerald-700 font-medium">
              + Onboard your first sensor
            </Link>
          </div>
        ) : (
          <>
            <div className={`overflow-x-auto transition-opacity ${isFetching ? "opacity-60" : ""}`}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                    <th className="px-6 py-3 text-left">Sensor</th>
                    <th className="px-6 py-3 text-left">Type</th>
                    <th className="px-6 py-3 text-left">Location</th>
                    <th className="px-6 py-3 text-right">Messages</th>
                    <th className="px-6 py-3 text-left">Status</th>
                    <th className="px-6 py-3 text-left">Added</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sensors.map((s) => (
                    <tr
                      key={s.sensor_id}
                      onClick={() => {
                        if (!renamingId && !deletingId) navigate(`/sensors/${s.sensor_id}`);
                      }}
                      className={`transition-colors ${
                        renamingId === s.sensor_id || deletingId === s.sensor_id
                          ? "bg-gray-50"
                          : "hover:bg-gray-50 cursor-pointer"
                      }`}
                    >
                      {/* Name — inline rename */}
                      <td className="px-6 py-3 font-medium text-gray-800">
                        {renamingId === s.sensor_id ? (
                          <input
                            ref={renameInputRef}
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitRename(s.sensor_id);
                              if (e.key === "Escape") setRenamingId(null);
                            }}
                            onBlur={() => commitRename(s.sensor_id)}
                            onClick={(e) => e.stopPropagation()}
                            className="border border-emerald-400 rounded px-2 py-0.5 text-sm w-44 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            disabled={isRenaming}
                          />
                        ) : (
                          s.sensor_name
                        )}
                      </td>

                      <td className="px-6 py-3 text-gray-500">
                        <span className="mr-1">{sensorIcon(s.sensor_type)}</span>
                        {s.sensor_type}
                      </td>
                      <td className="px-6 py-3 text-gray-500">
                        {s.location ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-6 py-3 text-right text-gray-600">
                        {s.message_count.toLocaleString()}
                      </td>
                      <td className="px-6 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                          STATUS_STYLES[s.status] ?? "bg-gray-100 text-gray-500"
                        }`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-gray-400">
                        {new Date(s.created_at).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-3 text-right">
                        {deletingId === s.sensor_id ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="text-xs text-gray-500 mr-1">Delete?</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); confirmDelete(s.sensor_id); }}
                              disabled={isDeleting}
                              className="text-xs font-semibold text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded transition-colors disabled:opacity-50"
                            >
                              Yes
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeletingId(null); }}
                              className="text-xs font-medium text-gray-500 hover:text-gray-700 px-2 py-0.5 border border-gray-200 rounded transition-colors"
                            >
                              No
                            </button>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2">
                            <button
                              title="Rename sensor"
                              onClick={(e) => startRename(s.sensor_id, s.sensor_name, e)}
                              className="p-1 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button
                              title="Delete sensor"
                              onClick={(e) => startDelete(s.sensor_id, e)}
                              className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs"
                >‹</button>

                {pageRange.map((p, idx) =>
                  p === "..." ? (
                    <span key={`e-${idx}`} className="w-5 h-5 flex items-center justify-center text-gray-400 text-xs">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-5 h-5 flex items-center justify-center rounded-full text-xs font-medium transition-colors ${
                        p === page ? "bg-emerald-600 text-white" : "text-gray-500 hover:bg-gray-100"
                      }`}
                    >{p}</button>
                  )
                )}

                <button
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs"
                >›</button>
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>Rows per page</span>
                <select
                  value={perPage}
                  onChange={(e) => { setPerPage(Number(e.target.value) as typeof perPage); setPage(1); }}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  {PER_PAGE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SensorList;
