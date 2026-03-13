import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import usePageTitle from "../hooks/usePageTitle";

// ── Slide data ───────────────────────────────────────────────────────────────
const SLIDES = [
  {
    id: 0,
    // Aerial view of irrigation sprinklers across a green crop field
    image: "/images/netcive-test-image-1.png",
    overlay: "from-black/70 via-black/40 to-transparent",
    tag: "PRECISION IRRIGATION",
    title: "Precision Farming\nat Scale",
    subtitle:
      "GPS-guided irrigation systems and autonomous machinery across thousands of acres with real-time telemetry and automated route planning.",
  },
  {
    id: 1,
    // IoT sensor masts deployed across a large crop field
    image: "/images/netcive-test-image-2.png",
    overlay: "from-black/75 via-black/45 to-transparent",
    tag: "IOT INTELLIGENCE",
    title: "Connected Sensors,\nLive Crop Insights",
    subtitle:
      "Deploy soil moisture, temperature, and humidity sensor networks and receive instant alerts, trend analysis, and anomaly detection.",
  },
  {
    id: 2,
    // Aerial sprinkler irrigation with cattle grazing
    image: "/images/netcive-test-image-3.png",
    overlay: "from-black/65 via-black/35 to-transparent",
    tag: "SMART WATER MANAGEMENT",
    title: "Intelligent Water\nResource Control",
    subtitle:
      "AI-optimised irrigation scheduling cuts water usage by up to 30% while maintaining optimal soil moisture across every field zone.",
  },
  {
    id: 3,
    // High-pressure irrigation across an open pasture
    image: "/images/netcive-test-image-4.png",
    overlay: "from-black/65 via-black/35 to-transparent",
    tag: "AERIAL MONITORING",
    title: "Satellite & Drone\nField Analysis",
    subtitle:
      "High-resolution multispectral imaging reveals crop stress, water distribution, and yield potential before problems escalate.",
  },
  {
    id: 4,
    // IoT communication towers across vast farmland
    image: "/images/netcive-test-image-5.png",
    overlay: "from-black/70 via-black/40 to-transparent",
    tag: "CONNECTED INFRASTRUCTURE",
    title: "Farm-Wide\nConnectivity Network",
    subtitle:
      "Long-range IoT towers stream sensor data from every corner of your operation directly into your Kafka pipeline — in real time.",
  },
  {
    id: 5,
    // Tractors harvesting a large wheat field
    image: "/images/netcive-test-image-6.png",
    overlay: "from-black/70 via-black/40 to-transparent",
    tag: "YIELD INTELLIGENCE",
    title: "AI-Driven Harvest\nOptimization",
    subtitle:
      "Machine learning models predict yield, recommend optimal harvest timing, and allocate machinery resources across every field zone.",
  },
];

const INTERVAL_MS = 5_000;

// ── IoT signal rings (shown on slide 1) ──────────────────────────────────────
const SignalRings = () => (
  <div className="absolute right-24 top-1/2 -translate-y-1/2 pointer-events-none">
    {[1, 2, 3].map((n) => (
      <span
        key={n}
        className="absolute inset-0 rounded-full border border-cyan-400/30 animate-ping"
        style={{
          width: `${n * 96}px`,
          height: `${n * 96}px`,
          top: `${-n * 48 + 48}px`,
          left: `${-n * 48 + 48}px`,
          animationDelay: `${(n - 1) * 0.6}s`,
          animationDuration: "2.4s",
        }}
      />
    ))}
    <div className="w-12 h-12 bg-cyan-400/20 rounded-full border border-cyan-400/60 flex items-center justify-center">
      <div className="w-3 h-3 bg-cyan-400 rounded-full" />
    </div>
  </div>
);

// ── Feature cards ─────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: "🌡️",
    title: "Real-Time Sensor Streams",
    desc: "Kafka-backed ingestion of soil, climate, and machinery data at sub-second latency across unlimited sensor nodes.",
  },
  {
    icon: "🤖",
    title: "AI Crop Analytics",
    desc: "Spark Streaming pipelines power predictive models for yield estimation, disease detection, and irrigation scheduling.",
  },
  {
    icon: "🏢",
    title: "Multi-Tenant Architecture",
    desc: "Enterprise-grade data isolation. Each farm organisation gets its own secure workspace with full role-based access control.",
  },
  {
    icon: "📊",
    title: "Unified Dashboards",
    desc: "Grafana-powered visualisations aggregate data from every corner of your operation into actionable, real-time insights.",
  },
  {
    icon: "🔔",
    title: "Smart Alerts & Automation",
    desc: "Rule-based and ML-driven alerting notifies your team the moment thresholds are breached — before losses occur.",
  },
  {
    icon: "☁️",
    title: "Cloud-Native & Scalable",
    desc: "Built on Apache Iceberg and MinIO object storage. Scales from a single farm to a continental ag-enterprise.",
  },
];

// ── Stats ─────────────────────────────────────────────────────────────────────
const STATS = [
  { value: "500K+", label: "Sensor readings per day" },
  { value: "99.9%", label: "Platform uptime SLA" },
  { value: "< 1s", label: "Data ingestion latency" },
  { value: "50+", label: "Supported sensor types" },
];

