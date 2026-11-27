import { Coins } from "lucide-react";
import { cleanPercent, parsePercent, payoutAmount, percentError } from "./payout.js";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

// The "Payout (%)" box under Conversion amount, with the payout in rupees worked out live.
// Only useful once the lead has a conversion amount, so it waits for that first.
export default function PayoutField({ conversion, value, onChange, fieldCls, readOnly = false, className = "" }) {
  const digits = String(conversion ?? "").replace(/\D/g, "");
  const hasConversion = Boolean(digits) && Number(digits) > 0;
  const percent = parsePercent(value);
  const amount = payoutAmount(hasConversion ? Number(digits) : null, percent);
  const error = percentError(value);
  return (
    <div className={className}>
      <label className="block">
        <span className="text-xs font-medium text-gray-600">Payout (% of conversion)</span>
        <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <div className="relative">
            <input
              inputMode="decimal"
              value={value}
              disabled={readOnly || !hasConversion}
              onChange={(e) => onChange(cleanPercent(e.target.value))}
              placeholder={hasConversion ? "e.g. 10" : "Add the conversion amount first"}
              aria-invalid={Boolean(error)}
              className={`${fieldCls} pr-8 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400`}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
          </div>
          <span
            className={`inline-flex min-w-[7.5rem] items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold tabular-nums ring-1 ${
              amount != null ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-gray-50 text-gray-400 ring-gray-100"
            }`}
            aria-live="polite"
            title="Payout = conversion amount × %"
          >
            <Coins size={14} aria-hidden="true" />
            {amount != null ? inr.format(amount) : "₹—"}
          </span>
        </div>
      </label>
      {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
