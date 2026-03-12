import { useState } from "react";
import usePageTitle from "../../hooks/usePageTitle";

const OFFICES = [
  { city: "London, UK", address: "12 Farringdon Road, London EC1A 1AA", phone: "+44 20 7123 4567", email: "uk@verdantiq.com" },
  { city: "Accra, Ghana", address: "15 Airport City, PMB CT 378, Accra", phone: "+233 30 296 0000", email: "africa@verdantiq.com" },
  { city: "Singapore", address: "1 Fusionopolis Way, #08-01, Singapore 138632", phone: "+65 6123 4567", email: "apac@verdantiq.com" },
];

type FormState = { name: string; email: string; company: string; subject: string; message: string };

const ContactUs = () => {
  usePageTitle("Contact Us — VerdantIQ");

  const [form, setForm] = useState<FormState>({
    name: "", email: "", company: "", subject: "General enquiry", message: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: wire to backend contact endpoint
    setSubmitted(true);
  };

  const inputCls = "w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition";

  return (
    <div className="pt-16">
      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-950 to-emerald-900 text-white py-28 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <span className="text-xs font-bold tracking-widest text-emerald-300 uppercase">Get In Touch</span>
          <h1 className="text-5xl font-extrabold mt-4 mb-6">We'd love to hear from you</h1>
          <p className="text-lg text-white/70 max-w-xl mx-auto leading-relaxed">
            Whether you're a farm operator exploring VerdantIQ, a partner seeking
            integration, or a journalist — our team responds within one business day.
          </p>
        </div>
      </section>

      {/* Form + Info */}
      <section className="bg-white py-24 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-5 gap-16">
          {/* Form */}
          <div className="md:col-span-3">
            <h2 className="text-2xl font-extrabold text-gray-900 mb-8">Send us a message</h2>

            {submitted ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-10 text-center">
                <div className="text-5xl mb-4">✅</div>
                <h3 className="text-xl font-bold text-emerald-800 mb-2">Message received!</h3>
                <p className="text-gray-600">We'll get back to you within one business day.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Full name *</label>
                    <input required name="name" value={form.name} onChange={handleChange} placeholder="Jane Smith" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Work email *</label>
                    <input required type="email" name="email" value={form.email} onChange={handleChange} placeholder="jane@farmcorp.com" className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Company / Farm name</label>
                  <input name="company" value={form.company} onChange={handleChange} placeholder="FarmCorp Ltd" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Subject</label>
                  <select name="subject" value={form.subject} onChange={handleChange} className={inputCls}>
                    <option>General enquiry</option>
                    <option>Sales & pricing</option>
                    <option>Technical support</option>
                    <option>Partnership / Integration</option>
                    <option>Press & media</option>
                    <option>Career opportunities</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Message *</label>
                  <textarea required name="message" value={form.message} onChange={handleChange} rows={6} placeholder="Tell us how we can help..." className={inputCls} />
                </div>
                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3.5 rounded-lg transition-colors"
                >
                  Send Message
                </button>
                <p className="text-xs text-gray-400 text-center">
                  By submitting this form you agree to our{" "}
                  <a href="/privacy" className="underline hover:text-emerald-600">Privacy Policy</a>.
                </p>
              </form>
            )}
          </div>

          {/* Info panel */}
          <div className="md:col-span-2 space-y-10">
            <div>
              <h2 className="text-2xl font-extrabold text-gray-900 mb-6">Other ways to reach us</h2>
              <div className="space-y-4 text-sm text-gray-600">
                <div className="flex gap-3 items-start">
                  <span className="text-xl mt-0.5">📧</span>
                  <div>
                    <div className="font-semibold text-gray-800">General</div>
                    <a href="mailto:hello@verdantiq.com" className="hover:text-emerald-600 transition-colors">hello@verdantiq.com</a>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="text-xl mt-0.5">🔒</span>
                  <div>
                    <div className="font-semibold text-gray-800">Security disclosures</div>
                    <a href="mailto:security@verdantiq.com" className="hover:text-emerald-600 transition-colors">security@verdantiq.com</a>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="text-xl mt-0.5">📰</span>
                  <div>
                    <div className="font-semibold text-gray-800">Press & media</div>
                    <a href="mailto:press@verdantiq.com" className="hover:text-emerald-600 transition-colors">press@verdantiq.com</a>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-bold text-gray-900 mb-5">Our offices</h3>
              <div className="space-y-6">
                {OFFICES.map((o) => (
                  <div key={o.city} className="bg-gray-50 rounded-xl p-5 text-sm">
                    <div className="font-semibold text-gray-900 mb-1">📍 {o.city}</div>
                    <div className="text-gray-500">{o.address}</div>
                    <div className="mt-2 text-gray-500">{o.phone}</div>
                    <a href={`mailto:${o.email}`} className="text-emerald-600 hover:underline">{o.email}</a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ContactUs;
