import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import usePageTitle from "../../hooks/usePageTitle";
import {
  useGetBillingQuery,
  useTopUpBillingMutation,
} from "../../redux/apislices/userDashboardApiSlice";

const formatCardNumber = (val: string) =>
  val
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(\d{4})(?=\d)/g, "$1 ");

const formatExpiry = (val: string) => {
  const d = val.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

const SetupBilling = () => {
  usePageTitle("Setup Billing — VerdantIQ");
  const navigate = useNavigate();
  const { data: billing } = useGetBillingQuery();
  const [topUp, { isLoading }] = useTopUpBillingMutation();

  const [form, setForm] = useState({
    amount: "",
    cardholder_name: "",
    card_number: "",
    card_expiry: "",
    card_cvv: "",
  });

  const [errors, setErrors] = useState<Partial<typeof form>>({});

  const set = (field: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const validate = () => {
    const e: Partial<typeof form> = {};
    const amount = parseFloat(form.amount);
    if (!form.amount || isNaN(amount) || amount <= 0) e.amount = "Enter a valid amount";
    if (!form.cardholder_name.trim()) e.cardholder_name = "Required";
    const rawCard = form.card_number.replace(/\s/g, "");
    if (rawCard.length < 13 || rawCard.length > 16) e.card_number = "Enter a valid card number";
    const expiryParts = form.card_expiry.split("/");
    if (
      expiryParts.length !== 2 ||
      expiryParts[0].length !== 2 ||
      expiryParts[1].length !== 2
    )
      e.card_expiry = "Format: MM/YY";
    if (form.card_cvv.length < 3) e.card_cvv = "3–4 digits";
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    try {
      await topUp({
        amount: parseFloat(form.amount),
        cardholder_name: form.cardholder_name.trim(),
        card_number: form.card_number.replace(/\s/g, ""),
        card_expiry: form.card_expiry,
        card_cvv: form.card_cvv,
      }).unwrap();

      toast.success("Top-up successful! Billing is now active.");
      navigate("/billing/transactions");
    } catch (err) {
      const msg =
        (err as { data?: { detail?: string } })?.data?.detail ??
        "Top-up failed. Please try again.";
      toast.error(msg);
    }
  };

  const inputCls = (err?: string) =>
    `w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition ${
      err ? "border-red-300 bg-red-50" : "border-gray-200"
    }`;

  return (
    <div className="px-6 py-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-lg font-semibold text-gray-800">Setup Billing</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Top up your account to activate billing and start onboarding sensors.
        </p>
      </div>

      <div className="max-w-lg space-y-6">
        {/* Current balance card */}
        {billing && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Current balance</p>
              <p className="text-2xl font-bold text-gray-800 mt-0.5">
                ${((billing.balance ?? 0)).toFixed(2)}
              </p>
            </div>
            <span
              className={`text-xs font-semibold px-3 py-1 rounded-full capitalize ${
                billing.status === "active"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {billing.status}
            </span>
          </div>
        )}

        {/* Top-up form */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          <h2 className="text-base font-bold text-gray-900 mb-6">Add funds</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Amount */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Amount (USD) *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-4 flex items-center text-gray-400 text-sm select-none">
                  $
                </span>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => set("amount", e.target.value)}
                  placeholder="0.00"
                  className={`${inputCls(errors.amount)} pl-8`}
                />
              </div>
              {errors.amount && <p className="mt-1 text-xs text-red-500">{errors.amount}</p>}
            </div>

            <hr className="border-gray-100" />

            {/* Cardholder name */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Cardholder name *
              </label>
              <input
                type="text"
                value={form.cardholder_name}
                onChange={(e) => set("cardholder_name", e.target.value)}
                placeholder="John Doe"
                className={inputCls(errors.cardholder_name)}
              />
              {errors.cardholder_name && (
                <p className="mt-1 text-xs text-red-500">{errors.cardholder_name}</p>
              )}
            </div>

            {/* Card number */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Card number *
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={form.card_number}
                onChange={(e) => set("card_number", formatCardNumber(e.target.value))}
                placeholder="1234 5678 9012 3456"
                maxLength={19}
                className={inputCls(errors.card_number)}
              />
              {errors.card_number && (
                <p className="mt-1 text-xs text-red-500">{errors.card_number}</p>
              )}
            </div>

            {/* Expiry + CVV */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Expiry *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.card_expiry}
                  onChange={(e) => set("card_expiry", formatExpiry(e.target.value))}
                  placeholder="MM/YY"
                  maxLength={5}
                  className={inputCls(errors.card_expiry)}
                />
                {errors.card_expiry && (
                  <p className="mt-1 text-xs text-red-500">{errors.card_expiry}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  CVV *
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={form.card_cvv}
                  onChange={(e) =>
                    set("card_cvv", e.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                  placeholder="•••"
                  maxLength={4}
                  className={inputCls(errors.card_cvv)}
                />
                {errors.card_cvv && (
                  <p className="mt-1 text-xs text-red-500">{errors.card_cvv}</p>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold py-3 rounded-lg transition-colors mt-2"
            >
              {isLoading ? "Processing…" : `Top Up${form.amount ? ` $${parseFloat(form.amount || "0").toFixed(2)}` : ""}`}
            </button>
          </form>

          {/* Security note */}
          <div className="mt-5 flex items-center justify-center gap-2 text-xs text-gray-400">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Payment details are encrypted and never stored.
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupBilling;
