import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import usePageTitle from "../../hooks/usePageTitle";
import { useGetMeQuery } from "../../redux/apislices/authApiSlice";
import {
  useGetSensorsQuery,
  useRenameSensorMutation,
  useUpdateSensorMutation,
  useDeleteSensorMutation,
  type Sensor,
} from "../../redux/apislices/userDashboardApiSlice";

import { STATUS_STYLES, sensorIcon } from "./sensorUtils";

const DATA_SERVICE_URL = import.meta.env.VITE_DATA_SERVICE_URL ?? "http://localhost:8090";

const SENSOR_TYPES = [
  { value: "temperature", label: "🌡️  Temperature" },
  { value: "humidity",    label: "💧  Humidity" },
  { value: "soil",        label: "🌱  Soil Moisture" },
  { value: "weather",     label: "🌤️  Weather Station" },
  { value: "pressure",    label: "🔵  Pressure" },
  { value: "light",       label: "☀️  Light / PAR" },
  { value: "co2",         label: "🌫️  CO₂" },
  { value: "flow",        label: "💦  Water Flow" },
  { value: "other",       label: "📡  Other" },
];

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

// ── Full-edit modal ────────────────────────────────────────────────────────────

type EditForm = {
  sensor_name: string;
  sensor_type: string;
  location: string;
  latitude: string;
  longitude: string;
  manufacturer: string;
  model: string;
  serial_number: string;
  operating_system: string;
  power_type: string;
};

