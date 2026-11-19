import { DHRUVA, hasFilterValue, KOC, NOT_SHARED, ORIGIN_LABELS, UPDATE_LABELS } from "./leadFilters.js";

const countLabel = (value, list = []) => {
  const found = list.find((item) => String(item.value) === String(value));
  return found?.count == null ? "" : ` (${found.count})`;
};
const optionName = (value, list = [], fallback = value) =>
  list.find((item) => String(item.value) === String(value))?.name ??
  list.find((item) => String(item.value) === String(value))?.label ?? fallback;
const plural = (label, values) => values.length === 1 ? `${label}: ${values[0]}` : `${label} (${values.length})`;

// Describes the controls available in each list and their URL keys. Kept pure so the
// button inventory and active labels can be verified without rendering React.
export function buildFilterButtons(source, filters = {}, options = {}, isAdmin = false) {
  const specs = source === DHRUVA
    ? [["event", "Event date", ["event_from", "event_to", "upcoming_days"]], ["venue", "Venue", ["venue"]], ["event_type", "Event type", ["event_type"]], ["update", "Update", ["update_status"]], ["quote", "Quote", ["quote"]], ["conversion", "Conversion", ["conversion"]], ["follow_up", "Follow-up", ["follow_up_from", "follow_up_to", "follow_up_due"]], ["has_phone", "Has phone", ["has_phone"]], ["hot", "Hot only", ["hot"]], ...(isAdmin ? [["also_in", "In other sources", ["also_in"]]] : [])]
    : source === KOC
      ? [["lead_date", "Lead date", ["lead_date_from", "lead_date_to"]], ...(isAdmin ? [["vendor", "Vendor", ["vendor_id"]], ["also_in", "In other sources", ["also_in"]]] : []), ["update", "Update", ["update_status"]], ["hot", "Hot only", ["hot"]], ["quote", "Quote", ["quote"]], ["conversion", "Conversion", ["conversion"]], ["follow_up", "Follow-up", ["follow_up_from", "follow_up_to", "follow_up_due"]], ["city", "City", ["city"]], ["source", "Source", ["source"]]]
      : [
          ...(source !== "spin" ? [] : [["branch", "Branch", ["branch"]], ["pincode", "Pincode", ["pincode"]], ["budget", "Budget", ["budget"]]]),
          ...(source === "whatsapp" ? [["country", "Country", ["country"]]] : []),
          ...(source === "wedding" ? [["occasion", "Event type", ["occasion"]], ["city", "City", ["city"]], ["budget_range", "Budget", ["budget_min", "budget_max"]], ["shared_with", "Sheet partner", ["shared_with"]], ["hide_repeats", "Hide repeats", ["hide_repeats"]]] : []),
          ...(source === "wedding_planner" ? [["city", "City", ["city"]], ["guests", "Guests", ["guests_min", "guests_max"]], ["budget_range", "Budget", ["budget_min", "budget_max"]], ["fits_budget", "Budget fit", ["fits_budget"]], ["last_step", "Last step", ["last_step"]], ["shared_with", "Sheet partner", ["shared_with"]]] : []),
          ...(isAdmin ? [["assigned", "Assigned to", ["vendor_id", "unassigned"]], ["also_in", "In other sources", ["also_in"]]] : []),
          ["update", "Update", ["update_status"]], ["hot", "Hot only", ["hot"]], ["quote", "Quote", ["quote"]], ["conversion", "Conversion", ["conversion"]], ["origin", "In other sources", ["origin"]],
        ];
  const valuesFor = (kind) => {
    if (kind === "update") return (filters.update_status ?? []).map((v) => UPDATE_LABELS[v] ?? v);
    if (kind === "origin") return (filters.origin ?? []).map((v) => ORIGIN_LABELS[v] ?? v);
    if (kind === "vendor") return (filters.vendor_id ?? []).map((v) => optionName(v, options.vendors, "Vendor"));
    if (kind === "assigned") return [...(filters.unassigned ? ["Unassigned"] : []), ...(filters.vendor_id ?? []).map((v) => optionName(v, options.vendors, "Vendor"))];
    if (kind === "branch") return filters.branch ? [optionName(filters.branch, options.branches, "Branch")] : [];
    if (kind === "event_type") return filters.event_type ?? [];
    if (kind === "source") return filters.source ?? [];
    if (kind === "shared_with") return filters.shared_with ? [filters.shared_with === NOT_SHARED ? "Not shared yet" : filters.shared_with] : [];
    if (kind === "event") return filters.upcoming_days ? ["Upcoming 30 days"] : [filters.event_from, filters.event_to].filter(Boolean);
    if (kind === "lead_date") return [filters.lead_date_from, filters.lead_date_to].filter(Boolean);
    if (kind === "follow_up") return filters.follow_up_due ? ["Due"] : [filters.follow_up_from, filters.follow_up_to].filter(Boolean);
    if (kind === "budget_range" || kind === "guests") return [filters[kind === "guests" ? "guests_min" : "budget_min"], filters[kind === "guests" ? "guests_max" : "budget_max"]].filter(Boolean);
    if (kind === "quote" || kind === "conversion") return filters[kind] ? [filters[kind]] : [];
    if (kind === "hot") return filters.hot ? ["Hot only"] : [];
    if (kind === "hide_repeats") return filters.hide_repeats ? ["Hide repeats"] : [];
    if (kind === "has_phone") return filters.has_phone ? [filters.has_phone === "yes" ? "Has phone" : "No phone"] : [];
    if (kind === "also_in") return filters.also_in ? [filters.also_in === "yes" ? "Yes" : "No"] : [];
    if (kind === "fits_budget") return filters.fits_budget ? [filters.fits_budget === "true" ? "Fits budget" : "Over budget"] : [];
    const v = filters[kind];
    return v ? [String(v)] : [];
  };
  return specs.map(([kind, label, keys]) => {
    const values = hasFilterValue(filters, keys) ? valuesFor(kind) : [];
    const count = kind === "venue" ? countLabel(filters.venue, options.venues) : kind === "city" ? countLabel(filters.city, options.cities) : kind === "event_type" ? "" : "";
    const activeLabel = kind === "quote" && values[0] === "has" ? "Has a quote" : kind === "conversion" && values[0] === "has" ? "Has a conversion" : values.length ? plural(label, values) : "";
    return { kind, label, keys, active: values.length > 0, value: values, activeLabel, count };
  });
}
