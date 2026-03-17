import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import usePageTitle from "../../hooks/usePageTitle";
import { useGetMeQuery } from "../../redux/apislices/authApiSlice";
import {
  useCreateSensorMutation,
  useGetBillingQuery,
  useGetFarmsQuery,
} from "../../redux/apislices/userDashboardApiSlice";

const SENSOR_TYPES = [
  { value: "temperature",  label: "🌡️  Temperature" },
  { value: "humidity",     label: "💧  Humidity" },
  { value: "soil",         label: "🌱  Soil Moisture" },
  { value: "weather",      label: "🌤️  Weather Station" },
  { value: "pressure",     label: "🔵  Pressure" },
  { value: "light",        label: "☀️  Light / PAR" },
  { value: "co2",          label: "🌫️  CO₂" },
  { value: "flow",         label: "💦  Water Flow" },
  { value: "environment",  label: "🍃  Environment / Air Quality" },
  { value: "other",        label: "📡  Other" },
];

// Animated sensor beacon (Feature 1)
const SensorBeacon = () => (
  <div className="relative flex items-center justify-center w-full h-full select-none pointer-events-none">
    {/* Pulsing rings */}
    <div className="absolute w-48 h-48 rounded-full bg-emerald-400/10 animate-ping" style={{ animationDuration: "2s" }} />
    <div className="absolute w-36 h-36 rounded-full bg-emerald-400/15 animate-ping" style={{ animationDuration: "2.5s", animationDelay: "0.3s" }} />
    <div className="absolute w-24 h-24 rounded-full bg-emerald-400/20 animate-ping" style={{ animationDuration: "3s", animationDelay: "0.6s" }} />

    {/* Sensor icon */}
    <div className="relative z-10 flex flex-col items-center gap-3">
      <div className="w-16 h-16 bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg flex items-center justify-center border border-emerald-100">
        <svg className="w-9 h-9 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
        </svg>
      </div>

      {/* Data uplink animation */}
      <div className="flex flex-col items-center gap-1 opacity-60">
        {[0, 1, 2].map(i => (
          <div key={i} className="w-0.5 h-3 bg-emerald-500 rounded-full animate-pulse"
            style={{ animationDelay: `${i * 0.2}s`, opacity: 1 - i * 0.25 }} />
        ))}
      </div>

      <p className="text-xs text-emerald-600 font-medium tracking-wide">IoT Sensor</p>

      {/* Floating data packets */}
      <div className="absolute top-0 right-0 translate-x-6 -translate-y-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1 text-xs text-emerald-700 font-mono animate-bounce" style={{ animationDuration: "2s" }}>
          24.5°C
        </div>
      </div>
      <div className="absolute bottom-8 left-0 -translate-x-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-2 py-1 text-xs text-blue-700 font-mono animate-bounce" style={{ animationDuration: "2.8s", animationDelay: "0.5s" }}>
          68% RH
        </div>
      </div>
      <div className="absolute top-8 left-0 -translate-x-10">
        <div className="bg-purple-50 border border-purple-200 rounded-lg px-2 py-1 text-xs text-purple-700 font-mono animate-bounce" style={{ animationDuration: "3.2s", animationDelay: "1s" }}>
          MQTT ↑
        </div>
      </div>
    </div>

    {/* Background grid */}
    <div className="absolute inset-0 opacity-[0.03]"
      style={{ backgroundImage: "radial-gradient(circle, #059669 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
  </div>
);

const OnboardSensor = () => {
  usePageTitle("Onboard Sensor — VerdantIQ");
  const navigate = useNavigate();
  const { data: me } = useGetMeQuery();
  const { data: billing } = useGetBillingQuery(undefined, { skip: !me });
  const { data: farmsPage } = useGetFarmsQuery({}, { skip: !me });
  const [createSensor, { isLoading }] = useCreateSensorMutation();

  const farms = farmsPage?.items ?? [];

  const [form, setForm] = useState({
    sensor_name: "",
    sensor_type: "temperature",
    farm_id: "",
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

  const handleFarmChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    setForm(f => {
      const selectedFarm = farms.find(farm => farm.farm_id === selectedId);
      return {
        ...f,
        farm_id: selectedId,
        latitude: selectedFarm?.latitude != null ? String(selectedFarm.latitude) : f.latitude,
        longitude: selectedFarm?.longitude != null ? String(selectedFarm.longitude) : f.longitude,
      };
    });
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
      if (form.farm_id) sensor_metadata.farm_id = form.farm_id;

      const selectedFarm = farms.find(f => f.farm_id === form.farm_id);

      await createSensor({
        tenant_id: me.tenant_id,
        sensor_name: form.sensor_name.trim(),
        sensor_type: form.sensor_type,
        location: selectedFarm?.farm_name ?? undefined,
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
        <div className="mb-6 max-w-2xl bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-sm text-amber-800">
          Billing must be active before you can add sensors.{" "}
          <button type="button" onClick={() => navigate("/billing/setup")} className="underline font-medium">
            Setup billing
          </button>
        </div>
      )}

      {/* Two-column layout: form left, animation right */}
      <div className="flex gap-8 items-start max-w-4xl">
        {/* Left: form */}
        <div className="flex-1 min-w-0">
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
                <input required name="sensor_name" value={form.sensor_name} onChange={handleChange}
                  placeholder="e.g. North Field Soil Probe 1" className={inputCls} />
              </div>

              {/* Sensor type */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Sensor type *
                </label>
                <select name="sensor_type" value={form.sensor_type} onChange={handleChange} className={inputCls}>
                  {SENSOR_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Farm dropdown (replaces location) */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Farm <span className="normal-case font-normal text-gray-400">(optional)</span>
                </label>
                {farms.length === 0 ? (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 w-full border border-gray-100 rounded-lg px-4 py-3 text-sm text-gray-300 bg-gray-50">
                      No farms registered
                    </div>
                    <Link to="/farm/add"
                      className="text-xs text-emerald-600 hover:text-emerald-700 font-medium whitespace-nowrap">
                      + Add farm
                    </Link>
                  </div>
                ) : (
                  <select name="farm_id" value={form.farm_id} onChange={handleFarmChange} className={inputCls}>
                    <option value="">— No farm selected —</option>
                    {farms.map(farm => (
                      <option key={farm.farm_id} value={farm.farm_id}>{farm.farm_name}</option>
                    ))}
                  </select>
                )}
                {form.farm_id && (
                  <p className="mt-1 text-xs text-emerald-600">
                    Coordinates auto-filled from selected farm.
                  </p>
                )}
              </div>

              {/* Coordinates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Latitude <span className="normal-case font-normal text-gray-400">(optional)</span>
                  </label>
                  <input type="number" step="any" name="latitude" value={form.latitude} onChange={handleChange}
                    placeholder="e.g. 6.5244" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Longitude <span className="normal-case font-normal text-gray-400">(optional)</span>
                  </label>
                  <input type="number" step="any" name="longitude" value={form.longitude} onChange={handleChange}
                    placeholder="e.g. 3.3792" className={inputCls} />
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
                <button type="submit" disabled={isLoading || !billingActive}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors">
                  {isLoading ? "Registering…" : "Register Sensor"}
                </button>
                <button type="button" onClick={() => navigate(-1)}
                  className="px-6 py-3 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right: sensor beacon animation */}
        <div className="hidden lg:flex flex-col items-center justify-center w-72 h-96 shrink-0 relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-50/80 via-white to-blue-50/40 border border-emerald-100/60">
          <SensorBeacon />
        </div>
      </div>
    </div>
  );
};

export default OnboardSensor;
