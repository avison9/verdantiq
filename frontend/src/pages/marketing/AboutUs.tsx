import { Link } from "react-router-dom";
import usePageTitle from "../../hooks/usePageTitle";

const TEAM = [
  { name: "Amara Osei", role: "CEO & Co-Founder", emoji: "👩🏾‍💼", bio: "20 years in agricultural systems engineering. Former head of digital transformation at AgriCorp Europe." },
  { name: "Luca Ferreira", role: "CTO & Co-Founder", emoji: "👨🏽‍💻", bio: "Previously led data infrastructure teams at scale-up agri-tech companies across EMEA." },
  { name: "Priya Nair", role: "Head of Data Science", emoji: "👩🏽‍🔬", bio: "PhD in crop modelling. Built predictive yield systems used on over 2 million acres across Southeast Asia." },
  { name: "James Whitfield", role: "VP Engineering", emoji: "👨🏻‍🔧", bio: "Expert in IoT platform architecture and Kafka-based streaming systems at enterprise scale." },
];

const VALUES = [
  { icon: "🌱", title: "Sustainability First", desc: "Every feature we ship is evaluated for its real-world impact on resource efficiency and environmental outcomes." },
  { icon: "🔒", title: "Data Sovereignty", desc: "Your farm data belongs to you. We are committed to full data portability, transparent processing, and strict access controls." },
  { icon: "🤝", title: "Farmer-Centric Design", desc: "We work directly with farming operators to design every workflow — no feature ships without real-world validation." },
  { icon: "⚡", title: "Engineering Excellence", desc: "From sub-second sensor ingestion to enterprise-grade multi-tenancy, we hold ourselves to the highest technical standards." },
];

const AboutUs = () => {
  usePageTitle("About Us — VerdantIQ");
  return (
    <div className="pt-16">
      {/* Hero */}
      <section className="bg-gradient-to-br from-green-950 to-emerald-800 text-white py-28 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <span className="text-xs font-bold tracking-widest text-emerald-300 uppercase">About VerdantIQ</span>
          <h1 className="text-5xl font-extrabold mt-4 mb-6 leading-tight">
            We believe every farm deserves enterprise-grade intelligence
          </h1>
          <p className="text-lg text-white/70 max-w-2xl mx-auto leading-relaxed">
            VerdantIQ was founded to close the technology gap between large-scale
            agri-businesses and independent farm operators — bringing AI, IoT,
            and real-time analytics to every field.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="bg-white py-24 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div>
            <span className="text-xs font-bold tracking-widest text-emerald-600 uppercase">Our Story</span>
            <h2 className="text-3xl font-extrabold text-gray-900 mt-3 mb-6">
              Born from the field, built for scale
            </h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              In 2022, our founders visited hundreds of farms across West Africa, Southeast
              Asia, and Europe. They found the same problem everywhere: critical sensor
              data sitting in siloed spreadsheets, expensive crop losses from decisions
              made too late, and tools designed for IT departments — not farmers.
            </p>
            <p className="text-gray-600 leading-relaxed mb-4">
              VerdantIQ was built to change that. We took enterprise data infrastructure —
              the kind powering global banks and logistics networks — and rebuilt it for
              the realities of precision agriculture.
            </p>
            <p className="text-gray-600 leading-relaxed">
              Today, our platform handles millions of sensor readings daily across
              multi-tenant farm organisations, helping operators make faster, smarter,
              and more sustainable decisions.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { v: "2022", l: "Founded" },
              { v: "14", l: "Countries" },
              { v: "500K+", l: "Daily sensor reads" },
              { v: "99.9%", l: "Uptime SLA" },
            ].map((s) => (
              <div key={s.l} className="bg-emerald-50 rounded-2xl p-8 text-center">
                <div className="text-4xl font-extrabold text-emerald-700">{s.v}</div>
                <div className="text-sm text-gray-500 mt-1">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="bg-gray-50 py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs font-bold tracking-widest text-emerald-600 uppercase">What Drives Us</span>
            <h2 className="text-4xl font-extrabold text-gray-900 mt-3">Our core values</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {VALUES.map((v) => (
              <div key={v.title} className="bg-white rounded-2xl p-8 border border-gray-100 hover:shadow-md transition-shadow">
                <div className="text-4xl mb-4">{v.icon}</div>
                <h3 className="font-bold text-gray-900 mb-2">{v.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="bg-white py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs font-bold tracking-widest text-emerald-600 uppercase">Leadership</span>
            <h2 className="text-4xl font-extrabold text-gray-900 mt-3">The team behind VerdantIQ</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {TEAM.map((m) => (
              <div key={m.name} className="text-center">
                <div className="text-7xl mb-4">{m.emoji}</div>
                <h3 className="font-bold text-gray-900">{m.name}</h3>
                <div className="text-sm text-emerald-600 font-medium mb-3">{m.role}</div>
                <p className="text-sm text-gray-500 leading-relaxed">{m.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-emerald-700 text-white py-16 px-6 text-center">
        <h2 className="text-3xl font-extrabold mb-4">Ready to see it in action?</h2>
        <p className="text-emerald-100 mb-8 max-w-md mx-auto">
          Explore our mission, check our pricing, or get in touch with our team.
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Link to="/mission" className="bg-white text-emerald-700 font-bold px-8 py-3 rounded-lg hover:bg-emerald-50 transition-colors">
            Our Mission
          </Link>
          <Link to="/contact" className="border border-white/50 hover:border-white text-white px-8 py-3 rounded-lg transition-colors">
            Contact Us
          </Link>
        </div>
      </section>
    </div>
  );
};

export default AboutUs;
