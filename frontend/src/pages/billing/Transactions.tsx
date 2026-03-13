import { useState } from "react";
import usePageTitle from "../../hooks/usePageTitle";
import { useGetTransactionsQuery } from "../../redux/apislices/userDashboardApiSlice";
import type { Transaction } from "../../redux/apislices/userDashboardApiSlice";

const PER_PAGE_OPTIONS = [10, 20, 50, 100] as const;

// ── Pagination helper ────────────────────────────────────────────────────────

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

// ── Transaction Detail Modal ─────────────────────────────────────────────────

function TransactionDetail({
  tx,
  onClose,
}: {
  tx: Transaction;
  onClose: () => void;
}) {
  const isCredit = tx.type === "credit";
  const date = new Date(tx.created_at).toLocaleString();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
              Transaction detail
            </p>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                  isCredit
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-red-100 text-red-600"
                }`}
              >
                {isCredit ? "↑ Credit" : "↓ Debit"}
              </span>
              <span className="text-lg font-bold text-gray-800">
                {isCredit ? "+" : "-"}${tx.amount.toFixed(2)}
              </span>
            </div>
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

        {/* Fields */}
        <dl className="space-y-3 text-sm">
          <Row label="Description" value={tx.description} />
          <Row label="Date" value={date} />
          <Row label="Balance after" value={`$${tx.balance_after.toFixed(2)}`} />
          {tx.reference && <Row label="Reference" value={tx.reference} mono />}

          {isCredit && (
            <>
              {tx.payment_method && (
                <Row label="Payment method" value={tx.payment_method} />
              )}
              {tx.card_brand && tx.card_last4 && (
                <Row label="Card" value={`${tx.card_brand} ending ****${tx.card_last4}`} />
              )}
            </>
          )}

          {!isCredit && (
            <>
              {tx.sensor_name && <Row label="Sensor" value={tx.sensor_name} />}
              {tx.usage_period && <Row label="Usage period" value={tx.usage_period} />}
              {tx.data_points != null && (
                <Row label="Data points" value={tx.data_points.toLocaleString()} />
              )}
            </>
          )}
        </dl>

        <button
          onClick={onClose}
          className="mt-6 w-full py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-400 shrink-0">{label}</dt>
      <dd className={`text-gray-800 text-right ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

const Transactions = () => {
  usePageTitle("Transactions — VerdantIQ");

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<(typeof PER_PAGE_OPTIONS)[number]>(20);
  const [selected, setSelected] = useState<Transaction | null>(null);

  const { data, isLoading, isFetching } = useGetTransactionsQuery({
    page,
    per_page: perPage,
  });

  const transactions = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = (data?.pages ?? Math.ceil(total / perPage)) || 1;
  const pageRange = buildPageRange(page, totalPages);

  const handlePerPageChange = (v: number) => {
    setPerPage(v as (typeof PER_PAGE_OPTIONS)[number]);
    setPage(1);
  };

  return (
    <div className="px-6 py-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">Transactions</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {total > 0 ? `${total} transaction${total !== 1 ? "s" : ""}` : "Billing history"}
          </p>
        </div>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        {isLoading ? (
          <div className="py-16 text-center text-sm text-gray-400">Loading transactions…</div>
        ) : transactions.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-gray-400 text-sm">No transactions yet.</p>
            <p className="text-xs text-gray-300 mt-1">
              Top up your account to see billing activity here.
            </p>
          </div>
        ) : (
          <>
            <div className={`overflow-x-auto transition-opacity ${isFetching ? "opacity-60" : ""}`}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                    <th className="px-6 py-3 text-left">Date</th>
                    <th className="px-6 py-3 text-left">Type</th>
                    <th className="px-6 py-3 text-left">Description</th>
                    <th className="px-6 py-3 text-right">Amount</th>
                    <th className="px-6 py-3 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {transactions.map((tx) => {
                    const isCredit = tx.type === "credit";
                    return (
                      <tr
                        key={tx.id}
                        onClick={() => setSelected(tx)}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-3 text-gray-400 whitespace-nowrap">
                          {new Date(tx.created_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-6 py-3">
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                              isCredit
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-red-100 text-red-600"
                            }`}
                          >
                            {isCredit ? "↑" : "↓"} {isCredit ? "Credit" : "Debit"}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-gray-700 max-w-[240px] truncate">
                          {tx.description}
                        </td>
                        <td
                          className={`px-6 py-3 text-right font-semibold tabular-nums ${
                            isCredit ? "text-emerald-600" : "text-red-500"
                          }`}
                        >
                          {isCredit ? "+" : "-"}${tx.amount.toFixed(2)}
                        </td>
                        <td className="px-6 py-3 text-right text-gray-500 tabular-nums">
                          ${tx.balance_after.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination row */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-4 flex-wrap">
              {/* Page buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Prev */}
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs"
                >
                  ‹
                </button>

                {pageRange.map((p, idx) =>
                  p === "..." ? (
                    <span
                      key={`ellipsis-${idx}`}
                      className="w-7 h-7 flex items-center justify-center text-gray-400 text-xs select-none"
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-medium transition-colors ${
                        p === page
                          ? "bg-emerald-600 text-white"
                          : "text-gray-500 hover:bg-gray-100"
                      }`}
                    >
                      {p}
                    </button>
                  ),
                )}

                {/* Next */}
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs"
                >
                  ›
                </button>
              </div>

              {/* Per-page dropdown */}
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>Rows per page</span>
                <select
                  value={perPage}
                  onChange={(e) => handlePerPageChange(Number(e.target.value))}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  {PER_PAGE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <TransactionDetail tx={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
};

export default Transactions;
