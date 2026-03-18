import { useEffect, useState } from "react";
import usePageTitle from "../../hooks/usePageTitle";
import { useGetMeQuery } from "../../redux/apislices/authApiSlice";
import { useGetSensorsQuery, useGetFarmsQuery } from "../../redux/apislices/userDashboardApiSlice";

const DATA_SERVICE_URL = import.meta.env.VITE_DATA_SERVICE_URL ?? "http://localhost:8090";

// Typical days from planting to harvest per crop
const CROP_HARVEST_DAYS: Record<string, number> = {
  maize: 90, corn: 90, rice: 120, wheat: 100, soybean: 100,
  tomato: 75, pepper: 80, onion: 120, cabbage: 70, lettuce: 45,
  carrot: 75, potato: 90, "sweet potato": 120, cowpea: 65,
  groundnut: 120, sorghum: 100, millet: 90, plantain: 300,
  banana: 270, cassava: 270, yam: 240, cocoa: 1095, coffee: 1095,
  "palm oil": 365, rubber: 365, cotton: 160, sugarcane: 365,
};

function getDaysToHarvest(crop: string): number {
  const key = crop.toLowerCase();
  return CROP_HARVEST_DAYS[key] ?? 90;
}

const AnalyticsOverview = () => {
  usePageTitle("Analytics Overview — VerdantIQ");

  const { data: me } = useGetMeQuery();
  const { data: sensorsPage } = useGetSensorsQuery(
    { tenant_id: me?.tenant_id ?? 0, per_page: 100 },
    { skip: !me, pollingInterval: 30_000 },
  );
  const { data: farmsPage } = useGetFarmsQuery({}, { skip: !me });
  const [liveCounts, setLiveCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const r = await fetch(`${DATA_SERVICE_URL}/sensors/message-counts`);
        if (!r.ok) return;
        const data = await r.json();
        setLiveCounts(data);
      } catch { /* ignore */ }
    };
    fetchCounts();
    const id = setInterval(fetchCounts, 30_000);
    return () => clearInterval(id);
  }, []);

  const sensors = sensorsPage?.items ?? [];
  const farms = farmsPage?.items ?? [];

  const totalMessages = sensors.reduce(
    (s, x) => s + (liveCounts[x.sensor_id] ?? x.message_count), 0,
  );
  const activeSensors = sensors.filter(s => s.status === "active").length;

  // Flatten all crops across all farms
  const farmCrops = farms.flatMap(farm =>
    (farm.crops ?? []).map(crop => ({ farmName: farm.farm_name, crop }))
  );

  return (
    <div className="px-6 py-8">
      <div className="mb-8">
        <h1 className="text-lg font-semibold text-gray-800">Analytics Overview</h1>
        <p className="text-sm text-gray-400 mt-0.5">Data insights and trends from your IoT sensor network</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Messages</p>
          <p className="text-2xl font-bold text-blue-600">{totalMessages.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">all time</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Active Sensors</p>
          <p className="text-2xl font-bold text-emerald-600">{activeSensors}</p>
          <p className="text-xs text-gray-400 mt-1">of {sensors.length} total</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Farms Monitored</p>
          <p className="text-2xl font-bold text-purple-600">{farms.length}</p>
          <p className="text-xs text-gray-400 mt-1">registered farms</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Crop Varieties</p>
          <p className="text-2xl font-bold text-amber-600">
            {new Set(farmCrops.map(fc => fc.crop.toLowerCase())).size}
          </p>
          <p className="text-xs text-gray-400 mt-1">tracked across farms</p>
        </div>
      </div>

      {/* Crop Harvest Countdown */}
      {farmCrops.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-8">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-800">Crop Harvest Countdown</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Estimated days to harvest from typical growing period — actual dates require planting records
              </p>
            </div>
            <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded-lg">Estimates</span>
          </div>
          <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {farmCrops.map(({ farmName, crop }, idx) => {
              const days = getDaysToHarvest(crop);
              const urgency = days <= 30 ? "red" : days <= 60 ? "orange" : days <= 90 ? "amber" : "emerald";
              const colors: Record<string, { bar: string; badge: string; text: string }> = {
                red:     { bar: "bg-red-500",     badge: "bg-red-50 text-red-700 border-red-200",       text: "text-red-700" },
                orange:  { bar: "bg-orange-400",  badge: "bg-orange-50 text-orange-700 border-orange-200", text: "text-orange-700" },
                amber:   { bar: "bg-amber-400",   badge: "bg-amber-50 text-amber-700 border-amber-200",  text: "text-amber-700" },
                emerald: { bar: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", text: "text-emerald-700" },
              };
              const c = colors[urgency];
              return (
                <div key={idx} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{crop}</p>
                      <p className="text-xs text-gray-400">{farmName}</p>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${c.badge}`}>
                      ~{days}d
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full ${c.bar}`} style={{ width: `${Math.min((days / 365) * 100, 100)}%` }} />
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">
                    Typical harvest in <span className={`font-medium ${c.text}`}>{days} days</span> from planting
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Placeholder analytics charts */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <PlaceholderCard
          title="Message Volume Over Time"
          subtitle="Inbound IoT messages per sensor per day"
          icon={
            <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />
        <PlaceholderCard
          title="Sensor Activity Heatmap"
          subtitle="Message frequency by hour of day"
          icon={
            <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          }
        />
        <PlaceholderCard
          title="Data Quality Score"
          subtitle="Completeness and accuracy of sensor readings"
          icon={
            <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <PlaceholderCard
          title="Anomaly Detection"
          subtitle="Outlier readings and sensor fault alerts"
          icon={
            <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
        />
      </div>

      {/* Trino query integration note */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 text-sm text-blue-700">
        <p className="font-semibold mb-1">Full analytics powered by Trino + Apache Iceberg</p>
        <p className="text-xs text-blue-500">
          Time-series charts, heatmaps, anomaly detection and custom SQL queries will be available once the Trino integration is live.
          Use the <strong>Query</strong> console to run ad-hoc analytics on your Iceberg tables today.
        </p>
      </div>
    </div>
  );
};

function PlaceholderCard({ title, subtitle, icon }: { title: string; subtitle: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex flex-col items-center justify-center text-center">
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
        {icon}
      </div>
      <p className="text-sm font-medium text-gray-600">{title}</p>
      <p className="text-xs text-gray-300 mt-1">{subtitle}</p>
      <span className="mt-3 text-[10px] bg-gray-100 text-gray-400 px-2.5 py-1 rounded-full">Coming soon</span>
    </div>
  );
}

export default AnalyticsOverview;
