// Vendors → KOC dashboard helpers (GET /analytics/vendor-to-koc, docs section 11). Pure.
// Available count links open the Vendors → KOC list with matching filters and the period;
// 0 / null show "—". Quote and conversion amount cards have no list filters.
import {
  ENGAGED,
  kocListLink,
  PENDING,
  SOURCES,
  STATUSES,
  UPDATED,
} from "../components/vendorToKoc/kocUtils.js";

export const num = (n) => (n == null || n === 0 ? "—" : Number(n).toLocaleString("en-IN"));

// The list link for a count, or null when it shows "—"
export const linkFor = (count, filters, period) => (count ? kocListLink(filters, period) : null);

// Filters supported by the Vendor -> KOC list. Quote and conversion amounts have no
// corresponding list filter, so those cards remain informational.
export function dashboardKpiLinks(period) {
  return {
    total: kocListLink({}, period),
    interested: kocListLink({ update_status: ["interested"] }, period),
    quoted_amount: null,
    quotes_sent: null,
    hot_leads: kocListLink({ hot: "yes" }, period),
    conversion_amount: null,
    pending: kocListLink({ update_status: [PENDING] }, period),
    follow_ups_due: kocListLink({ follow_up_due: "true" }, { all: true }),
    converted: kocListLink({ update_status: ["converted"] }, period),
  };
}

// Inflow points for the chart: one key per vendor ("v<id>")
export function inflowPoints(inflow) {
  return (inflow ?? []).map((p) => {
    const point = { date: p.date, end: p.end, total: p.total };
    for (const [id, n] of Object.entries(p.vendors ?? {})) point[`v${id}`] = n;
    return point;
  });
}

// Update breakdown: Pending, then the 7 statuses (zeros kept, for the legend)
export function statusRows(byStatus) {
  const b = byStatus ?? {};
  return [
    { key: PENDING, label: "Pending", count: b.pending ?? 0, filters: { update_status: [PENDING] } },
    ...STATUSES.map((s) => ({ key: s.value, label: s.label, count: b[s.value] ?? 0, filters: { update_status: [s.value] } })),
  ];
}

// Funnel: received → updated (any status) → engaged → converted
export function funnelRows(funnel) {
  const f = funnel ?? {};
  return [
    { key: "received", label: "Received", count: f.received ?? 0, filters: {} },
    { key: "updated", label: "Updated", count: f.updated ?? 0, filters: { update_status: UPDATED } },
    { key: "engaged", label: "Engaged", count: f.engaged ?? 0, filters: { update_status: ENGAGED } },
    { key: "converted", label: "Converted", count: f.converted ?? 0, filters: { update_status: ["converted"] } },
  ];
}

export const sourceRows = (bySource) =>
  SOURCES.map((s) => ({ key: s.value, label: s.label, count: bySource?.[s.value] ?? 0, filters: { source: [s.value] } }));

// Per-vendor tile row: INTERESTED · CONVERTED · PENDING
export function vendorCells(v) {
  const vendor = { vendor_id: [String(v.vendor_id)] };
  return [
    { key: "interested", label: "INTERESTED", count: v.interested, filters: { ...vendor, update_status: ["interested"] } },
    { key: "converted", label: "CONVERTED", count: v.converted, filters: { ...vendor, update_status: ["converted"] } },
    { key: "pending", label: "PENDING", count: v.pending, filters: { ...vendor, update_status: [PENDING] } },
  ];
}

export const pctText = (p) => (p == null ? "—" : `${p}%`);
export const daysText = (d) => (d == null ? "—" : `${d} ${d === 1 ? "day" : "days"}`);

// Distinct line colours for vendors (cycled)
export const VENDOR_COLORS = ["#0ea5e9", "#8b5cf6", "#f43f5e", "#f59e0b", "#10b981", "#6366f1", "#ec4899", "#14b8a6"];
