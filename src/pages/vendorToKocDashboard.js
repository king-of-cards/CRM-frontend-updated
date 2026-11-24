// Vendors → KOC dashboard helpers (GET /analytics/vendor-to-koc, docs section 11). Pure.
// Available count links open the Vendors → KOC list with matching filters and the period;
// 0 / null show "—". Quoted amount and Quotes sent open quote=has; Conversion amount conversion=has.
import {
  ENGAGED,
  kocListLink,
  PENDING,
  SOURCES,
  STATUSES,
  UPDATED,
} from "../components/vendorToKoc/kocUtils.js";
import { AOV_FILTERS } from "./aov.js";
import { dhruvaListLink } from "./dhruvaUtils.js";

export const num = (n) => (n == null || n === 0 ? "—" : Number(n).toLocaleString("en-IN"));

// The list link for a count, or null when it shows "—"
export const linkFor = (count, filters, period) => (count ? kocListLink(filters, period) : null);

// The KPI cards' links: the Vendor -> KOC list with the matching filter and the dashboard period
// (the list's quote / conversion filters, docs section 11)
export function dashboardKpiLinks(period) {
  return {
    total: kocListLink({}, period),
    interested: kocListLink({ update_status: ["interested"] }, period),
    quoted_amount: kocListLink({ quote: "has" }, period),
    quotes_sent: kocListLink({ quote: "has" }, period),
    hot_leads: kocListLink({ hot: "yes" }, period),
    conversion_amount: kocListLink({ conversion: "has" }, period),
    pending: kocListLink({ update_status: [PENDING] }, period),
    follow_ups_due: kocListLink({ follow_up_due: "true" }, { all: true }),
    converted: kocListLink({ update_status: ["converted"] }, period),
    // AOV: exactly the leads it averages (converted, with a conversion amount)
    aov: kocListLink(AOV_FILTERS, period),
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

// Admin vendor tiles: one per vendor in per_vendor (every active vendor, zeros included, plus
// inactive vendors with leads in the period); any active vendor from /vendors that the answer
// leaves out gets a zero tile too. Order: the API's, then the added ones by name.
export function vendorTiles(perVendor, vendors = []) {
  const tiles = (perVendor ?? []).map((v) => ({
    vendor_id: v.vendor_id,
    vendor_name: v.vendor_name,
    is_active: v.is_active !== false,
    leads: v.leads ?? 0,
    interested: v.interested ?? 0,
    converted: v.converted ?? 0,
    pending: v.pending ?? 0,
  }));
  const shown = new Set(tiles.map((t) => String(t.vendor_id)));
  const missing = (vendors ?? [])
    .filter((v) => v && v.is_active !== false && !shown.has(String(v.id)))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)))
    .map((v) => ({ vendor_id: v.id, vendor_name: v.name, is_active: true, leads: 0, interested: 0, converted: 0, pending: 0 }));
  return [...tiles, ...missing];
}

// The Dhruva partner tile (dashboard "dhruva": received, interested, converted, pending over the
// Dhruva → KOC leads of the period): every number opens /dhruva-leads with the same period.
// null when the API sends no summary (vendor logins, older APIs).
export function dhruvaTile(dhruva, period) {
  if (!dhruva) return null;
  const link = (filters, n) => (n ? dhruvaListLink(filters, period) : null);
  return {
    name: "Dhruva",
    to: dhruvaListLink({}, period),
    leads: dhruva.received ?? 0,
    leadsTo: link({}, dhruva.received),
    cells: [
      { key: "interested", label: "INTERESTED", count: dhruva.interested ?? 0, to: link({ update_status: ["interested"] }, dhruva.interested) },
      { key: "converted", label: "CONVERTED", count: dhruva.converted ?? 0, to: link({ update_status: ["converted"] }, dhruva.converted) },
      { key: "pending", label: "PENDING", count: dhruva.pending ?? 0, to: link({ update_status: [PENDING] }, dhruva.pending) },
    ],
  };
}
