import usePageTitle from "../../hooks/usePageTitle";
import { useGetMeQuery } from "../../redux/apislices/authApiSlice";

const Team = () => {
  usePageTitle("Team — VerdantIQ");
  const { data: me } = useGetMeQuery();

  return (
    <div className="px-6 py-8">
      <div className="mb-8">
        <h1 className="text-lg font-semibold text-gray-800">Team</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Manage team members and access for{" "}
          <span className="font-medium text-gray-600">{me?.email ?? "your organisation"}</span>
        </p>
      </div>

      {/* Current user card */}
      <div className="max-w-2xl">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg font-bold select-none">
              {me?.first_name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-800">
                {me?.first_name} {me?.last_name ?? ""}
              </p>
              <p className="text-xs text-gray-400">{me?.email}</p>
            </div>
            <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">
              Admin
            </span>
          </div>
        </div>

        {/* Invite placeholder */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-600 mb-1">Team management coming soon</p>
          <p className="text-xs text-gray-400">
            Invite team members, assign roles, and manage access to sensors and billing.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Team;
