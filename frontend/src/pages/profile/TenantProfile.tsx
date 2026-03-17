import { Link } from "react-router-dom";
import { useGetMeQuery } from "../../redux/apislices/authApiSlice";
import { useGetFarmsQuery } from "../../redux/apislices/userDashboardApiSlice";
import usePageTitle from "../../hooks/usePageTitle";

const TenantProfile = () => {
  usePageTitle("Organisation — VerdantIQ");
  const { data: me, isLoading: meLoading } = useGetMeQuery();
  const { data: farmsPage } = useGetFarmsQuery({}, { skip: !me });

  const farms = farmsPage?.items ?? [];

  if (meLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      <div className="mb-8">
        <h1 className="text-lg font-semibold text-gray-800">Organisation</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Manage your organisation's farms, team members, and access control.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
        {/* Organisation info */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Organisation Info</h2>
          <div className="flex items-center gap-4 mb-5">
            <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
              {me?.first_name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">{me?.first_name} {me?.last_name}</p>
              <p className="text-xs text-gray-400">Tenant ID: <span className="font-mono">{me?.tenant_id}</span></p>
              <p className="text-xs text-gray-400">{me?.email}</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-50">
              <span className="text-xs text-gray-400 uppercase tracking-wide">Farms registered</span>
              <span className="font-semibold text-gray-700">{farms.length}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-xs text-gray-400 uppercase tracking-wide">Account status</span>
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Active</span>
            </div>
          </div>
        </div>

        {/* Quick links */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Quick Links</h2>
          <div className="space-y-2">
            {[
              { to: "/farm/add",        icon: "🌾", label: "Add a Farm",            desc: "Register a new farm to your organisation" },
              { to: "/farm/management", icon: "🗺️", label: "Manage Farms",           desc: "View, edit, and delete your farms" },
              { to: "/team",            icon: "👥", label: "Team Members",           desc: "Manage users and roles" },
              { to: "/sensors/onboard", icon: "📡", label: "Add Sensor to Farm",    desc: "Onboard a new IoT sensor" },
            ].map(link => (
              <Link key={link.to} to={link.to}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors group">
                <span className="text-xl">{link.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 group-hover:text-emerald-700">{link.label}</p>
                  <p className="text-xs text-gray-400">{link.desc}</p>
                </div>
                <svg className="w-4 h-4 text-gray-300 group-hover:text-emerald-500 transition-colors shrink-0"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        </div>

        {/* Farm–User assignments */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Farm Assignments</h2>
              <p className="text-xs text-gray-400 mt-0.5">Sensors and team members are scoped per farm</p>
            </div>
            <Link to="/farm/add"
              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors">
              + Add Farm
            </Link>
          </div>

          {farms.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-400">No farms registered yet.</p>
              <Link to="/farm/add" className="mt-2 inline-block text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                Register your first farm →
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="pb-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Farm</th>
                    <th className="pb-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Type</th>
                    <th className="pb-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Size</th>
                    <th className="pb-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Crops</th>
                    <th className="pb-2 text-right text-xs font-medium text-gray-400 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {farms.map(farm => (
                    <tr key={farm.farm_id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="py-3">
                        <Link to={`/farm/${farm.farm_id}`} className="text-sm font-medium text-gray-800 hover:text-emerald-700">
                          {farm.farm_name}
                        </Link>
                      </td>
                      <td className="py-3 text-xs text-gray-500 capitalize">
                        {farm.farm_type?.replace("_", " ") ?? "—"}
                      </td>
                      <td className="py-3 text-xs text-gray-500">
                        {farm.farm_size_ha ? `${farm.farm_size_ha} ha` : "—"}
                      </td>
                      <td className="py-3">
                        {farm.crops && farm.crops.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {farm.crops.slice(0, 2).map(c => (
                              <span key={c} className="text-xs bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full">{c}</span>
                            ))}
                            {farm.crops.length > 2 && <span className="text-xs text-gray-400">+{farm.crops.length - 2}</span>}
                          </div>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="py-3 text-right">
                        <Link to={`/farm/${farm.farm_id}`}
                          className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                          Manage →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TenantProfile;