function EditModal({
  sensor,
  onClose,
  onSaved,
}: {
  sensor: Sensor;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [updateSensor, { isLoading }] = useUpdateSensorMutation();
  const meta = sensor.sensor_metadata ?? {};
  const str = (k: string) => (meta[k] != null ? String(meta[k]) : "");

  const [form, setForm] = useState<EditForm>({
    sensor_name:      sensor.sensor_name,
    sensor_type:      sensor.sensor_type,
    location:         sensor.location ?? "",
    latitude:         str("latitude"),
    longitude:        str("longitude"),
    manufacturer:     str("manufacturer"),
    model:            str("model"),
    serial_number:    str("serial_number"),
    operating_system: str("operating_system"),
    power_type:       str("power_type") || "ac",
  });

  const handle = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.sensor_name.trim()) {
      toast.error("Sensor name cannot be empty");
      return;
    }
    const lat = parseFloat(form.latitude);
    const lon = parseFloat(form.longitude);
    const sensor_metadata: Record<string, unknown> = { ...meta };
    if (!isNaN(lat)) sensor_metadata.latitude = lat;
    else delete sensor_metadata.latitude;
    if (!isNaN(lon)) sensor_metadata.longitude = lon;
    else delete sensor_metadata.longitude;

    try {
      await updateSensor({
        sensor_id:        sensor.sensor_id,
        sensor_name:      form.sensor_name.trim(),
        sensor_type:      form.sensor_type,
        location:         form.location.trim() || undefined,
        sensor_metadata:  Object.keys(sensor_metadata).length ? sensor_metadata : undefined,
        manufacturer:     form.manufacturer.trim()     || undefined,
        model:            form.model.trim()            || undefined,
        serial_number:    form.serial_number.trim()    || undefined,
        operating_system: form.operating_system.trim() || undefined,
        power_type:       form.power_type              || undefined,
      }).unwrap();
      toast.success("Sensor updated");
      onSaved();
    } catch {
      toast.error("Failed to update sensor");
    }
  };

  const inputCls =
    "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Edit Sensor</h2>
            <p className="text-xs text-gray-400 mt-0.5 font-mono">{sensor.sensor_id}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Sensor name *
            </label>
            <input required name="sensor_name" value={form.sensor_name} onChange={handle} className={inputCls} />
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Sensor type *
            </label>
            <select name="sensor_type" value={form.sensor_type} onChange={handle} className={inputCls}>
              {SENSOR_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Location <span className="normal-case font-normal text-gray-400">(optional)</span>
            </label>
            <input name="location" value={form.location} onChange={handle} placeholder="e.g. North Field, Zone 3" className={inputCls} />
          </div>

          {/* Coordinates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Latitude <span className="normal-case font-normal text-gray-400">(optional)</span>
              </label>
              <input type="number" step="any" name="latitude" value={form.latitude} onChange={handle} placeholder="e.g. 6.5244" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Longitude <span className="normal-case font-normal text-gray-400">(optional)</span>
              </label>
              <input type="number" step="any" name="longitude" value={form.longitude} onChange={handle} placeholder="e.g. 3.3792" className={inputCls} />
            </div>
          </div>

          {/* Hardware */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Manufacturer <span className="normal-case font-normal text-gray-400">(optional)</span>
              </label>
              <input name="manufacturer" value={form.manufacturer} onChange={handle} placeholder="e.g. Bosch" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Model <span className="normal-case font-normal text-gray-400">(optional)</span>
              </label>
              <input name="model" value={form.model} onChange={handle} placeholder="e.g. SHT31-D" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Serial Number <span className="normal-case font-normal text-gray-400">(optional)</span>
              </label>
              <input name="serial_number" value={form.serial_number} onChange={handle} placeholder="e.g. SN-00123456" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Operating System <span className="normal-case font-normal text-gray-400">(optional)</span>
              </label>
              <input name="operating_system" value={form.operating_system} onChange={handle} placeholder="e.g. FreeRTOS" className={inputCls} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Power Source
            </label>
            <select name="power_type" value={form.power_type} onChange={handle} className={inputCls}>
              <option value="ac">AC (mains power)</option>
              <option value="dc">DC (battery)</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
            >
              {isLoading ? "Saving…" : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const SensorList = () => {
  usePageTitle("Sensors — VerdantIQ");
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<(typeof PER_PAGE_OPTIONS)[number]>(10);
  const [search, setSearch] = useState("");

  // Inline rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Full edit modal state
  const [editingSensor, setEditingSensor] = useState<Sensor | null>(null);

  // Delete confirm state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: me } = useGetMeQuery();
  const { data, isLoading, isFetching } = useGetSensorsQuery(
    { tenant_id: me?.tenant_id ?? 0, page, per_page: perPage },
    { skip: !me, pollingInterval: 30_000 },
  );

  // Live message counts from Kafka watermarks — independent of terminal WebSocket
  const [liveCounts, setLiveCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const r = await fetch(`${DATA_SERVICE_URL}/sensors/message-counts`, {
          signal: AbortSignal.timeout(8000),
        });
        if (!r.ok) return;
        const body = await r.json() as { counts: Record<string, number> };
        setLiveCounts(prev => ({ ...prev, ...(body.counts ?? {}) }));
      } catch { /* ignore */ }
    };
    fetchCounts();
    const id = setInterval(fetchCounts, 30_000);
    return () => clearInterval(id);
  }, []);
  const [renameSensor, { isLoading: isRenaming }] = useRenameSensorMutation();
  const [deleteSensor, { isLoading: isDeleting }] = useDeleteSensorMutation();

  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus();
  }, [renamingId]);

  const allSensors = data?.items ?? [];
  const total      = data?.total ?? 0;
  const totalPages = data?.pages ?? 1;
  const pageRange  = buildPageRange(page, totalPages);

  const q = search.trim().toLowerCase();
  const sensors = q
    ? allSensors.filter(
        (s) =>
          s.sensor_name.toLowerCase().includes(q) ||
          s.sensor_type.toLowerCase().includes(q) ||
          (s.location ?? "").toLowerCase().includes(q),
      )
    : allSensors;

  const startRename = (id: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingId(id);
    setRenameValue(currentName);
    setDeletingId(null);
    setEditingSensor(null);
  };

  const commitRename = async (id: string) => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === sensors.find((s) => s.sensor_id === id)?.sensor_name) {
      setRenamingId(null);
      return;
    }
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
    setEditingSensor(null);
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

  const openEdit = (sensor: Sensor, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSensor(sensor);
    setRenamingId(null);
    setDeletingId(null);
  };

  return (
    <div className="px-6 py-8">
      {/* Full-edit modal */}
      {editingSensor && (
        <EditModal
          sensor={editingSensor}
          onClose={() => setEditingSensor(null)}
          onSaved={() => setEditingSensor(null)}
        />
      )}

      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">Sensors</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {isLoading ? "Loading…" : `${total} registered device${total !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search sensors…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white w-52"
            />
          </div>
          <Link
            to="/sensors/onboard"
            className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <span className="text-base leading-none">+</span>
            <span>Add Sensor</span>
          </Link>
        </div>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        {isLoading ? (
          <div className="px-6 py-12 text-center text-sm text-gray-400">Loading sensors…</div>
        ) : sensors.length === 0 ? (
          <div className="px-6 py-12 text-center">
            {q ? (
              <p className="text-gray-400 text-sm">No sensors match &ldquo;{search}&rdquo;.</p>
            ) : (
              <>
                <p className="text-gray-400 text-sm">No sensors registered yet.</p>
                <Link to="/sensors/onboard" className="mt-3 inline-block text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                  + Onboard your first sensor
                </Link>
              </>
            )}
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
                          <span className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <input
                              ref={renameInputRef}
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitRename(s.sensor_id);
                                if (e.key === "Escape") setRenamingId(null);
                              }}
                              className="border border-emerald-400 rounded px-2 py-0.5 text-sm w-40 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              disabled={isRenaming}
                            />
                            {/* ✓ Save */}
                            <button
                              onClick={() => commitRename(s.sensor_id)}
                              disabled={isRenaming}
                              title="Save"
                              className="p-0.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors disabled:opacity-40"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                            {/* ✗ Cancel */}
                            <button
                              onClick={() => setRenamingId(null)}
                              title="Cancel"
                              className="p-0.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </span>
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
                        {(liveCounts[s.sensor_id] ?? s.message_count).toLocaleString()}
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
                            {/* Rename — name only */}
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
                            {/* Edit all fields */}
                            <button
                              title="Edit sensor details"
                              onClick={(e) => openEdit(s, e)}
                              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            {/* Delete */}
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
