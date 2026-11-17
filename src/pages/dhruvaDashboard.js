// Dhruva dashboard helpers (GET /analytics/dhruva, docs section 13). Pure, no React.
// Every KPI card links to the Dhruva list with matching filters and the period;
// 0 / null still open the matching filtered list.
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

// KPI cards link to matching Dhruva lead filters and preserve the received-date period.
export function dashboardKpiCards(kpis, period) {
  const k = kpis ?? {};
  const link = (filters) => dhruvaListLink(filters, period);
  return [
    { label: "Total leads", value: num(k.total), to: link({}) },
    {
      label: "Pending",
      value: num(k.pending),
      to: link({ update_status: [PENDING] }),
    },
    {
      label: "Interested",
      value: num(k.interested),
      to: link({ update_status: ["interested"] }),
    },
    {
      label: "Not interested",
      value: num(k.not_interested),
      to: link({ update_status: ["not_interested"] }),
    },
    {
      label: "Quoted amount",
      value: k.quoted_count ? shortRupees(k.quoted_total) : "—",
      to: link({ quote: "has" }),
    },
    {
      label: "Converted",
      value: num(k.converted),
      to: link({ update_status: ["converted"] }),
    },
    {
      label: "Conversion amount",
      value: k.conversion_count ? shortRupees(k.conversion_total) : "—",
      to: link({ update_status: ["converted"] }),
    },
    {
      label: "Upcoming events (30 days)",
      value: num(k.upcoming_30_days),
      to: link({ upcoming_days: "30" }),
    },
  ];
}

export const pctText = (p) => (p == null ? "—" : `${p}%`);
