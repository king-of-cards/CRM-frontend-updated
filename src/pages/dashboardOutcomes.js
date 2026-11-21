// CRM outcomes under each Dashboard source tile (docs/API_REFERENCE.md section 9, `outcomes`).
// Pure helpers, no React.
//   INTERESTED  12      CONVERTED  5      QUOTATION AMOUNT  ₹2.4 L · 6 quotes
//   CONVERSION AMOUNT  ₹1.8 L · 4
// Each value links to the source's list with the matching filter and the Dashboard's period.
// A value that is 0, or a source with no outcomes (spin when the workflow DB can't be read),
// shows "—" and isn't a link.

import { AOV_FILTERS } from "./aov.js";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

// ₹45,000 · ₹1.5 L · ₹1.2 Cr
export function shortRupees(amount) {
  if (amount == null) return "—";
  if (amount >= 1e7) return `₹${+(amount / 1e7).toFixed(2)} Cr`;
  if (amount >= 1e5) return `₹${+(amount / 1e5).toFixed(1)} L`;
  return inr.format(amount);
}

const count = (n) => Number(n).toLocaleString("en-IN");
const quotes = (n) => `${count(n)} ${n === 1 ? "quote" : "quotes"}`;

// [{ key, label, text, filter }] for one source; filter is null when the value isn't a link
export function outcomeCells(outcome) {
  const o = outcome ?? null;
  const interested = o?.interested ?? 0;
  const converted = o?.converted ?? 0;
  const quoted = o?.quoted_count ?? 0;
  const conversions = o?.conversion_count ?? 0;
  return [
    {
      key: "interested",
      label: "INTERESTED",
      text: interested ? count(interested) : "—",
      filter: interested ? { update_status: "interested" } : null,
    },
    {
      key: "converted",
      label: "CONVERTED",
      text: converted ? count(converted) : "—",
      filter: converted ? { update_status: "converted" } : null,
    },
    {
      key: "quoted",
      label: "QUOTATION AMOUNT",
      text: quoted ? `${shortRupees(o.quoted_total ?? 0)} · ${quotes(quoted)}` : "—",
      filter: quoted ? { quote: "has" } : null,
    },
    {
      key: "conversion",
      label: "CONVERSION AMOUNT",
      text: conversions ? `${shortRupees(o.conversion_total ?? 0)} · ${count(conversions)}` : "—",
      filter: conversions ? { conversion: "has" } : null,
    },
  ];
}

// The list page URL: the filter, then the Dashboard's period (no dates for All time)
export function outcomeLink(path, filter, period) {
  const params = new URLSearchParams(filter);
  if (!period.all) {
    params.set("date_from", period.from);
    params.set("date_to", period.to);
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

const SOURCE_PATHS = {
  spin: "/leads/spin",
  whatsapp: "/leads/international",
  wedding: "/leads/wedding",
  wedding_planner: "/leads/wedding-planner",
};
const SOURCE_LABELS = { spin: "Spin leads", whatsapp: "International", wedding: "Wedding", wedding_planner: "Wedding planner" };

// The list filter and the count behind each chooser KPI. "aov": exactly the leads AOV averages
// (converted, with a conversion amount).
const KPI_KINDS = {
  quotes: { filter: { quote: "has" }, count: (o) => o.quotes_count ?? o.quoted_count },
  hot: { filter: { hot: "yes" }, count: (o) => o.hot_count ?? 0 },
  aov: { filter: AOV_FILTERS, count: (o) => o.conversion_amount_count ?? 0 },
};

// sources: the sources this login sees (vendor logins: theirs); others are never offered
export function sourceKpiDestinations(outcomes, kind, period, sources = null) {
  const { filter, count: countOf } = KPI_KINDS[kind] ?? KPI_KINDS.hot;
  return Object.entries(SOURCE_PATHS)
    .filter(([source]) => !sources || sources.includes(source))
    .filter(([source]) => outcomes?.[source] != null && Number(countOf(outcomes[source])) > 0)
    .map(([source, path]) => ({
      source,
      label: SOURCE_LABELS[source],
      count: Number(countOf(outcomes[source])),
      to: outcomeLink(path, filter, period),
    }));
}

// One visible source (e.g. a vendor login with only Spin): every KPI card links straight to that
// list with its filter and the period; null when the source has no list
export function singleSourceKpiLinks(source, period) {
  const path = SOURCE_PATHS[source];
  if (!path) return null;
  const link = (filter) => outcomeLink(path, filter, period);
  return {
    total: link({}),
    interested: link({ update_status: "interested" }),
    not_interested: link({ update_status: "not_interested" }),
    quoted: link({ quote: "has" }),
    converted: link({ update_status: "converted" }),
    conversion: link({ conversion: "has" }),
    aov: link(AOV_FILTERS),
    quotes: link({ quote: "has" }),
    hot: link({ hot: "yes" }),
  };
}

// The source tiles' grid for any count: one tile spans the row, two and three share it evenly,
// four keep the 2 / 4 columns
export function tileGridClass(count) {
  if (count <= 1) return "grid-cols-1";
  if (count === 2) return "sm:grid-cols-2";
  if (count === 3) return "sm:grid-cols-2 lg:grid-cols-3";
  return "sm:grid-cols-2 xl:grid-cols-4";
}
