// The six KPI cards on every list page (docs/API_REFERENCE.md, "KPIs: the same six everywhere"),
// from the list's stats.kpis, so they follow the current filters. Pure, no React.
// "—" when a value is zero or missing.

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const count = (n) => Number(n ?? 0).toLocaleString("en-IN");

// ₹45,000 · ₹1.5 L · ₹1.2 Cr
export function shortRupees(amount) {
  if (amount == null) return "—";
  if (amount >= 1e7) return `₹${+(amount / 1e7).toFixed(2)} Cr`;
  if (amount >= 1e5) return `₹${+(amount / 1e5).toFixed(1)} L`;
  return inr.format(amount);
}

const n = (v) => (v ? count(v) : "—");

// -> [{ label, value, tone? }] for SectionShell's stats
export function kpiCards(kpis) {
  const k = kpis ?? {};
  return [
    { label: "Total leads", value: n(k.total) },
    { label: "Interested", value: n(k.interested), tone: k.interested ? "emerald" : undefined },
    { label: "Not interested", value: n(k.not_interested), tone: k.not_interested ? "rose" : undefined },
    {
      label: "Quoted amount",
      value: k.quoted_count ? shortRupees(k.quoted_total ?? 0) : "—",
    },
    {
      label: "Converted",
      value: n(k.converted),
      tone: k.converted ? "emerald" : undefined,
    },
    {
      label: "Conversion amount",
      value: k.conversion_count ? shortRupees(k.conversion_total ?? 0) : "—",
    },
  ];
}
