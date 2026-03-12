import { useState, useEffect } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import MarketingFooter from "./MarketingFooter";

const NAV_LINKS = [
  { label: "About", to: "/about" },
  { label: "Mission", to: "/mission" },
  { label: "Pricing", to: "/pricing" },
  { label: "Contact", to: "/contact" },
];

const MarketingLayout = () => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const isHome = location.pathname === "/";

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const navBg = isHome && !scrolled
    ? "bg-transparent"
    : "bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm";

  const textColor = isHome && !scrolled ? "text-white" : "text-gray-700";
  const logoColor = isHome && !scrolled ? "text-white" : "text-emerald-700";

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Navigation ──────────────────────────────────────────────── */}
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${navBg}`}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className={`font-bold text-xl tracking-tight transition-colors ${logoColor}`}>
            VerdantIQ
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className={`transition-colors hover:text-emerald-500 ${textColor}`}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          {/* Platform button */}
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg transition-colors shadow-sm"
            >
              Platform
            </Link>

            {/* Mobile menu toggle */}
            <button
              className={`md:hidden p-1.5 rounded transition-colors ${textColor}`}
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Toggle menu"
            >
              {menuOpen ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 px-6 py-4 flex flex-col gap-4 text-sm font-medium text-gray-700">
            {NAV_LINKS.map((l) => (
              <Link key={l.to} to={l.to} className="hover:text-emerald-600 transition-colors">
                {l.label}
              </Link>
            ))}
          </div>
        )}
      </header>

      {/* ── Page content ────────────────────────────────────────────── */}
      <main className="flex-1">
        <Outlet />
      </main>

      <MarketingFooter />
    </div>
  );
};

export default MarketingLayout;
