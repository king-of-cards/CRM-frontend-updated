// KOC → Dhruva bulk upload helpers (docs/API_REFERENCE.md section 18, "Upload" and "Upload and
// Spin"). An upload only adds KOC → Dhruva leads: it never touches Spin, it only shows which rows
// are already in Spin. Pure, no React, no network.
import { formatDateTime } from "../shared/dates.js";

// Only the phone is required. Source and Relation are optional template columns.
export const KOC_TO_DHRUVA_UPLOAD_HINT =
  "Phone is required; every other column is optional, including Source (e.g. Instagram) and Relation (e.g. Sister). Rows not in Spin are added for Dhruva only.";

// Types for the section's own columns (Spin's fields don't have them)
const OWN_TYPES = {
  update_status: { type: "update" },
  quoted_amount: { type: "amount" },
  conversion_amount: { type: "amount" },
  notes: { type: "text", max_length: 5000 },
  additional_comments: { type: "text", max_length: 5000 },
  follow_up_date: { type: "date" },
  source: { type: "text", max_length: 50 },
  relation: { type: "text", max_length: 100 },
};

const humanize = (key) =>
  String(key)
    .replace(/[_.]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^\w/, (c) => c.toUpperCase());

// The preview's columns ({ "<file header>": "<field key>" }) -> the preview table's fields, in the
// file's order: label = the file's header (so the re-check CSV uses the headers the API read),
// type from Spin's field with the same key or the section's own columns, required = phone only.
// Keys that only appear in row values or errors are added after, with a readable label.
export function kocToDhruvaFields(spinFields = [], columns = {}, rows = []) {
  const out = [];
  const add = (key, label) => {
    if (!key || out.some((f) => f.key === key)) return;
    const spin = (spinFields ?? []).find((f) => f.key === key) ?? {};
    out.push({
      ...spin,
      ...(OWN_TYPES[key] ?? {}),
      type: OWN_TYPES[key]?.type ?? spin.type ?? "text",
      key,
      label,
      required: key === "phone",
    });
  };
  const entries = Array.isArray(columns) ? columns.map((k) => [k, k]) : Object.entries(columns ?? {});
  for (const [header, key] of entries) add(key, header);
  add("phone", "Phone");
  for (const r of rows ?? []) {
    for (const key of Object.keys(r.values ?? {})) add(key, humanize(key));
    for (const e of r.errors ?? []) add(e.field, humanize(e.field));
  }
  return out;
}

const vendorNames = (vendors) =>
  (vendors ?? []).map((v) => (typeof v === "string" ? v : v?.name)).filter(Boolean);

// The Spin entry of a row's also_in: { count, vendors: [names] } or null
function spinAlsoIn(row) {
  return (row?.also_in ?? []).find((a) => a?.source === "spin") ?? null;
}

export const NOT_IN_SPIN = "Not in Spin (Dhruva only)";

/**
 * A row's Spin link, for the preview and the result (spin.action):
 * { tone: "match" | "dhruva" | "none", label, detail, leads: [{ key, name, vendors }] }
 *   matched      "In Spin": the matching Spin leads and their vendors (nothing in Spin changes)
 *   not_in_spin  "Not in Spin (Dhruva only)": only the KOC → Dhruva row is saved
 *   anything else (no spin object): "—"
 */
export function spinMatch(row) {
  const spin = row?.spin ?? null;
  if (spin?.action === "matched") {
    const also = spinAlsoIn(row);
    const leads = (spin.leads ?? []).map((l) => ({
      key: l.lead_key ?? "",
      name: l.name ?? "",
      vendors: vendorNames(l.vendors),
    }));
    const vendors = [...new Set(leads.flatMap((l) => l.vendors))];
    const shown = vendors.length ? vendors : vendorNames(also?.vendors);
    const count = leads.length || also?.count || 1;
    return {
      tone: "match",
      label: count > 1 ? `In Spin (${count} leads)` : "In Spin",
      detail: shown.length ? `Vendors: ${shown.join(", ")}` : "Unassigned in Spin",
      leads,
    };
  }
  if (spin?.action === "not_in_spin") return { tone: "dhruva", label: NOT_IN_SPIN, detail: "", leads: [] };
  return { tone: "none", label: "—", detail: "", leads: [] };
}

// The Spin counts as chips (preview and result alike; every row, saved or not). Missing counts are
// left out.
export function spinCountChips(counts) {
  const c = counts ?? {};
  const chips = [];
  if (c.spin_matched != null) chips.push(["In Spin", c.spin_matched]);
  if (c.spin_not_in_spin != null) chips.push([NOT_IN_SPIN, c.spin_not_in_spin]);
  return chips;
}

// Labels for the fields the workflow can fill (docs section 18, "Filled from the workflow")
const FILL_LABELS = {
  name: "Name", email: "Email", occasionType: "Occasion", occasion: "Occasion", occasionDate: "Event date",
  event_date: "Event date", branch: "Branch", estimated_budget_per_card: "Estimated budget per card",
  quantity_required: "Quantity required", pincode: "Pincode", other_wedding_services: "Other wedding services",
  relation: "Relation",
};

// The reason a row couldn't be filled: the API's text as returned (a string, or { message | reason })
const skippedReason = (v) =>
  typeof v === "string" ? v : v?.message || v?.reason || (v ? "Not filled from the workflow" : "");

/**
 * A row's fill from the workflow (preview and save result):
 *   { kind: "fill", workflowId, received: "19 Nov 2026, 10:30 am" | "", items: [{ key, label, value }] }
 *   { kind: "skipped", text }   fill_skipped: no workflow row could be used; the row is saved unfilled
 *   null                        nothing to fill
 * fields: the preview's fields (their labels win), so a value can be shown like its column.
 */
export function fillInfo(row, fields = []) {
  const fill = row?.fill;
  if (fill && typeof fill === "object") {
    const items = Object.entries(fill.fields ?? {})
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([key, value]) => {
        const f = (fields ?? []).find((x) => x.key === key);
        return { key, label: f?.label || FILL_LABELS[key] || humanize(key), value, field: f ?? { key, type: key === "branch" ? "branch" : "text" } };
      });
    const received = formatDateTime(fill.received ?? "", "");
    if (items.length || received) return { kind: "fill", workflowId: fill.workflow_id ?? null, received, items };
  }
  const text = skippedReason(row?.fill_skipped);
  if (text) return { kind: "skipped", text };
  return null;
}