// ── Component ─────────────────────────────────────────────────────────────────
const LandingPage = () => {
  usePageTitle("VerdantIQ — Precision Agriculture Platform");
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [animKey, setAnimKey] = useState(0);

  const goTo = useCallback((idx: number) => {
    setCurrent(idx);
    setAnimKey((k) => k + 1);
  }, []);

  const next = useCallback(() => {
    goTo((current + 1) % SLIDES.length);
  }, [current, goTo]);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(next, INTERVAL_MS);
    return () => clearInterval(t);
  }, [paused, next]);

  return (
    <div>
      {/* ── Hero Slideshow ───────────────────────────────────────────── */}
      <section
        className="relative min-h-screen flex items-center overflow-hidden"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* Photo backgrounds (cross-fade) */}
        {SLIDES.map((s, i) => (
          <div
            key={s.id}
            className="absolute inset-0 transition-opacity duration-1000"
            style={{ opacity: i === current ? 1 : 0 }}
          >
            {/* Photo */}
            <img
              src={s.image}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              draggable={false}
            />
            {/* Dark gradient overlay so text stays legible */}
            <div className={`absolute inset-0 bg-gradient-to-r ${s.overlay}`} />
          </div>
        ))}

        {/* IoT rings on slide 1 */}
        {current === 1 && <SignalRings />}

        {/* Slide content (fade-in per slide) */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 pt-24 pb-24 w-full flex items-center justify-between gap-12">
          <div className="flex-1 max-w-2xl" key={animKey} style={{ animation: "fadeUp 0.7s ease forwards" }}>
            <span className="text-xs font-bold tracking-[0.25em] text-emerald-300 uppercase mb-4 block">
              {SLIDES[current].tag}
            </span>
            <h1 className="text-5xl md:text-7xl font-extrabold text-white leading-[1.05] mb-6 whitespace-pre-line">
              {SLIDES[current].title}
            </h1>
            <p className="text-lg text-white/70 leading-relaxed mb-10 max-w-xl">
              {SLIDES[current].subtitle}
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                to="/register"
                className="bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-8 py-3.5 rounded-lg transition-colors shadow-lg"
              >
                Get Started Free
              </Link>
              <Link
                to="/about"
                className="border border-white/30 hover:border-white/70 text-white/80 hover:text-white px-8 py-3.5 rounded-lg transition-colors"
              >
                Learn More
              </Link>
            </div>
          </div>

        </div>

        {/* Progress bar */}
        {!paused && (
          <div
            key={`bar-${current}-${animKey}`}
            className="absolute bottom-0 left-0 h-1 bg-emerald-400/70 rounded-r"
            style={{ animation: `progressBar ${INTERVAL_MS}ms linear forwards` }}
          />
        )}

        {/* Slide dots */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3 z-20">
          {SLIDES.map((s, i) => (
            <button
              key={s.id}
              onClick={() => goTo(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`rounded-full transition-all duration-300 ${
                i === current
                  ? "w-7 h-2.5 bg-white"
                  : "w-2.5 h-2.5 bg-white/40 hover:bg-white/70"
              }`}
            />
          ))}
        </div>
      </section>

      {/* ── Stats banner ─────────────────────────────────────────────── */}
      <section className="bg-emerald-700 text-white">
        <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {STATS.map((s) => (
            <div key={s.label}>
              <div className="text-4xl font-extrabold">{s.value}</div>
              <div className="mt-1 text-sm text-emerald-100">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────── */}
      <section className="bg-white py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-xs font-bold tracking-widest text-emerald-600 uppercase">
              What We Offer
            </span>
            <h2 className="text-4xl font-extrabold text-gray-900 mt-3">
              Everything your farm operation needs
            </h2>
            <p className="mt-4 text-gray-500 max-w-xl mx-auto">
              From sensor ingestion to AI-powered decisions, VerdantIQ covers the
              full precision agriculture stack.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="bg-gray-50 rounded-2xl p-8 hover:shadow-md transition-shadow border border-gray-100"
              >
                <div className="text-4xl mb-4">{f.icon}</div>
                <h3 className="font-bold text-gray-900 text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section className="bg-gray-950 text-white py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-xs font-bold tracking-widest text-emerald-400 uppercase">
              How It Works
            </span>
            <h2 className="text-4xl font-extrabold mt-3">From field to insight in four steps</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
            {[
              { step: "01", title: "Deploy Sensors", desc: "Install IoT nodes across your fields — soil probes, weather stations, and machinery sensors." },
              { step: "02", title: "Stream Data", desc: "Sensor data flows via MQTT into Kafka at sub-second latency, available instantly." },
              { step: "03", title: "Process & Analyse", desc: "Apache Spark jobs clean, enrich, and aggregate streams into your Iceberg data lake." },
              { step: "04", title: "Decide & Act", desc: "AI models surface recommendations directly in your dashboard so you act before problems escalate." },
            ].map((item, i) => (
              <div key={item.step} className="relative text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-600 text-white font-bold text-lg mb-4">
                  {item.step}
                </div>
                {i < 3 && (
                  <div className="hidden md:block absolute top-7 left-[60%] w-[80%] h-px bg-emerald-700" />
                )}
                <h3 className="font-bold text-white text-lg mb-2">{item.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-emerald-700 to-green-900 text-white py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-extrabold leading-tight mb-6">
            Ready to grow smarter?
          </h2>
          <p className="text-emerald-100 text-lg mb-10 max-w-xl mx-auto">
            Join precision agriculture operators who trust VerdantIQ to turn
            raw sensor data into competitive advantage.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              to="/register"
              className="bg-white text-emerald-700 font-bold px-10 py-4 rounded-lg hover:bg-emerald-50 transition-colors shadow-lg"
            >
              Start Free Trial
            </Link>
            <Link
              to="/contact"
              className="border border-white/40 hover:border-white text-white px-10 py-4 rounded-lg transition-colors"
            >
              Talk to Sales
            </Link>
          </div>
        </div>
      </section>

      {/* Inline keyframe styles */}
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes progressBar {
          from { width: 0%; }
          to   { width: 100%; }
        }
      `}</style>
    </div>
  );
};

export default LandingPage;
