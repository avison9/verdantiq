import { Link } from "react-router-dom";
import usePageTitle from "../../hooks/usePageTitle";

const PILLARS = [
  {
    icon: "🌍",
    title: "Global Food Security",
    desc: "Enabling farmers in every climate and context to maximise productivity with minimal waste, contributing to a more food-secure world.",
  },
  {
    icon: "💧",
    title: "Resource Efficiency",
    desc: "Precision data cuts water usage, reduces fertiliser waste, and lowers carbon footprint across every acre under management.",
  },
  {
    icon: "📈",
    title: "Farmer Profitability",
    desc: "Better decisions mean better yields. Our customers report measurable improvements in revenue per hectare within their first growing season.",
  },
  {
    icon: "🔬",
    title: "Continuous Innovation",
    desc: "Our R&D pipeline feeds new models, new sensor integrations, and new automation capabilities into the platform every quarter.",
  },
];

const ROADMAP = [
  { year: "2022", label: "Company founded. Core IoT ingestion and multi-tenant platform launched." },
  { year: "2023", label: "Kafka + Spark Streaming pipeline reaches production. 500K+ daily reads." },
  { year: "2024", label: "AI yield prediction models achieve sub-5% error across 3 crop types." },
  { year: "2025", label: "Iceberg data lake integration. Edge compute partnerships with hardware OEMs." },
  { year: "2026", label: "Autonomous advisory agent. Regulatory reporting automation for EU GAEC." },
];

const MissionVision = () => {
  usePageTitle("Mission & Vision — VerdantIQ");
  return (
    <div className="pt-16">
      {/* Hero */}
      <section className="bg-gradient-to-br from-emerald-950 to-teal-800 text-white py-28 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <span className="text-xs font-bold tracking-widest text-emerald-300 uppercase">Mission & Vision</span>
          <h1 className="text-5xl font-extrabold mt-4 mb-6 leading-tight">
            Transforming how humanity feeds itself
          </h1>
          <p className="text-lg text-white/70 max-w-2xl mx-auto leading-relaxed">
            We are building the infrastructure layer for the next generation of
            intelligent, sustainable, and profitable agriculture.
          </p>
        </div>
      </section>

      {/* Mission / Vision cards */}
      <section className="bg-white py-24 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12">
          <div className="bg-emerald-50 rounded-3xl p-12">
            <div className="text-4xl mb-6">🎯</div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-4">Our Mission</h2>
            <p className="text-gray-700 leading-relaxed text-lg">
              To democratise precision agriculture by providing every farm operator —
              regardless of size or geography — with the real-time data intelligence
              previously available only to the largest agri-businesses.
            </p>
          </div>
          <div className="bg-gray-950 rounded-3xl p-12 text-white">
            <div className="text-4xl mb-6">🔭</div>
            <h2 className="text-2xl font-extrabold mb-4">Our Vision</h2>
            <p className="text-gray-300 leading-relaxed text-lg">
              A world where every agricultural decision is informed by real-time data,
              AI-driven insight, and predictive intelligence — eliminating preventable
              crop loss and driving sustainable food production at planetary scale.
            </p>
          </div>
        </div>
      </section>

      {/* Strategic Pillars */}
      <section className="bg-gray-50 py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs font-bold tracking-widest text-emerald-600 uppercase">Strategic Focus</span>
            <h2 className="text-4xl font-extrabold text-gray-900 mt-3">Four pillars of our impact</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {PILLARS.map((p) => (
              <div key={p.title} className="flex gap-6 bg-white rounded-2xl p-8 border border-gray-100 hover:shadow-md transition-shadow">
                <div className="text-4xl shrink-0">{p.icon}</div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg mb-2">{p.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roadmap / Timeline */}
      <section className="bg-white py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs font-bold tracking-widest text-emerald-600 uppercase">Our Journey</span>
            <h2 className="text-4xl font-extrabold text-gray-900 mt-3">How far we've come</h2>
          </div>
          <div className="relative">
            <div className="absolute left-8 top-0 bottom-0 w-px bg-emerald-200" />
            <div className="space-y-10">
              {ROADMAP.map((r) => (
                <div key={r.year} className="flex gap-8 items-start">
                  <div className="shrink-0 w-16 h-16 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm z-10">
                    {r.year}
                  </div>
                  <div className="pt-4">
                    <p className="text-gray-700 leading-relaxed">{r.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-br from-green-950 to-emerald-800 text-white py-20 px-6 text-center">
        <h2 className="text-3xl font-extrabold mb-4">Be part of the mission</h2>
        <p className="text-white/70 mb-8 max-w-md mx-auto">
          Join the farmers, agronomists, and tech operators already driving
          change with VerdantIQ.
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Link to="/register" className="bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-8 py-3 rounded-lg transition-colors">
            Start Free Trial
          </Link>
          <Link to="/about" className="border border-white/40 hover:border-white text-white px-8 py-3 rounded-lg transition-colors">
            About Us
          </Link>
        </div>
      </section>
    </div>
  );
};

export default MissionVision;
