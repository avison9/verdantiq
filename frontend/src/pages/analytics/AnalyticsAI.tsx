import usePageTitle from "../../hooks/usePageTitle";
import { useGetMeQuery } from "../../redux/apislices/authApiSlice";
import { useGetFarmsQuery } from "../../redux/apislices/userDashboardApiSlice";

const AnalyticsAI = () => {
  usePageTitle("AI Insights — VerdantIQ");

  const { data: me } = useGetMeQuery();
  const { data: farmsPage } = useGetFarmsQuery({}, { skip: !me });
  const farms = farmsPage?.items ?? [];

  return (
    <div className="px-6 py-8">
      <div className="mb-8">
        <h1 className="text-lg font-semibold text-gray-800">AI Insights</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Predictive analytics and crop-specific recommendations powered by machine learning
        </p>
      </div>

      {/* AI status banner */}
      <div className="mb-8 bg-gradient-to-r from-emerald-50 to-blue-50 border border-emerald-100 rounded-2xl px-6 py-5 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800">AI Engine — Coming Soon</p>
          <p className="text-xs text-gray-500 mt-1">
            Our ML models are trained on IoT sensor data from your farms. Once live, you'll receive real-time
            recommendations for irrigation, sunlight management, humidity control, and yield optimisation.
            The placeholders below represent the features that will be available.
          </p>
        </div>
        <span className="shrink-0 text-[10px] bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-semibold">Beta</span>
      </div>

      {/* Farm selector context */}
      {farms.length > 0 && (
        <div className="mb-6 flex items-center gap-3 flex-wrap">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Predictions for:</span>
          {farms.map(farm => (
            <span key={farm.farm_id}
              className="text-xs bg-white border border-gray-200 text-gray-600 px-3 py-1 rounded-full">
              {farm.farm_name}
            </span>
          ))}
        </div>
      )}

      {/* Primary prediction cards — 2 cols */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

        <AICard
          color="amber"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="5" strokeWidth={1.5} />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 2v2m0 16v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M2 12h2m16 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          }
          title="Sunlight Optimisation"
          description="Daily sunlight hour requirements per crop variety based on growth stage, geo-location, and current season. Includes shading and canopy management recommendations."
          metrics={[
            { label: "Required PAR", value: "850–1 200 µmol/m²" },
            { label: "Daily DLI target", value: "22–30 mol/m²/day" },
            { label: "Optimal planting time", value: "—" },
          ]}
        />

        <AICard
          color="blue"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M20 17.58A5 5 0 0018 8h-1.26A8 8 0 104 15.25M8 19v1m4-2v2m4-1v1" />
            </svg>
          }
          title="Irrigation Recommendations"
          description="Smart irrigation scheduling based on crop water demand, soil moisture sensor readings, evapotranspiration rate, and upcoming rainfall predictions."
          metrics={[
            { label: "Water requirement", value: "— mm/week" },
            { label: "Irrigation frequency", value: "—" },
            { label: "Next scheduled run", value: "—" },
          ]}
        />

        <AICard
          color="cyan"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" />
            </svg>
          }
          title="Humidity Management"
          description="Optimal relative humidity ranges for each crop, risk alerts for fungal disease when RH exceeds thresholds, and ventilation schedule recommendations."
          metrics={[
            { label: "Optimal RH range", value: "60–80%" },
            { label: "Disease risk level", value: "—" },
            { label: "Ventilation advice", value: "—" },
          ]}
        />

        <AICard
          color="emerald"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          }
          title="Nutrient Requirements"
          description="NPK and micronutrient recommendations derived from soil sensor pH, nitrogen levels, and crop growth stage. Includes fertilisation schedule and dosage amounts."
          metrics={[
            { label: "Nitrogen (N)", value: "— kg/ha" },
            { label: "Phosphorus (P)", value: "— kg/ha" },
            { label: "Potassium (K)", value: "— kg/ha" },
          ]}
        />

      </div>

      {/* Secondary prediction cards — 3 cols */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">

        <AICardSmall
          color="red"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
          title="Pest & Disease Risk"
          description="Risk scoring based on temperature, humidity, and historical outbreak patterns. Early warning alerts for common crop diseases."
        />

        <AICardSmall
          color="purple"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          }
          title="Yield Prediction"
          description="Projected yield (tons/ha) based on current growth metrics, sensor readings, and historical harvest data from similar conditions."
        />

        <AICardSmall
          color="indigo"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
          title="Optimal Planting Calendar"
          description="AI-generated planting schedule aligned with local climate patterns, rain seasons, and soil temperature forecasts."
        />

      </div>

      {/* Integration note */}
      <div className="bg-gray-50 border border-gray-100 rounded-xl px-5 py-4 text-xs text-gray-500 space-y-1">
        <p className="font-semibold text-gray-700 mb-2">How AI Insights work</p>
        <p>Sensor data flows: IoT Device → MQTT → Kafka → Spark Streaming → Iceberg (MinIO/S3)</p>
        <p>AI models consume Iceberg tables via Trino to generate predictions and recommendations.</p>
        <p>Farm profile data (soil type, crop selection, location) is combined with live sensor readings for context-aware advice.</p>
      </div>
    </div>
  );
};

