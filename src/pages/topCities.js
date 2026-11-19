const SOURCE_LABELS = {
  wedding: "Wedding",
  wedding_planner: "Wedding planner",
  vendor_to_koc: "Vendors → KOC",
};

export function topCityTooltipData(row, defaultSource = null) {
  const counts = row?.by_source ?? (defaultSource ? { [defaultSource]: row?.count ?? 0 } : {});
  return Object.entries(counts)
    .filter(([source, count]) => SOURCE_LABELS[source] && Number(count) > 0)
    .map(([source, count]) => ({ source, label: SOURCE_LABELS[source], count: Number(count) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function topCityRows(rows, defaultSource = null) {
  return (rows ?? []).map((row) => ({
    city: row.city ?? row.value,
    count: row.count ?? 0,
    bySource: topCityTooltipData(row, defaultSource),
  }));
}
