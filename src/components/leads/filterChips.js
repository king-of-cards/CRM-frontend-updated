// Active filters as small removable chips under the filter row. Names, never ids
// (vendor and branch names from the filter options). Pure, no React.
//   -> [{ id, label, keys }]: removing a chip clears its keys
import { periodLabel, periodText } from "../../pages/dashboardPeriod.js";
import { sourceLabel, statusLabel } from "../vendorToKoc/kocUtils.js";
import {
  branchName,
  INTEREST_LABELS,
  KOC,
  NOT_SHARED,
  ORIGIN_LABELS,
  parseQuote,
  periodOfFilters,
} from "./leadFilters.js";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const day = (d) => periodLabel(d, d);

// "1 – 5 Dec 2026", "from 1 Dec 2026", "until 5 Dec 2026"
function rangeText(from, to) {
  if (from && to) return periodLabel(from, to);
  return from ? `from ${day(from)}` : `until ${day(to)}`;
}
function numberRange(min, max, money) {
  const f = (n) => (money ? inr.format(Number(n)) : Number(n).toLocaleString("en-IN"));
  if (min && max) return `${f(min)} – ${f(max)}`;
  return min ? `at least ${f(min)}` : `at most ${f(max)}`;
}
const list = (values, label) => values.map(label).join(", ");

export function filterChips(filters, source, options = {}, isAdmin = false) {
  const o = options ?? {};
  const has = (k) => (Array.isArray(filters[k]) ? filters[k].length > 0 : Boolean(filters[k]));
  const vendorName = (id) => (o.vendors ?? []).find((v) => String(v.id) === String(id))?.name ?? "Unknown vendor";
  const chips = [];
  const add = (id, label, keys) => chips.push({ id, label, keys });

  if (has("date_from") || has("date_to"))
    add("date", `${source === KOC ? "Received" : "Arrived"}: ${periodText(periodOfFilters(filters))}`, ["date_from", "date_to"]);

  if (source === KOC) {
    if (has("lead_date_from") || has("lead_date_to"))
      add("lead_date", `Lead date: ${rangeText(filters.lead_date_from, filters.lead_date_to)}`, ["lead_date_from", "lead_date_to"]);
    if (isAdmin && has("vendor_id")) add("vendor", `Vendor: ${list(filters.vendor_id, vendorName)}`, ["vendor_id"]);
    if (has("update_status")) add("update", `Update: ${list(filters.update_status, statusLabel)}`, ["update_status"]);
    if (has("follow_up_from") || has("follow_up_to"))
      add("follow_up", `Follow-up: ${rangeText(filters.follow_up_from, filters.follow_up_to)}`, ["follow_up_from", "follow_up_to"]);
    if (has("follow_up_due")) add("due", "Follow-up due", ["follow_up_due"]);
    if (has("city")) add("city", `City: ${filters.city}`, ["city"]);
    if (has("source")) add("source", `Source: ${list(filters.source, sourceLabel)}`, ["source"]);
    return chips;
  }

  if (has("upcoming_days")) add("event", "Event: upcoming 30 days", ["upcoming_days", "event_from", "event_to"]);
  else if (has("event_from") || has("event_to"))
    add("event", `Event: ${rangeText(filters.event_from, filters.event_to)}`, ["upcoming_days", "event_from", "event_to"]);

  // Per source
  if (has("branch")) {
    const b = (o.branches ?? []).find((x) => String(x.id) === String(filters.branch));
    add("branch", `Branch: ${b ? branchName(b) : "Unknown branch"}`, ["branch"]);
  }
  if (has("pincode")) add("pincode", `Pincode: ${filters.pincode}`, ["pincode"]);
  if (has("budget")) {
    const v = String(filters.budget);
    add("budget", `Budget: ${/^\d/.test(v) ? `₹${v.replace(/[-_]/g, "–")}` : v}`, ["budget"]);
  }
  if (has("country")) add("country", `Country: ${filters.country}`, ["country"]);
  if (has("occasion")) add("occasion", `Occasion: ${filters.occasion}`, ["occasion"]);
  if (has("city")) add("city", `City: ${filters.city}`, ["city"]);
  if (has("guests_min") || has("guests_max"))
    add("guests", `Guests: ${numberRange(filters.guests_min, filters.guests_max, false)}`, ["guests_min", "guests_max"]);
  if (has("budget_min") || has("budget_max"))
    add("budget_range", `Budget: ${numberRange(filters.budget_min, filters.budget_max, true)}`, ["budget_min", "budget_max"]);
  if (has("fits_budget")) add("fits", filters.fits_budget === "true" ? "Fits budget" : "Over budget", ["fits_budget"]);
  if (has("last_step")) add("step", `Step: ${filters.last_step}`, ["last_step"]);
  if (has("shared_with"))
    add("partner", `Sheet partner: ${filters.shared_with === NOT_SHARED ? "Not shared yet" : filters.shared_with}`, ["shared_with"]);
  if (has("hide_repeats")) add("repeats", "Hide repeats", ["hide_repeats"]);

  // CRM filters
  if (isAdmin && (has("vendor_id") || has("unassigned"))) {
    const names = [...(has("unassigned") ? ["Unassigned"] : []), ...(filters.vendor_id ?? []).map(vendorName)];
    add("assigned", `Assigned to: ${names.join(", ")}`, ["vendor_id", "unassigned"]);
  }
  if (has("interest")) add("interest", `Interest: ${list(filters.interest, (v) => INTEREST_LABELS[v] ?? v)}`, ["interest"]);
  if (has("quote")) {
    const q = parseQuote(filters.quote);
    const text =
      q.op === "has"
        ? "Has a quote"
        : q.op === "none"
          ? "No quote yet"
          : q.op === "gt"
            ? `Quote more than ${inr.format(Number(q.amount))}`
            : q.op === "lt"
              ? `Quote less than ${inr.format(Number(q.amount))}`
              : `Quote: ${filters.quote}`;
    add("quote", text, ["quote"]);
  }
  if (has("converted")) add("converted", `Converted: ${filters.converted === "yes" ? "Yes" : "No"}`, ["converted"]);
  if (has("origin")) add("origin", `Origin: ${list(filters.origin, (v) => ORIGIN_LABELS[v] ?? v)}`, ["origin"]);
  return chips;
}
