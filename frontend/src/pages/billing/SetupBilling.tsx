import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import usePageTitle from "../../hooks/usePageTitle";
import { useGetMeQuery } from "../../redux/apislices/authApiSlice";
import {
  useGetBillingQuery,
  useGetSensorsQuery,
  useTopUpBillingMutation,
} from "../../redux/apislices/userDashboardApiSlice";

const COST_PER_MESSAGE = 0.00005;

// ── Payment method catalogue ─────────────────────────────────────────────────

type MethodKey = "credit_card" | "paypal" | "bank_transfer" | "skrill" | "revolut";

interface PaymentOption {
  key: MethodKey;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const CreditCardIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
  </svg>
);

const PAYMENT_OPTIONS: PaymentOption[] = [
  {
    key: "credit_card",
    label: "Credit / Debit Card",
    description: "Visa, Mastercard, Amex",
    icon: <CreditCardIcon />,
  },
  {
    key: "paypal",
    label: "PayPal",
    description: "Pay with your PayPal account",
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M7.076 21.337H4.108c-.28 0-.474-.178-.516-.432L1.08 3.93c-.028-.188.107-.36.298-.36h2.82c.28 0 .474.178.516.432l.55 3.456h2.208c2.928 0 4.846 1.344 5.294 3.77.208 1.106.06 1.98-.41 2.596-.52.67-1.46 1.024-2.75 1.024H8.082l-.652 6.12c-.028.193-.191.37-.354.37zm9.348-9.48c-.226-1.5-1.378-2.27-3.36-2.27H11.3l-.762 4.96h1.522c1.218 0 2.108-.268 2.65-.798.528-.518.72-1.298.514-2.292 0-.006 0-.012-.002-.018l.002-.018c.006-.032.008-.064.008-.098 0-.164-.003-.326-.008-.487z" />
      </svg>
    ),
  },
  {
    key: "bank_transfer",
    label: "Wire Transfer",
    description: "Bank-to-bank transfer",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
      </svg>
    ),
  },
  {
    key: "skrill",
    label: "Skrill",
    description: "Pay with your Skrill wallet",
    icon: (
      <div className="w-6 h-6 rounded-full bg-violet-600 text-white flex items-center justify-center text-xs font-bold">
        S
      </div>
    ),
  },
  {
    key: "revolut",
    label: "Revolut",
    description: "Pay with your Revolut account",
    icon: (
      <div className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold">
        R
      </div>
    ),
  },
];

// ── Formatters ────────────────────────────────────────────────────────────────

const formatCardNumber = (val: string) =>
  val
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(\d{4})(?=\d)/g, "$1 ");

