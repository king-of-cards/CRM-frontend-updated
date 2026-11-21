// Legacy pure label helper retained for consumers and tests. The active toolbar now renders
// filter values in each dropdown button and clears those keys directly, so no chips row is shown.
import { periodLabel, periodText } from "../../pages/dashboardPeriod.js";
import { sourceLabel, statusLabel } from "../vendorToKoc/kocUtils.js";
import {
  branchName,
  DHRUVA,
  KOC,
  NOT_SHARED,
  ORIGIN_LABELS,
  FOLLOW_UP_LABELS,
  UPDATE_LABELS,
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
  // Amount filters: "has" | "none" | "gt:<n>" | "lt:<n>" (the lead sources and Vendors → KOC)
  const amountChip = (key, has_, none, noun) => {
    const q = parseQuote(filters[key]);
    const text =
      q.op === "has"
        ? has_
        : q.op === "none"
          ? none
          : q.op === "gt"
            ? `${noun} more than ${inr.format(Number(q.amount))}`
            : q.op === "lt"
              ? `${noun} less than ${inr.format(Number(q.amount))}`
              : `${noun}: ${filters[key]}`;
    add(key, text, [key]);
  };

  if (has("date_from") || has("date_to"))
    add("date", `${source === KOC || source === DHRUVA ? "Received" : "Arrived"}: ${periodText(periodOfFilters(filters))}`, ["date_from", "date_to"]);

  if (source === KOC) {
    if (has("lead_date_from") || has("lead_date_to"))
      add("lead_date", `Lead date: ${rangeText(filters.lead_date_from, filters.lead_date_to)}`, ["lead_date_from", "lead_date_to"]);
    if (isAdmin && has("vendor_id")) add("vendor", `Vendor: ${list(filters.vendor_id, vendorName)}`, ["vendor_id"]);
    if (has("update_status")) add("update", `Update: ${list(filters.update_status, statusLabel)}`, ["update_status"]);
    if (has("hot")) add("hot", "Hot only", ["hot"]);
    if (has("quote")) amountChip("quote", "Has a quote", "No quote yet", "Quote");
    if (has("conversion")) amountChip("conversion", "Has a conversion amount", "No conversion amount", "Conversion");
    if (has("follow_up_from") || has("follow_up_to"))
      add("follow_up", `Follow-up: ${rangeText(filters.follow_up_from, filters.follow_up_to)}`, ["follow_up_from", "follow_up_to"]);
    if (has("follow_up_due")) add("due", "Follow-up due", ["follow_up_due"]);
    if (has("city")) add("city", `City: ${filters.city}`, ["city"]);
    if (has("source")) add("source", `Source: ${list(filters.source, sourceLabel)}`, ["source"]);
    return chips;
  }

  if (source === DHRUVA) {
    if (has("event_from") || has("event_to") || has("upcoming_days")) add("event", has("upcoming_days") ? "Event: upcoming 30 days" : `Event: ${rangeText(filters.event_from, filters.event_to)}`, ["event_from", "event_to", "upcoming_days"]);
    if (has("venue")) add("venue", `Venue: ${filters.venue}`, ["venue"]);
    if (has("event_type")) add("event_type", `Event type: ${list(filters.event_type, (v) => v)}`, ["event_type"]);
    if (has("update_status")) add("update", `Update: ${list(filters.update_status, (v) => UPDATE_LABELS[v] ?? v)}`, ["update_status"]);
    if (has("quote")) add("quote", `Quote: ${filters.quote}`, ["quote"]);
    if (has("conversion")) add("conversion", `Conversion: ${filters.conversion}`, ["conversion"]);
    if (has("follow_up_from") || has("follow_up_to") || has("follow_up_due")) add("follow_up", `Follow-up: ${has("follow_up_due") ? "due" : rangeText(filters.follow_up_from, filters.follow_up_to)}`, ["follow_up_from", "follow_up_to", "follow_up_due"]);
    if (has("has_phone")) add("has_phone", filters.has_phone === "yes" ? "Has phone" : "No phone", ["has_phone"]);
    if (has("hot")) add("hot", "Hot only", ["hot"]);
    if (isAdmin && has("also_in")) add("also_in", `Also in another section: ${filters.also_in}`, ["also_in"]);
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
  if (has("other_services")) add("other_services", `Other services: ${filters.other_services}`, ["other_services"]);
  // KOC → Dhruva
  if (has("quantity_min") || has("quantity_max"))
    add("quantity", `Quantity: ${numberRange(filters.quantity_min, filters.quantity_max, false)}`, ["quantity_min", "quantity_max"]);
  if (has("follow_up")) add("follow_up", `Follow-up: ${FOLLOW_UP_LABELS[filters.follow_up] ?? filters.follow_up}`, ["follow_up"]);

  // CRM filters
  if (isAdmin && (has("vendor_id") || has("unassigned"))) {
    const names = [...(has("unassigned") ? ["Unassigned"] : []), ...(filters.vendor_id ?? []).map(vendorName)];
    add("assigned", `Assigned to: ${names.join(", ")}`, ["vendor_id", "unassigned"]);
  }
  if (has("update_status"))
    add("update", `Update: ${list(filters.update_status, (v) => UPDATE_LABELS[v] ?? v)}`, ["update_status"]);
  if (has("hot")) add("hot", "Hot only", ["hot"]);
  if (has("quote")) amountChip("quote", "Has a quote", "No quote yet", "Quote");
  if (has("conversion")) amountChip("conversion", "Has a conversion amount", "No conversion amount", "Conversion");
  if (has("origin")) add("origin", `Origin: ${list(filters.origin, (v) => ORIGIN_LABELS[v] ?? v)}`, ["origin"]);
  return chips;
}
