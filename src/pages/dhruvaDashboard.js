// Dhruva dashboard helpers (GET /analytics/dhruva, docs section 13). Pure, no React.
// Every KPI number links to the Dhruva list with matching filters and the period;
// 0 / null show "—" and are not links.
import { PENDING, STATUSES, dhruvaListLink, shortRupees } from "./dhruvaUtils.js";

export const num = (n) => (n == null || n === 0 ? "—" : Number(n).toLocaleString("en-IN"));

// Link to the list for a count (null when it shows "—")
export const linkFor = (count, filters, period) =>
  count ? dhruvaListLink(filters, period) : null;

// Update breakdown rows: Pending first, then the 7 statuses
export function statusRows(byStatus) {
  const b = byStatus ?? {};
  return [
    { key: PENDING, label: "Pending", count: b.pending ?? 0, filters: { update_status: [PENDING] } },
    ...STATUSES.map((s) => ({
      key: s.value,
      label: s.label,
      count: b[s.value] ?? 0,
      filters: { update_status: [s.value] },
    })),
  ];
}

// KPI cards for the dashboard (8 cards; "Total leads" is not clickable)
export function dashboardKpiCards(kpis, period) {
  const k = kpis ?? {};
  const link = (filters) => dhruvaListLink(filters, period);
  return [
    { label: "Total leads", value: num(k.total), to: null },
    {
      label: "Pending",
      value: num(k.pending),
      to: k.pending ? link({ update_status: [PENDING] }) : null,
    },
    {
      label: "Interested",
      value: num(k.interested),
      to: k.interested ? link({ update_status: ["interested"] }) : null,
    },
    {
      label: "Not interested",
      value: num(k.not_interested),
      to: k.not_interested ? link({ update_status: ["not_interested"] }) : null,
    },
    {
      label: "Quoted amount",
      value: k.quoted_count
        ? `${shortRupees(k.quoted_total)} · ${Number(k.quoted_count).toLocaleString("en-IN")} ${k.quoted_count === 1 ? "quote" : "quotes"}`
        : "—",
      to: k.quoted_count ? link({ quote: "has" }) : null,
    },
    {
      label: "Converted",
      value: k.converted
        ? `${num(k.converted)}${k.converted_pct != null ? ` · ${k.converted_pct}%` : ""}`
        : "—",
      to: k.converted ? link({ update_status: ["converted"] }) : null,
    },
    {
      label: "Conversion amount",
      value: k.conversion_count ? shortRupees(k.conversion_total) : "—",
      to: k.conversion_count ? link({ conversion: "has" }) : null,
    },
    {
      label: "Upcoming events (30 days)",
      value: num(k.upcoming_30_days),
      to: k.upcoming_30_days ? link({ upcoming_days: "30" }) : null,
    },
  ];
}

export const pctText = (p) => (p == null ? "—" : `${p}%`);