const formatExpiry = (val: string) => {
  const d = val.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

// ── Method-specific forms ─────────────────────────────────────────────────────

interface FormProps {
  onBack: () => void;
  balance: number;
}

function CardForm({ onBack, balance }: FormProps) {
  const navigate = useNavigate();
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
    if (!form.amount || isNaN(+form.amount) || +form.amount <= 0) e.amount = "Enter a valid amount";
    if (!form.cardholder_name.trim()) e.cardholder_name = "Required";
    if (form.card_number.replace(/\s/g, "").length < 13) e.card_number = "Invalid card number";
    if (!/^\d{2}\/\d{2}$/.test(form.card_expiry)) e.card_expiry = "Format: MM/YY";
    if (form.card_cvv.length < 3) e.card_cvv = "3–4 digits";
    return e;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    try {
      await topUp({
        amount: +form.amount,
        payment_method: "credit_card",
        cardholder_name: form.cardholder_name.trim(),
        card_number: form.card_number.replace(/\s/g, ""),
        card_expiry: form.card_expiry,
        card_cvv: form.card_cvv,
      }).unwrap();
      toast.success("Top-up successful! Billing is now active.");
      navigate("/billing/transactions");
    } catch (err) {
      toast.error((err as { data?: { detail?: string } })?.data?.detail ?? "Top-up failed.");
    }
  };

  const inp = (err?: string) =>
    `w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition ${err ? "border-red-300 bg-red-50" : "border-gray-200"}`;

  return (
    <form onSubmit={submit} className="space-y-5">
      <BackButton onClick={onBack} />
      <AmountField value={form.amount} error={errors.amount}
        onChange={(v) => set("amount", v)} balance={balance} />
      <hr className="border-gray-100" />
      <div>
        <label className={labelCls}>Cardholder name *</label>
        <input value={form.cardholder_name} onChange={(e) => set("cardholder_name", e.target.value)}
          placeholder="John Doe" className={inp(errors.cardholder_name)} />
        {errors.cardholder_name && <Err>{errors.cardholder_name}</Err>}
      </div>
      <div>
        <label className={labelCls}>Card number *</label>
        <input inputMode="numeric" value={form.card_number} maxLength={19}
          onChange={(e) => set("card_number", formatCardNumber(e.target.value))}
          placeholder="1234 5678 9012 3456" className={inp(errors.card_number)} />
        {errors.card_number && <Err>{errors.card_number}</Err>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Expiry *</label>
          <input inputMode="numeric" value={form.card_expiry} maxLength={5}
            onChange={(e) => set("card_expiry", formatExpiry(e.target.value))}
            placeholder="MM/YY" className={inp(errors.card_expiry)} />
          {errors.card_expiry && <Err>{errors.card_expiry}</Err>}
        </div>
        <div>
          <label className={labelCls}>CVV *</label>
          <input type="password" inputMode="numeric" value={form.card_cvv} maxLength={4}
            onChange={(e) => set("card_cvv", e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="•••" className={inp(errors.card_cvv)} />
          {errors.card_cvv && <Err>{errors.card_cvv}</Err>}
        </div>
      </div>
      <SubmitBtn loading={isLoading} amount={form.amount} />
      <SecurityNote />
    </form>
  );
}

function EmailWalletForm({
  method,
  label,
  onBack,
  balance,
}: FormProps & { method: MethodKey; label: string }) {
  const navigate = useNavigate();
  const [topUp, { isLoading }] = useTopUpBillingMutation();
  const [form, setForm] = useState({ amount: "", payer_email: "" });
  const [errors, setErrors] = useState<Partial<typeof form>>({});

  const set = (field: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [field]: v }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Partial<typeof form> = {};
    if (!form.amount || +form.amount <= 0) errs.amount = "Enter a valid amount";
    if (!form.payer_email.trim()) errs.payer_email = "Required";
    if (Object.keys(errs).length) { setErrors(errs); return; }
    try {
      await topUp({ amount: +form.amount, payment_method: method, payer_email: form.payer_email }).unwrap();
      toast.success("Top-up successful! Billing is now active.");
      navigate("/billing/transactions");
    } catch (err) {
      toast.error((err as { data?: { detail?: string } })?.data?.detail ?? "Top-up failed.");
    }
  };

  const inp = (err?: string) =>
    `w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition ${err ? "border-red-300 bg-red-50" : "border-gray-200"}`;

  return (
    <form onSubmit={submit} className="space-y-5">
      <BackButton onClick={onBack} />
      <AmountField value={form.amount} error={errors.amount}
        onChange={(v) => set("amount", v)} balance={balance} />
      <div>
        <label className={labelCls}>{label} email *</label>
        <input type="email" value={form.payer_email}
          onChange={(e) => set("payer_email", e.target.value)}
          placeholder={`your@${method}.com`}
          className={inp(errors.payer_email)} />
        {errors.payer_email && <Err>{errors.payer_email}</Err>}
      </div>
      <SubmitBtn loading={isLoading} amount={form.amount} />
      <SecurityNote />
    </form>
  );
}

function WireTransferForm({ onBack, balance }: FormProps) {
  const navigate = useNavigate();
  const [topUp, { isLoading }] = useTopUpBillingMutation();
  const [form, setForm] = useState({ amount: "", reference: "" });
  const [errors, setErrors] = useState<Partial<typeof form>>({});

  const set = (field: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [field]: v }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Partial<typeof form> = {};
    if (!form.amount || +form.amount <= 0) errs.amount = "Enter a valid amount";
    if (!form.reference.trim()) errs.reference = "Required";
    if (Object.keys(errs).length) { setErrors(errs); return; }
    try {
      await topUp({ amount: +form.amount, payment_method: "bank_transfer", reference: form.reference }).unwrap();
      toast.success("Wire transfer recorded! Billing activated once funds clear.");
      navigate("/billing/transactions");
    } catch (err) {
      toast.error((err as { data?: { detail?: string } })?.data?.detail ?? "Failed to record transfer.");
    }
  };

  const inp = (err?: string) =>
    `w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition ${err ? "border-red-300 bg-red-50" : "border-gray-200"}`;

  return (
    <form onSubmit={submit} className="space-y-5">
      <BackButton onClick={onBack} />
      {/* Bank details block */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 space-y-2 text-sm">
        <p className="font-semibold text-gray-700 mb-3">Wire funds to:</p>
        {[
          ["Bank", "VerdantIQ Financial Services"],
          ["Account name", "VerdantIQ Ltd"],
          ["IBAN", "GB29 NWBK 6016 1331 9268 19"],
          ["BIC / SWIFT", "NWBKGB2L"],
          ["Reference", "Your company name or tenant ID"],
        ].map(([k, v]) => (
          <div key={k} className="flex gap-3">
            <span className="text-gray-400 w-28 shrink-0">{k}</span>
            <span className="text-gray-800 font-medium">{v}</span>
          </div>
        ))}
      </div>
      <AmountField value={form.amount} error={errors.amount}
        onChange={(v) => set("amount", v)} balance={balance} />
      <div>
        <label className={labelCls}>Transfer reference *</label>
        <input value={form.reference}
          onChange={(e) => set("reference", e.target.value)}
          placeholder="e.g. your company name or invoice number"
          className={inp(errors.reference)} />
        {errors.reference && <Err>{errors.reference}</Err>}
        <p className="mt-1 text-xs text-gray-400">
          Use the same reference you entered in your bank transfer.
        </p>
      </div>
      <SubmitBtn loading={isLoading} amount={form.amount} label="Confirm Transfer" />
    </form>
  );
}

// ── Shared sub-components ────────────────────────────────────────────────────

const labelCls = "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5";

function Err({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs text-red-500">{children}</p>;
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700 font-medium mb-1">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      Change payment method
    </button>
  );
}

function AmountField({
  value, error, onChange, balance,
}: { value: string; error?: string; onChange: (v: string) => void; balance: number }) {
  return (
    <div>
      <label className={labelCls}>Amount (USD) *</label>
      {balance > 0 && (
        <p className="text-xs text-gray-400 mb-1.5">Current balance: ${balance.toFixed(2)}</p>
      )}
      <div className="relative">
        <span className="absolute inset-y-0 left-4 flex items-center text-gray-400 text-sm select-none">$</span>
        <input type="number" min="1" step="0.01" value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0.00"
          className={`w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition pl-8 ${error ? "border-red-300 bg-red-50" : "border-gray-200"}`} />
      </div>
      {error && <Err>{error}</Err>}
    </div>
  );
}

function SubmitBtn({ loading, amount, label }: { loading: boolean; amount: string; label?: string }) {
  const parsed = parseFloat(amount || "0");
  const amountStr = !isNaN(parsed) && parsed > 0 ? ` $${parsed.toFixed(2)}` : "";
  return (
    <button type="submit" disabled={loading}
      className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold py-3 rounded-lg transition-colors mt-1">
      {loading ? "Processing…" : `${label ?? "Top Up"}${amountStr}`}
    </button>
  );
}

function SecurityNote() {
  return (
    <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
      Payment details are encrypted and never stored.
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

const SetupBilling = () => {
  usePageTitle("Setup Billing — VerdantIQ");
  const { data: me }      = useGetMeQuery();
  const { data: billing } = useGetBillingQuery();
  // Feature 3: fetch sensors to compute current cost
  const { data: sensorsPage } = useGetSensorsQuery(
    { tenant_id: me?.tenant_id ?? 0, per_page: 100 },
    { skip: !me, pollingInterval: 30_000 },
  );
  const balance    = billing?.balance ?? 0;
  const totalCost  = (sensorsPage?.items ?? []).reduce(
    (sum, s) => sum + s.message_count * COST_PER_MESSAGE, 0,
  );

  const [selectedMethod, setSelectedMethod] = useState<MethodKey | null>(null);

  const renderForm = () => {
    const props = { onBack: () => setSelectedMethod(null), balance };
    switch (selectedMethod) {
      case "credit_card":   return <CardForm {...props} />;
      case "paypal":        return <EmailWalletForm {...props} method="paypal" label="PayPal" />;
      case "skrill":        return <EmailWalletForm {...props} method="skrill" label="Skrill" />;
      case "revolut":       return <EmailWalletForm {...props} method="revolut" label="Revolut" />;
      case "bank_transfer": return <WireTransferForm {...props} />;
      default:              return null;
    }
  };

  return (
    <div className="px-6 py-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-lg font-semibold text-gray-800">Setup Billing</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {selectedMethod
            ? `Add funds via ${PAYMENT_OPTIONS.find((o) => o.key === selectedMethod)?.label}`
            : "Choose how you'd like to top up your account"}
        </p>
      </div>

      <div className="max-w-lg space-y-6">
        {/* Feature 3: Balance + Current Cost cards */}
        {billing && (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Current balance</p>
                <p className="text-2xl font-bold text-gray-800 mt-0.5">${balance.toFixed(2)}</p>
              </div>
              <span className={`text-xs font-semibold px-3 py-1 rounded-full capitalize ${
                billing.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
              }`}>
                {billing.status}
              </span>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Current cost</p>
              <p className="text-2xl font-bold text-purple-600 mt-0.5">${totalCost.toFixed(4)}</p>
              <p className="text-xs text-gray-400 mt-1">
                {(billing.message_count ?? 0).toLocaleString()} msgs × $0.00005
              </p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          {!selectedMethod ? (
            /* ── Payment method selection ── */
            <div className="space-y-3">
              <h2 className="text-base font-bold text-gray-900 mb-5">
                Select payment method
              </h2>
              {PAYMENT_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setSelectedMethod(opt.key)}
                  className="w-full flex items-center gap-4 px-5 py-4 border border-gray-200 rounded-xl hover:border-emerald-400 hover:bg-emerald-50/40 transition-colors text-left group"
                >
                  <span className="text-emerald-600 group-hover:scale-110 transition-transform">
                    {opt.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{opt.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{opt.description}</p>
                  </div>
                  <svg className="w-4 h-4 text-gray-300 group-hover:text-emerald-500 transition-colors shrink-0"
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          ) : (
            /* ── Method-specific form ── */
            <>
              <h2 className="text-base font-bold text-gray-900 mb-6">Add funds</h2>
              {renderForm()}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SetupBilling;
