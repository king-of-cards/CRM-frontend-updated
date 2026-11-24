const SOURCE_LABELS = {
  spin: "Spin",
  wedding: "Wedding",
  wedding_planner: "Wedding planner",
  vendor_to_koc: "Vendors → KOC",
  koc_to_dhruva: "KOC → Dhruva",
};

export function topCityTooltipData(row, defaultSource = null) {
  const counts = row?.by_source ?? (defaultSource ? { [defaultSource]: row?.count ?? 0 } : {});
  return Object.entries(counts)
    .filter(([source, count]) => SOURCE_LABELS[source] && Number(count) > 0)
    .map(([source, count]) => ({ source, label: SOURCE_LABELS[source], count: Number(count) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

// The card's subtitle from the API's top_cities_sources, in its order
// (e.g. "Spin, Wedding, Wedding planner, Vendors → KOC"); the fallback when there's no list
export function topCitiesSubtitle(sources, fallback = "All sources") {
  const labels = (sources ?? []).map((source) => SOURCE_LABELS[source] ?? source);
  return labels.length ? labels.join(", ") : fallback;
}

// The API's default Top cities sources per Lead flow (docs: "Top cities sources"). The dashboards
// send no `sources`, so these apply; they only name the card when top_cities_sources is empty.
export const TOP_CITIES_DEFAULTS = {
  "": ["spin", "wedding", "wedding_planner"],
  vendors: ["vendor_to_koc"],
};

// Subtitle for a flow: the API's top_cities_sources, else that flow's default sources
export function topCitiesSubtitleFor(sources, flow = "") {
  return topCitiesSubtitle(sources, topCitiesSubtitle(TOP_CITIES_DEFAULTS[flow] ?? TOP_CITIES_DEFAULTS[""]));
}

export function topCityRows(rows, defaultSource = null) {
  return (rows ?? []).map((row) => ({
    city: row.city ?? row.value,
    count: row.count ?? 0,
    bySource: topCityTooltipData(row, defaultSource),
  }));
}
