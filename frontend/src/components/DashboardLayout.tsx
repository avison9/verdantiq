import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { toast } from "react-toastify";
import { useGetMeQuery, useLogoutMutation } from "../redux/apislices/authApiSlice";
import { logout as logoutAction } from "../redux/slices/authSlice";

type MenuSection = "sensors" | "billing";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const DashboardLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Set<MenuSection>>(new Set());

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [logoutApi] = useLogoutMutation();
  const { data: me } = useGetMeQuery();

  const handleLogout = async () => {
    try {
      await logoutApi().unwrap();
    } catch {
      // clear local state regardless
    }
    dispatch(logoutAction());
    navigate("/login");
    toast.success("Signed out successfully");
  };

  const toggleSection = (section: MenuSection) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const subLinkCls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
      isActive
        ? "bg-emerald-50 text-emerald-700 font-semibold"
        : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
    }`;

  const groupBtnCls =
    `w-full flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-700 ` +
    `hover:bg-gray-100 transition-colors`;

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside
        className={`bg-white border-r border-gray-200 flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        {/* Brand row + collapse toggle */}
        <div className="flex items-center justify-between px-3 py-4 border-b border-gray-100 min-h-[57px]">
          {!collapsed && (
            <span className="text-emerald-600 font-bold text-sm tracking-tight select-none">
              VerdantIQ
            </span>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors ml-auto"
            title={collapsed ? "Expand menu" : "Collapse menu"}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {collapsed ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              )}
            </svg>
          </button>
        </div>

        {/* Greeting */}
        <div
          className={`border-b border-gray-100 ${
            collapsed ? "py-4 flex justify-center" : "px-4 py-4"
          }`}
        >
          {collapsed ? (
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold select-none">
              {me?.first_name?.[0]?.toUpperCase() ?? "?"}
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-400">{greeting()},</p>
              <p className="text-sm font-semibold text-gray-800 mt-0.5">
                {me?.first_name ?? "—"}
              </p>
            </>
          )}
        </div>

        {/* ── Navigation ────────────────────────────────────────────────── */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>

          {/* Dashboard overview */}
          <NavLink
            to="/dashboard"
            end
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                collapsed ? "justify-center" : ""
              } ${
                isActive
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
              }`
            }
            title={collapsed ? "Overview" : undefined}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            {!collapsed && <span>Overview</span>}
          </NavLink>

          {/* ── Sensors group ── */}
          <div>
            <button
              onClick={() => !collapsed && toggleSection("sensors")}
              className={`${groupBtnCls} ${collapsed ? "justify-center" : "justify-between"}`}
              title={collapsed ? "Sensors" : undefined}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                </svg>
                {!collapsed && <span>Sensors</span>}
              </span>
              {!collapsed && (
                <svg
                  className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${
                    openSections.has("sensors") ? "rotate-180" : ""
                  }`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>

            {!collapsed && openSections.has("sensors") && (
              <div className="mt-0.5 ml-3 pl-3 border-l border-gray-100 space-y-0.5">
                <NavLink to="/sensors/onboard" className={subLinkCls}>
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Sensor
                </NavLink>
                <NavLink to="/sensors/list" className={subLinkCls}>
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  List Sensors
                </NavLink>
              </div>
            )}
          </div>

          {/* ── Billing group ── */}
          <div>
            <button
              onClick={() => !collapsed && toggleSection("billing")}
              className={`${groupBtnCls} ${collapsed ? "justify-center" : "justify-between"}`}
              title={collapsed ? "Billing" : undefined}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                {!collapsed && <span>Billing</span>}
              </span>
              {!collapsed && (
                <svg
                  className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${
                    openSections.has("billing") ? "rotate-180" : ""
                  }`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>

            {!collapsed && openSections.has("billing") && (
              <div className="mt-0.5 ml-3 pl-3 border-l border-gray-100 space-y-0.5">
                <NavLink to="/billing/setup" className={subLinkCls}>
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Setup Billing
                </NavLink>
                <NavLink to="/billing/transactions" className={subLinkCls}>
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Transactions
                </NavLink>
              </div>
            )}
          </div>

          {/* ── Other Services (coming soon) ── */}
          <button
            disabled
            className={`${groupBtnCls} text-gray-400 cursor-not-allowed ${collapsed ? "justify-center" : ""}`}
            title={collapsed ? "Other Services — coming soon" : undefined}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            {!collapsed && (
              <span className="flex items-center gap-2">
                Other Services
                <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full leading-none">
                  soon
                </span>
              </span>
            )}
          </button>

          {/* ── API (coming soon) ── */}
          <button
            disabled
            className={`${groupBtnCls} text-gray-400 cursor-not-allowed ${collapsed ? "justify-center" : ""}`}
            title={collapsed ? "API — coming soon" : undefined}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            {!collapsed && (
              <span className="flex items-center gap-2">
                API
                <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full leading-none">
                  soon
                </span>
              </span>
            )}
          </button>
        </nav>

        {/* ── Bottom: profile + sign out ─────────────────────────────────── */}
        {!collapsed ? (
          <div className="border-t border-gray-100 px-2 py-2 space-y-0.5">
            <Link
              to="/profile/user"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              My Profile
            </Link>
            <Link
              to="/profile/tenant"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Organisation
            </Link>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors text-left"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </button>
          </div>
        ) : (
          <div className="border-t border-gray-100 py-3 flex justify-center">
            <button
              onClick={handleLogout}
              title="Sign out"
              className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        )}
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
};

export default DashboardLayout;
