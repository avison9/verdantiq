import { useState } from "react";
import { Link } from "react-router-dom";
import usePageTitle from "../../hooks/usePageTitle";

const PLANS = [
  {
    name: "Starter",
    tagline: "For independent operators",
    monthlyPrice: 49,
    yearlyPrice: 39,
    highlight: false,
    features: [
      "Up to 25 sensor nodes",
      "1 farm tenant",
      "3 users",
      "7-day data retention",
      "Standard dashboards",
      "Email alerts",
      "Community support",
    ],
    cta: "Start Free Trial",
    ctaLink: "/register",
  },
  {
    name: "Professional",
    tagline: "For growing farm operations",
    monthlyPrice: 149,
    yearlyPrice: 119,
    highlight: true,
    features: [
      "Up to 200 sensor nodes",
      "5 farm tenants",
      "20 users",
      "90-day data retention",
      "AI yield predictions",
      "SMS & webhook alerts",
      "Drone / satellite integration",
      "Priority email support",
    ],
    cta: "Start Free Trial",
    ctaLink: "/register",
  },
  {
    name: "Enterprise",
    tagline: "For large agri-businesses",
    monthlyPrice: null,
    yearlyPrice: null,
    highlight: false,
    features: [
      "Unlimited sensor nodes",
      "Unlimited tenants",
      "Unlimited users",
      "Unlimited data retention",
      "Custom AI models",
      "Full API access",
      "On-premise / private cloud",
      "SLA-backed 99.9% uptime",
      "Dedicated customer success",
    ],
    cta: "Talk to Sales",
    ctaLink: "/contact",
  },
];

const FAQ = [
  { q: "Is there a free trial?", a: "Yes — Starter and Professional plans include a 14-day free trial, no credit card required." },
  { q: "Can I change plans later?", a: "Absolutely. You can upgrade, downgrade, or cancel at any time from your billing settings." },
  { q: "How are sensor nodes counted?", a: "Each physical IoT device (soil probe, weather station, machinery tracker) counts as one node." },
  { q: "What happens to my data if I cancel?", a: "Your data remains accessible for 30 days after cancellation, and you can export it at any time." },
  { q: "Do you offer discounts for NGOs or research institutions?", a: "Yes — contact us at hello@verdantiq.com and we will work out a custom arrangement." },
];

const Pricing = () => {
  usePageTitle("Pricing — VerdantIQ");
  const [yearly, setYearly] = useState(false);

  return (
    <div className="pt-16">
      {/* Hero */}
      <section className="bg-gradient-to-br from-indigo-950 to-emerald-900 text-white py-28 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <span className="text-xs font-bold tracking-widest text-emerald-300 uppercase">Pricing</span>
          <h1 className="text-5xl font-extrabold mt-4 mb-6">Simple, transparent pricing</h1>
          <p className="text-lg text-white/70 max-w-xl mx-auto leading-relaxed">
            Start free. Scale as you grow. No hidden fees, no sensor lock-in.
          </p>

          {/* Toggle */}
          <div className="mt-10 inline-flex items-center gap-4 bg-white/10 rounded-full px-2 py-2">
            <button
              onClick={() => setYearly(false)}
              className={`px-6 py-2 rounded-full text-sm font-semibold transition-colors ${!yearly ? "bg-white text-gray-900" : "text-white/70 hover:text-white"}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setYearly(true)}
              className={`px-6 py-2 rounded-full text-sm font-semibold transition-colors ${yearly ? "bg-white text-gray-900" : "text-white/70 hover:text-white"}`}
            >
              Yearly
              <span className="ml-2 text-xs bg-emerald-500 text-white px-2 py-0.5 rounded-full">Save 20%</span>
            </button>
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="bg-gray-50 py-20 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-3xl p-10 flex flex-col ${
                plan.highlight
                  ? "bg-emerald-700 text-white shadow-2xl scale-105"
                  : "bg-white border border-gray-200 text-gray-900"
              }`}
            >
              {plan.highlight && (
                <div className="text-xs font-bold tracking-widest text-emerald-200 uppercase mb-2">
                  Most Popular
                </div>
              )}
              <h2 className={`text-2xl font-extrabold ${plan.highlight ? "text-white" : "text-gray-900"}`}>
                {plan.name}
              </h2>
              <p className={`text-sm mt-1 mb-6 ${plan.highlight ? "text-emerald-200" : "text-gray-500"}`}>
                {plan.tagline}
              </p>

              <div className="mb-8">
                {plan.monthlyPrice ? (
                  <>
                    <span className="text-5xl font-extrabold">
                      ${yearly ? plan.yearlyPrice : plan.monthlyPrice}
                    </span>
                    <span className={`text-sm ml-1 ${plan.highlight ? "text-emerald-200" : "text-gray-400"}`}>
                      / mo
                    </span>
                    {yearly && (
                      <div className={`text-xs mt-1 ${plan.highlight ? "text-emerald-200" : "text-gray-400"}`}>
                        billed annually
                      </div>
                    )}
                  </>
                ) : (
                  <span className="text-3xl font-extrabold">Custom</span>
                )}
              </div>

              <ul className="space-y-3 flex-1 mb-10">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-3 text-sm">
                    <span className={plan.highlight ? "text-emerald-300" : "text-emerald-600"}>✓</span>
                    <span className={plan.highlight ? "text-white/90" : "text-gray-600"}>{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                to={plan.ctaLink}
                className={`text-center font-semibold py-3.5 rounded-lg transition-colors ${
                  plan.highlight
                    ? "bg-white text-emerald-700 hover:bg-emerald-50"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs font-bold tracking-widest text-emerald-600 uppercase">FAQ</span>
            <h2 className="text-4xl font-extrabold text-gray-900 mt-3">Common questions</h2>
          </div>
          <div className="space-y-6">
            {FAQ.map((item) => (
              <div key={item.q} className="border-b border-gray-100 pb-6">
                <h3 className="font-bold text-gray-900 mb-2">{item.q}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-emerald-700 text-white py-16 px-6 text-center">
        <h2 className="text-3xl font-extrabold mb-4">Not sure which plan fits?</h2>
        <p className="text-emerald-100 mb-8 max-w-md mx-auto">
          Talk to our team and we'll recommend the right setup for your operation.
        </p>
        <Link to="/contact" className="bg-white text-emerald-700 font-bold px-10 py-3.5 rounded-lg hover:bg-emerald-50 transition-colors">
          Talk to Sales
        </Link>
      </section>
    </div>
  );
};

export default Pricing;
