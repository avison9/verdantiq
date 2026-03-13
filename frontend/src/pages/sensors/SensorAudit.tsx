import { useState } from "react";
import usePageTitle from "../../hooks/usePageTitle";
import { useGetSensorAuditQuery } from "../../redux/apislices/userDashboardApiSlice";

const PER_PAGE_OPTIONS = [10, 20, 50] as const;

const ACTION_STYLES: Record<string, string> = {
  created:        "bg-emerald-100 text-emerald-700",
  renamed:        "bg-blue-100 text-blue-700",
  deleted:        "bg-red-100 text-red-600",
  status_changed: "bg-orange-100 text-orange-600",
};

const ACTION_ICONS: Record<string, string> = {
  created:        "＋",
  renamed:        "✎",
  deleted:        "✕",
  status_changed: "⟳",
};

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

function formatDetails(action: string, details: Record<string, unknown> | null): string {
  if (!details) return "—";
  if (action === "renamed") {
    return `"${details.old_name}" → "${details.new_name}"`;
  }
  if (action === "status_changed") {
    return `${details.old_status} → ${details.new_status}`;
  }
  if (action === "created") {
    const parts: string[] = [];
    if (details.sensor_type) parts.push(`type: ${details.sensor_type}`);
    if (details.location)    parts.push(`location: ${details.location}`);
    return parts.join(", ") || "—";
  }
  if (action === "deleted") {
    const parts: string[] = [];
    if (details.sensor_type) parts.push(`type: ${details.sensor_type}`);
    if (details.location)    parts.push(`location: ${details.location}`);
    return parts.join(", ") || "—";
  }
  return JSON.stringify(details);
}

const SensorAudit = () => {
  usePageTitle("Sensor Audit Trail — VerdantIQ");

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<(typeof PER_PAGE_OPTIONS)[number]>(20);

  const { data, isLoading, isFetching } = useGetSensorAuditQuery({ page, per_page: perPage });

  const entries    = data?.items ?? [];
  const total      = data?.total ?? 0;
  const totalPages = data?.pages ?? 1;
  const pageRange  = buildPageRange(page, totalPages);

  return (
    <div className="px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-lg font-semibold text-gray-800">Sensor Audit Trail</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {isLoading ? "Loading…" : `${total} event${total !== 1 ? "s" : ""} recorded`}
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        {isLoading ? (
          <div className="py-16 text-center text-sm text-gray-400">Loading audit log…</div>
        ) : entries.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-gray-400 text-sm">No audit events yet.</p>
            <p className="text-xs text-gray-300 mt-1">Sensor creation, rename, and deletion will appear here.</p>
          </div>
        ) : (
          <>
            <div className={`overflow-x-auto transition-opacity ${isFetching ? "opacity-60" : ""}`}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                    <th className="px-6 py-3 text-left">Time</th>
                    <th className="px-6 py-3 text-left">Action</th>
                    <th className="px-6 py-3 text-left">Sensor</th>
                    <th className="px-6 py-3 text-left">Details</th>
                    <th className="px-6 py-3 text-right">By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {entries.map((e) => (
                    <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3 text-gray-400 whitespace-nowrap text-xs">
                        {new Date(e.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${
                          ACTION_STYLES[e.action] ?? "bg-gray-100 text-gray-500"
                        }`}>
                          <span>{ACTION_ICONS[e.action] ?? "•"}</span>
                          {e.action.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-gray-700 font-medium">
                        {e.sensor_name}
                        {e.sensor_id && (
                          <span className="block text-xs text-gray-400 font-mono mt-0.5">
                            {e.sensor_id.slice(0, 8)}…
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-gray-500 text-xs max-w-xs truncate">
                        {formatDetails(e.action, e.details)}
                      </td>
                      <td className="px-6 py-3 text-right text-gray-500 text-xs">
                        {e.performed_by_name ?? `#${e.performed_by}`}
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

export default SensorAudit;
