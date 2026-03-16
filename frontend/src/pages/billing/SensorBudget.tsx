import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import usePageTitle from "../../hooks/usePageTitle";
import { useGetMeQuery } from "../../redux/apislices/authApiSlice";
import {
  useGetSensorsQuery,
  useUpdateSensorMutation,
  useGetBillingQuery,
  type Sensor,
} from "../../redux/apislices/userDashboardApiSlice";
import { sensorIcon } from "../sensors/sensorUtils";

const COST_PER_MESSAGE = 0.0005;
const DATA_SERVICE_URL = import.meta.env.VITE_DATA_SERVICE_URL ?? "http://localhost:8090";

// ── Budget editor row ─────────────────────────────────────────────────────────

function BudgetRow({
  sensor,
  liveCount,
  onSaved,
}: { sensor: Sensor; liveCount: number | undefined; onSaved: () => void }) {
  const [updateSensor, { isLoading }] = useUpdateSensorMutation();
  const currentBudget = sensor.sensor_metadata?.budget != null
    ? String(sensor.sensor_metadata.budget)
    : "";
  const [editing,  setEditing]  = useState(false);
  const [value,    setValue]    = useState(currentBudget);

  const msgCount    = liveCount ?? sensor.message_count;
  const runningCost = msgCount * COST_PER_MESSAGE;
  const budgetNum   = currentBudget ? parseFloat(currentBudget) : null;
  const pct         = budgetNum && budgetNum > 0 ? (runningCost / budgetNum) * 100 : null;

  const handleSave = async () => {
    const parsed = parseFloat(value);
    if (value !== "" && (isNaN(parsed) || parsed <= 0)) {
      toast.error("Budget must be a positive number or empty to remove.");
      return;
    }
    try {
      await updateSensor({
        sensor_id:       sensor.sensor_id,
        sensor_metadata: {
          ...(sensor.sensor_metadata ?? {}),
          budget: value === "" ? null : parsed,
        },
      }).unwrap();
      toast.success(value === "" ? "Budget removed" : `Budget set to $${parsed.toFixed(2)}`);
      setEditing(false);
      onSaved();
    } catch {
      toast.error("Failed to save budget");
    }
  };

  const handleClear = async () => {
    try {
      await updateSensor({
        sensor_id:       sensor.sensor_id,
        sensor_metadata: { ...(sensor.sensor_metadata ?? {}), budget: null },
      }).unwrap();
      toast.success("Budget cleared");
      onSaved();
    } catch {
      toast.error("Failed to clear budget");
    }
  };

  const handleCancel = () => {
    setValue(currentBudget);
    setEditing(false);
  };

  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">{sensorIcon(sensor.sensor_type)}</span>
          <div>
            <p className="text-sm font-medium text-gray-800">{sensor.sensor_name}</p>
            <p className="text-xs text-gray-400 capitalize">{sensor.sensor_type}</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 text-sm font-semibold text-purple-600 text-right">
        ${runningCost.toFixed(4)}
      </td>
      <td className="px-6 py-4 text-right">
        {budgetNum !== null ? (
          <div className="flex flex-col items-end gap-1">
            <span className={`text-sm font-semibold ${
              pct && pct >= 100 ? "text-red-600" : pct && pct >= 80 ? "text-orange-500" : "text-gray-700"
            }`}>
              ${budgetNum.toFixed(2)}
            </span>
            {pct !== null && (
              <div className="flex items-center gap-2">
                <div className="w-20 bg-gray-100 rounded-full h-1">
                  <div
                    className={`h-1 rounded-full ${pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-orange-400" : "bg-emerald-500"}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
                <span className={`text-xs ${pct >= 100 ? "text-red-500" : "text-gray-400"}`}>
                  {pct.toFixed(0)}%
                </span>
              </div>
            )}
          </div>
        ) : (
          <span className="text-xs text-gray-300">Not set</span>
        )}
      </td>
      <td className="px-6 py-4">
        {editing ? (
          <div className="flex items-center gap-2 justify-end">
            <div className="relative">
              <span className="absolute inset-y-0 left-2 flex items-center text-gray-400 text-xs">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0.00"
                className="border border-gray-200 rounded-lg pl-5 pr-2 py-1 text-xs w-24 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                  if (e.key === "Escape") handleCancel();
                }}
              />
            </div>
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 border border-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
            >
              {budgetNum !== null ? "Edit" : "Set budget"}
            </button>
            {budgetNum !== null && (
              <button
                onClick={handleClear}
                disabled={isLoading}
                className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors disabled:opacity-50"
              >
                Clear
              </button>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const SensorBudget = () => {
  usePageTitle("Sensor Budgets — VerdantIQ");

  const { data: me }      = useGetMeQuery();
  const { data: billing } = useGetBillingQuery();
  const { data: sensorsPage, isLoading, refetch } = useGetSensorsQuery(
    { tenant_id: me?.tenant_id ?? 0, per_page: 100 },
    { skip: !me },
  );

  // Live message counts from Kafka watermarks
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

  const sensors = sensorsPage?.items ?? [];

  const totalCost      = sensors.reduce((s, x) => s + (liveCounts[x.sensor_id] ?? x.message_count) * COST_PER_MESSAGE, 0);
  const balance        = billing?.balance ?? 0;
  const sensorsOverBudget = sensors.filter(s => {
    const b = s.sensor_metadata?.budget;
    if (!b) return false;
    return (liveCounts[s.sensor_id] ?? s.message_count) * COST_PER_MESSAGE >= parseFloat(String(b));
  });

  return (
    <div className="px-6 py-8">
      <div className="mb-8">
        <h1 className="text-lg font-semibold text-gray-800">Sensor Budgets</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Set spending limits per sensor. A sensor auto-deactivates when its running cost reaches the budget.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Account Balance</p>
          <p className="text-xl font-bold text-gray-800">${balance.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Cost (all sensors)</p>
          <p className="text-xl font-bold text-purple-600">${totalCost.toFixed(4)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Sensors</p>
          <p className="text-xl font-bold text-blue-600">{sensors.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Over Budget</p>
          <p className={`text-xl font-bold ${sensorsOverBudget.length > 0 ? "text-red-600" : "text-emerald-600"}`}>
            {sensorsOverBudget.length}
          </p>
        </div>
      </div>

      {/* Budget info banner */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 text-sm text-blue-800 max-w-3xl">
        <p className="font-medium mb-1">How budgets work</p>
        <ul className="list-disc list-inside space-y-1 text-xs text-blue-700">
          <li>Budget = max USD a sensor can spend (messages × $0.0005/msg)</li>
          <li>When running cost reaches the budget, the sensor is automatically deactivated</li>
          <li>Sensors without a budget are billed from the tenant account balance</li>
          <li>If tenant balance runs out, all budget-less sensors are disconnected</li>
        </ul>
      </div>

      {/* Sensors table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        {isLoading ? (
          <div className="px-6 py-12 text-center text-sm text-gray-400">Loading sensors…</div>
        ) : sensors.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-400">No sensors found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                  <th className="px-6 py-3 text-left">Sensor</th>
                  <th className="px-6 py-3 text-right">Running Cost</th>
                  <th className="px-6 py-3 text-right">Budget</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sensors.map((s) => (
                  <BudgetRow key={s.sensor_id} sensor={s} liveCount={liveCounts[s.sensor_id]} onSaved={refetch} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SensorBudget;