// ── Shared sub-components ──────────────────────────────────────────────────────

const COLOR_MAP: Record<string, { bg: string; border: string; icon: string; badge: string }> = {
  amber:  { bg: "bg-amber-50",  border: "border-amber-100",  icon: "text-amber-600",  badge: "bg-amber-100 text-amber-700"  },
  blue:   { bg: "bg-blue-50",   border: "border-blue-100",   icon: "text-blue-600",   badge: "bg-blue-100 text-blue-700"    },
  cyan:   { bg: "bg-cyan-50",   border: "border-cyan-100",   icon: "text-cyan-600",   badge: "bg-cyan-100 text-cyan-700"    },
  emerald:{ bg: "bg-emerald-50",border: "border-emerald-100",icon: "text-emerald-600",badge: "bg-emerald-100 text-emerald-700"},
  red:    { bg: "bg-red-50",    border: "border-red-100",    icon: "text-red-600",    badge: "bg-red-100 text-red-700"      },
  purple: { bg: "bg-purple-50", border: "border-purple-100", icon: "text-purple-600", badge: "bg-purple-100 text-purple-700"},
  indigo: { bg: "bg-indigo-50", border: "border-indigo-100", icon: "text-indigo-600", badge: "bg-indigo-100 text-indigo-700"},
};

function AICard({ color, icon, title, description, metrics }: {
  color: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  metrics: { label: string; value: string }[];
}) {
  const c = COLOR_MAP[color] ?? COLOR_MAP.emerald;
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-6`}>
      <div className="flex items-start gap-4 mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${c.bg} ${c.icon}`}>
          {icon}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800">{title}</p>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">{description}</p>
        </div>
      </div>
      <div className={`rounded-xl p-3 space-y-2 ${c.bg} border ${c.border}`}>
        {metrics.map(m => (
          <div key={m.label} className="flex items-center justify-between">
            <span className="text-xs text-gray-500">{m.label}</span>
            <span className="text-xs font-semibold text-gray-700 tabular-nums">
              {m.value === "—" ? (
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${c.badge}`}>Pending AI</span>
              ) : m.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AICardSmall({ color, icon, title, description }: {
  color: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  const c = COLOR_MAP[color] ?? COLOR_MAP.emerald;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${c.bg} ${c.icon}`}>
        {icon}
      </div>
      <p className="text-sm font-semibold text-gray-800 mb-1">{title}</p>
      <p className="text-xs text-gray-400 leading-relaxed mb-3">{description}</p>
      <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold ${c.badge}`}>Coming soon</span>
    </div>
  );
}

export default AnalyticsAI;
