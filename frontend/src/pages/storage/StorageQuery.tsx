import usePageTitle from "../../hooks/usePageTitle";
import { useGetBillingQuery } from "../../redux/apislices/userDashboardApiSlice";
import { Link } from "react-router-dom";

const StorageQuery = () => {
  usePageTitle("Query — VerdantIQ");
  const { data: billing } = useGetBillingQuery();
  const billingActive = billing?.status === "active";

  return (
    <div className="px-6 py-8">
      <div className="mb-8">
        <h1 className="text-lg font-semibold text-gray-800">Query</h1>
        <p className="text-sm text-gray-400 mt-0.5">Query your sensor data with SQL via Trino</p>
      </div>

      {!billingActive && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-center gap-4 mb-6">
          <svg className="w-5 h-5 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">Active billing required</p>
            <p className="text-xs text-amber-600 mt-0.5">Set up billing to enable query access.</p>
          </div>
          <Link to="/billing/setup"
            className="text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg transition-colors">
            Setup Billing
          </Link>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">SQL Query Editor</p>
            <p className="text-xs text-gray-400">Powered by Trino + Apache Iceberg</p>
          </div>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 mb-4 min-h-[160px] flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 text-xs font-mono mb-1">-- SELECT * FROM iceberg.verdantiq.sensor_readings</p>
            <p className="text-gray-500 text-xs font-mono mb-1">-- WHERE tenant_id = 1</p>
            <p className="text-gray-500 text-xs font-mono">-- LIMIT 100;</p>
            <p className="text-gray-600 text-xs mt-4">Trino query engine integration coming soon</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button disabled
            className="bg-purple-600 text-white text-xs font-semibold px-4 py-2 rounded-lg opacity-40 cursor-not-allowed">
            Run Query
          </button>
          <button disabled
            className="border border-gray-200 text-gray-500 text-xs px-4 py-2 rounded-lg opacity-40 cursor-not-allowed">
            Query History
          </button>
        </div>
      </div>
    </div>
  );
};

export default StorageQuery;
