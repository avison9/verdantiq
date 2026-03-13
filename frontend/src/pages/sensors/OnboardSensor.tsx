import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import usePageTitle from "../../hooks/usePageTitle";
import { useGetMeQuery } from "../../redux/apislices/authApiSlice";
import { useCreateSensorMutation } from "../../redux/apislices/userDashboardApiSlice";

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

const OnboardSensor = () => {
  usePageTitle("Onboard Sensor — VerdantIQ");
  const navigate = useNavigate();
  const { data: me } = useGetMeQuery();
  const [createSensor, { isLoading }] = useCreateSensorMutation();

  const [form, setForm] = useState({
    sensor_name: "",
    sensor_type: "temperature",
    location: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!me) return;

    try {
      await createSensor({
        tenant_id: me.tenant_id,
        sensor_name: form.sensor_name.trim(),
        sensor_type: form.sensor_type,
        location: form.location.trim() || undefined,
      }).unwrap();

      toast.success(`Sensor "${form.sensor_name}" onboarded successfully`);
      navigate("/dashboard");
    } catch (err: any) {
      const msg = err?.data?.detail ?? "Failed to onboard sensor";
      toast.error(msg);
    }
  };

  const inputCls =
    "w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <Link
          to="/dashboard"
          className="text-gray-400 hover:text-gray-600 transition-colors"
          title="Back to dashboard"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <p className="text-xs text-gray-400">Dashboard / Sensors</p>
          <h1 className="text-base font-semibold text-gray-800">Onboard New Sensor</h1>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 flex items-start justify-center px-6 py-12">
        <div className="w-full max-w-lg">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Register an IoT sensor</h2>
            <p className="text-sm text-gray-500 mb-8">
              The sensor will appear in your dashboard immediately after registration.
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Sensor name */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Sensor name *
                </label>
                <input
                  required
                  name="sensor_name"
                  value={form.sensor_name}
                  onChange={handleChange}
                  placeholder="e.g. North Field Soil Probe 1"
                  className={inputCls}
                />
              </div>

              {/* Sensor type */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Sensor type *
                </label>
                <select
                  name="sensor_type"
                  value={form.sensor_type}
                  onChange={handleChange}
                  className={inputCls}
                >
                  {SENSOR_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Location <span className="normal-case font-normal text-gray-400">(optional)</span>
                </label>
                <input
                  name="location"
                  value={form.location}
                  onChange={handleChange}
                  placeholder="e.g. North Field, Zone 3"
                  className={inputCls}
                />
              </div>

              {/* Tenant (read-only) */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Organisation (tenant)
                </label>
                <div className="w-full border border-gray-100 rounded-lg px-4 py-3 text-sm text-gray-400 bg-gray-50">
                  Tenant ID: {me?.tenant_id ?? "—"}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold py-3 rounded-lg transition-colors"
                >
                  {isLoading ? "Registering…" : "Register Sensor"}
                </button>
                <Link
                  to="/dashboard"
                  className="px-6 py-3 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors text-center"
                >
                  Cancel
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardSensor;
