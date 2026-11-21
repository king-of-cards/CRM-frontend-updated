// Cross-source duplicates (docs/API_REFERENCE.md, "Cross-source duplicates (also_in)" and section 18).
// Every list item carries also_in: [{ source, count, vendors? }], the other places with the same
// phone, already filtered by the API for this login (vendors only get what they may see, and
// vendor names only for admins). Pure, no React: the page shows exactly what the API sends.

export const ALSO_IN_LABELS = {
  spin: "Spin",
  whatsapp: "International",
  wedding: "Wedding",
  wedding_planner: "Wedding planner",
  vendor_to_koc: "Vendors → KOC",
  dhruva: "Dhruva → KOC",
  koc_to_dhruva: "KOC → Dhruva",
};

export const alsoInLabel = (source) => ALSO_IN_LABELS[source] ?? String(source ?? "");

// -> [{ source, label, count, vendors }] in the API's order; entries without a source are skipped
export function alsoInPlaces(alsoIn) {
  if (!Array.isArray(alsoIn)) return [];
  return alsoIn
    .filter((p) => p && p.source)
    .map((p) => ({
      source: p.source,
      label: alsoInLabel(p.source),
      count: Number(p.count) > 0 ? Number(p.count) : 1,
      vendors: Array.isArray(p.vendors) ? p.vendors.filter(Boolean) : [],
    }));
}

// "Vendors → KOC: 2 leads (OHP, Phodeo)"
export function alsoInLine(place) {
  const leads = `${place.count} ${place.count === 1 ? "lead" : "leads"}`;
  return `${place.label}: ${leads}${place.vendors.length ? ` (${place.vendors.join(", ")})` : ""}`;
}

// The tooltip: one line per place, or "" when the phone is nowhere else
export function alsoInTooltip(alsoIn) {
  const places = alsoInPlaces(alsoIn);
  return places.length ? ["Also in:", ...places.map(alsoInLine)].join("\n") : "";
}

// Does the API say this lead is also in that place?
export const isAlsoIn = (alsoIn, source) => alsoInPlaces(alsoIn).some((p) => p.source === source);
