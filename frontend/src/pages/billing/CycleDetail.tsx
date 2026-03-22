import { useParams, Link } from "react-router-dom";
import usePageTitle from "../../hooks/usePageTitle";
import { useGetCycleDetailQuery } from "../../redux/apislices/userDashboardApiSlice";
import { useBillingRates } from "../../hooks/useBillingRates";

const CycleDetail = () => {
  usePageTitle("Cycle Breakdown — VerdantIQ");
  const { usagePeriod } = useParams<{ usagePeriod: string }>();
  const { data, isLoading } = useGetCycleDetailQuery(usagePeriod ?? "", { skip: !usagePeriod });
  const { storage_rate } = useBillingRates();

  const storageNote = `Billed at $${storage_rate}/GB/mo · see Running Cost for per-sensor breakdown`;

  return (
    <div className="px-6 py-8">
      {/* Back link */}
      <Link to="/billing/transactions"
        className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1 mb-1">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Transactions
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">Cycle Breakdown</h1>
          <p className="text-sm text-gray-400 mt-0.5">Period: {usagePeriod}</p>
        </div>
        {data && (
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Total Deducted</p>
            <p className="text-2xl font-bold text-red-600">−${data.cycle_amount.toFixed(4)}</p>
            {data.cycle_date && (
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(data.cycle_date).toLocaleDateString(undefined, { dateStyle: "medium" })}
              </p>
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="text-sm text-gray-400 py-16 text-center">Loading breakdown…</div>
      ) : !data ? (
        <div className="text-sm text-gray-400 py-16 text-center">No cycle data found for this period.</div>
      ) : (
        <div className="space-y-6">

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            {/* Messages */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Messages</p>
              <p className="text-xl font-bold text-blue-600">${data.message_cost.toFixed(4)}</p>
              <p className="text-xs text-gray-400 mt-1">{data.message_count.toLocaleString()} messages</p>
            </div>
            {/* Storage */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Storage</p>
              <p className="text-xl font-bold text-emerald-600">
                ${Math.max(0, data.cycle_amount - data.message_cost - data.query_total_cost).toFixed(4)}
              </p>
              <p className="text-xs text-gray-300 mt-1">{storageNote}</p>
            </div>
            {/* Queries */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Queries</p>
              <p className="text-xl font-bold text-purple-600">${data.query_total_cost.toFixed(4)}</p>
              <p className="text-xs text-gray-400 mt-1">
                {data.query_items.length} {data.query_items.length === 1 ? "query" : "queries"} · {data.query_total_qu.toFixed(2)} QU
              </p>
            </div>
          </div>

          {/* Per-query ledger */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-800">Query Charges</h2>
              <span className="text-xs text-gray-400">{data.query_items.length} records</span>
            </div>
            {data.query_items.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">No queries ran during this billing period.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Time</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Query</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wide">QU</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wide">Cost</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wide">Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.query_items.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-3 text-xs text-gray-400 whitespace-nowrap">
                          {new Date(item.created_at).toLocaleTimeString(undefined, {
                            hour: "2-digit", minute: "2-digit", second: "2-digit",
                          })}
                        </td>
                        <td className="px-6 py-3 text-xs font-mono text-gray-700 max-w-[320px] truncate">
                          {/* Strip "Query — X.XX QU · " prefix to show just the SQL */}
                          {item.description.replace(/^Query — [\d.]+ QU · /, "")}
                        </td>
                        <td className="px-6 py-3 text-right text-xs font-semibold text-amber-600">
                          {(item.data_points ?? 0).toFixed ? (item.data_points ?? 0) : 0} QU
                        </td>
                        <td className="px-6 py-3 text-right text-xs font-semibold text-red-500 tabular-nums">
                          −${item.amount.toFixed(4)}
                        </td>
                        <td className="px-6 py-3 text-right font-mono text-xs text-gray-400">
                          {item.reference}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-200 bg-gray-50">
                      <td colSpan={2} className="px-6 py-3 text-xs font-semibold text-gray-600">Total query charges</td>
                      <td className="px-6 py-3 text-right text-xs font-semibold text-amber-600">{data.query_total_qu.toFixed(2)} QU</td>
                      <td className="px-6 py-3 text-right text-xs font-bold text-red-600">−${data.query_total_cost.toFixed(4)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
};

export default CycleDetail;
