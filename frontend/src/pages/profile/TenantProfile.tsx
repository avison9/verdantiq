import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useGetMeQuery, useUpdateMeMutation } from "../../redux/apislices/authApiSlice";
import CountrySelect from "../../components/CountrySelect";
import usePageTitle from "../../hooks/usePageTitle";

const TenantProfile = () => {
  usePageTitle("Organisation profile");
  const navigate = useNavigate();
  const { data: me, isLoading: isLoadingMe } = useGetMeQuery();
  const [updateMe, { isLoading: isSaving }] = useUpdateMeMutation();

  const [form, setForm] = useState({
    country: "",
    address: "",
    farm_size: "",
    crop_types_raw: "", // comma-separated input
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const crop_types = form.crop_types_raw
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);

    const payload = {
      tenant_profile: {
        country: form.country || undefined,
        address: form.address || undefined,
        farm_size: form.farm_size ? Number(form.farm_size) : undefined,
        crop_types: crop_types.length ? crop_types : undefined,
      },
    };

    try {
      await updateMe(payload).unwrap();
      toast.success("Organisation profile updated successfully");
    } catch (err: unknown) {
      const error = err as { data?: { detail?: string } };
      toast.error(error?.data?.detail ?? "Failed to update organisation profile");
    }
  };

  if (isLoadingMe) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Organisation Profile</h1>
            <p className="text-sm text-gray-500 mt-1">
              Update your farm / organisation details — visible to your entire team
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
          >
            ← Back
          </button>
        </div>

        {/* Context card */}
        {me && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-5 py-4 mb-6 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {me.first_name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">
                {me.first_name} {me.last_name}
              </p>
              <p className="text-xs text-gray-500">
                Organisation ID: <span className="font-mono">{me.tenant_id}</span>
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Organisation details */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-5">
              Location &amp; contact
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label
                  htmlFor="country"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Country
                </label>
                <CountrySelect
                  id="country"
                  value={form.country}
                  onChange={(country) => setForm({ ...form, country })}
                />
              </div>
              <div>
                <label
                  htmlFor="address"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Farm address
                </label>
                <input
                  id="address"
                  name="address"
                  type="text"
                  value={form.address}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="123 Farm Road, Ogun State"
                />
              </div>
            </div>
          </section>

          {/* Farm details */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-5">
              Farm details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label
                  htmlFor="farm_size"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Farm size (hectares)
                </label>
                <input
                  id="farm_size"
                  name="farm_size"
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.farm_size}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="10.5"
                />
              </div>
              <div>
                <label
                  htmlFor="crop_types_raw"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Crop types
                  <span className="ml-1 text-gray-400 font-normal">(comma-separated)</span>
                </label>
                <input
                  id="crop_types_raw"
                  name="crop_types_raw"
                  type="text"
                  value={form.crop_types_raw}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="maize, cassava, soybean"
                />
              </div>
            </div>

            {/* Crop chips preview */}
            {form.crop_types_raw && (
              <div className="mt-3 flex flex-wrap gap-2">
                {form.crop_types_raw
                  .split(",")
                  .map((c) => c.trim())
                  .filter(Boolean)
                  .map((crop) => (
                    <span
                      key={crop}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800"
                    >
                      {crop}
                    </span>
                  ))}
              </div>
            )}
          </section>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 rounded-lg transition-colors"
            >
              {isSaving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TenantProfile;
