// Payout: the commission on a converted lead, as a % of its conversion amount.
//   KOC → Vendors leads: what KOC earns from the vendor.
//   Vendors → KOC leads: what the vendor earns from KOC.
// Each lead stores payout_percent (e.g. 10 or 7.5) and payout_amount (rupees, worked out here as
// conversion amount × % ÷ 100, rounded). The dashboards add up payout_amount.

export const PAYOUT_LABEL = "Payout";

// What's typed in the % box: digits and one dot, at most 3 digits before it and 2 after
export function cleanPercent(text) {
  const raw = String(text ?? "").replace(/[^\d.]/g, "");
  const [whole = "", ...rest] = raw.split(".");
  const decimals = rest.join("").slice(0, 2);
  return raw.includes(".") ? `${whole.slice(0, 3)}.${decimals}` : whole.slice(0, 3);
}

// "10" / "7.5" -> 10 / 7.5; "" -> null; anything not a number -> NaN
export function parsePercent(text) {
  const t = String(text ?? "").trim();
  if (!t || t === ".") return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

// A problem with the % (shown under the box), or "" when it's fine
export function percentError(text) {
  const p = parsePercent(text);
  if (p == null) return "";
  if (Number.isNaN(p) || p < 0 || p > 100) return "Payout % must be between 0 and 100.";
  return "";
}

// Conversion amount (rupees) × % -> payout in rupees; null when either is missing
export function payoutAmount(conversion, percent) {
  const c = Number(conversion);
  const p = Number(percent);
  if (!c || c <= 0 || percent == null || Number.isNaN(p) || p <= 0) return null;
  return Math.round((c * p) / 100);
}

// The two values a save sends, from the form's text boxes
export function payoutValues(conversionText, percentText) {
  const digits = String(conversionText ?? "").replace(/\D/g, "");
  const conversion = digits ? Number(digits) : null;
  const percent = parsePercent(percentText);
  const valid = percent != null && !Number.isNaN(percent);
  return {
    payout_percent: valid ? percent : null,
    payout_amount: valid ? payoutAmount(conversion, percent) : null,
  };
}

// For read-only lists: "₹7,500 (10%)"
export function payoutText(amount, percent, inr) {
  if (amount == null && percent == null) return null;
  const money = amount != null ? inr.format(amount) : "—";
  return percent != null ? `${money} (${percent}%)` : money;
}
