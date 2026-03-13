import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import usePageTitle from "../../hooks/usePageTitle";
import { useGetMeQuery } from "../../redux/apislices/authApiSlice";
import { useCreateSensorMutation, useGetBillingQuery } from "../../redux/apislices/userDashboardApiSlice";

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
  const { data: billing } = useGetBillingQuery(undefined, { skip: !me });
  const [createSensor, { isLoading }] = useCreateSensorMutation();

  const [form, setForm] = useState({
    sensor_name: "",
    sensor_type: "temperature",
    location: "",
    latitude: "",
    longitude: "",
    manufacturer: "",
    model: "",
    serial_number: "",
    operating_system: "",
    power_type: "ac",
  });

  const billingActive = billing?.status === "active";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!me) return;

    if (!billingActive) {
      toast.error("Please activate billing before onboarding a sensor.");
      navigate("/billing/setup");
      return;
    }

    try {
      const lat = parseFloat(form.latitude);
      const lon = parseFloat(form.longitude);
      const sensor_metadata: Record<string, unknown> = {};
      if (!isNaN(lat)) sensor_metadata.latitude = lat;
      if (!isNaN(lon)) sensor_metadata.longitude = lon;

      await createSensor({
        tenant_id: me.tenant_id,
        sensor_name: form.sensor_name.trim(),
        sensor_type: form.sensor_type,
        location: form.location.trim() || undefined,
        sensor_metadata: Object.keys(sensor_metadata).length ? sensor_metadata : undefined,
        manufacturer:     form.manufacturer.trim()     || undefined,
        model:            form.model.trim()            || undefined,
        serial_number:    form.serial_number.trim()    || undefined,
        operating_system: form.operating_system.trim() || undefined,
        power_type:       form.power_type              || undefined,
      }).unwrap();

      toast.success(`Sensor "${form.sensor_name}" onboarded successfully`);
      navigate("/sensors/list");
    } catch (err) {
      const msg = (err as { data?: { detail?: string } })?.data?.detail ?? "Failed to onboard sensor";
      toast.error(msg);
    }
  };

  const inputCls =
    "w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition";

  return (
    <div className="px-6 py-8">
      {/* Page header */}
      <div className="mb-8">
        <p className="text-xs text-gray-400 mb-0.5">Sensors / Add</p>
        <h1 className="text-lg font-semibold text-gray-800">Onboard New Sensor</h1>
      </div>

      {!billingActive && (
        <div className="mb-6 max-w-lg bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-sm text-amber-800">
          Billing must be active before you can add sensors.{" "}
          <button
            type="button"
            onClick={() => navigate("/billing/setup")}
            className="underline font-medium"
          >
            Setup billing
          </button>
        </div>
      )}

      <div className="max-w-lg">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-base font-bold text-gray-900 mb-1">Register an IoT sensor</h2>
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

            {/* Coordinates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Latitude <span className="normal-case font-normal text-gray-400">(optional)</span>
                </label>
                <input
                  type="number"
                  step="any"
                  name="latitude"
                  value={form.latitude}
                  onChange={handleChange}
                  placeholder="e.g. 6.5244"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Longitude <span className="normal-case font-normal text-gray-400">(optional)</span>
                </label>
                <input
                  type="number"
                  step="any"
                  name="longitude"
                  value={form.longitude}
                  onChange={handleChange}
                  placeholder="e.g. 3.3792"
                  className={inputCls}
                />
              </div>
            </div>

            {/* Hardware details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Manufacturer <span className="normal-case font-normal text-gray-400">(optional)</span>
                </label>
                <input name="manufacturer" value={form.manufacturer} onChange={handleChange}
                  placeholder="e.g. Bosch, Sensirion" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Model <span className="normal-case font-normal text-gray-400">(optional)</span>
                </label>
                <input name="model" value={form.model} onChange={handleChange}
                  placeholder="e.g. SHT31-D" className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Serial Number <span className="normal-case font-normal text-gray-400">(optional)</span>
                </label>
                <input name="serial_number" value={form.serial_number} onChange={handleChange}
                  placeholder="e.g. SN-00123456" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Operating System <span className="normal-case font-normal text-gray-400">(optional)</span>
                </label>
                <input name="operating_system" value={form.operating_system} onChange={handleChange}
                  placeholder="e.g. FreeRTOS, Linux" className={inputCls} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Power Source
              </label>
              <select name="power_type" value={form.power_type} onChange={handleChange} className={inputCls}>
                <option value="ac">AC (mains power)</option>
                <option value="dc">DC (battery)</option>
              </select>
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
                disabled={isLoading || !billingActive}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors"
              >
                {isLoading ? "Registering…" : "Register Sensor"}
              </button>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="px-6 py-3 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default OnboardSensor;
