// Several vendors per lead (docs/API_REFERENCE.md section 19). Pure, no React.
// crm.vendors: [{ vendor: {id, name}, vendor_source, update_status, quoted_amount, quoted_date,
//   conversion_amount, follow_up_date, notes, updated_at, updated_by_name, is_hot }]
// Admins and view-only logins get every copy; vendor logins only their own.
import { NAMED_VENDOR_SOURCES } from "./crmAccess.js";

// The fields each vendor's copy has (saved with PUT …/crm, ?vendor=<id> for admins)
export const COPY_FIELDS = ["update_status", "follow_up_date", "notes", "quoted_amount", "quoted_date", "conversion_amount"];

// The copies this login may see: everyone's for admins and viewers (seesAll), else only the copy
// of the login's own vendor (vendorId; the API sends only that one anyway)
export function vendorCopies(crm, { seesAll = true, vendorId = null } = {}) {
  const list = (Array.isArray(crm?.vendors) ? crm.vendors : []).filter((c) => c?.vendor?.id != null);
  if (seesAll) return list;
  return vendorId != null ? list.filter((c) => String(c.vendor.id) === String(vendorId)) : list.slice(0, 1);
}

// More than one vendor: each works its own copy, so admins save with ?vendor=
export const isMultiVendor = (crm) => vendorCopies(crm).length > 1;

// "Assigned to" chips: one per vendor ("Phodeo" when chosen by hand, the sheet or the branch;
// "Phodeo · auto" from a rule or partner rule); "Unassigned" when there is none.
// Older answers without vendors: the one crm.vendor.
export function vendorChips(crm) {
  const copies = vendorCopies(crm);
  const list = copies.length ? copies : crm?.vendor ? [{ vendor: crm.vendor, vendor_source: crm.vendor_source }] : [];
  if (!list.length) return [{ key: "none", text: "Unassigned", tone: "none" }];
  return list.map((c) => {
    const named = NAMED_VENDOR_SOURCES.includes(c.vendor_source);
    return {
      key: String(c.vendor.id),
      text: named ? c.vendor.name : `${c.vendor.name} · auto`,
      tone: c.vendor_source === "manual" ? "manual" : "auto",
    };
  });
}

// A card's form: text values for the inputs
export function copyForm(copy) {
  return {
    update_status: copy?.update_status ?? "",
    follow_up_date: copy?.follow_up_date ?? "",
    notes: copy?.notes ?? "",
    quoted_amount: copy?.quoted_amount != null ? String(copy.quoted_amount) : "",
    quoted_date: copy?.quoted_date ?? "",
    conversion_amount: copy?.conversion_amount != null ? String(copy.conversion_amount) : "",
  };
}

const amount = (text) => {
  const digits = String(text ?? "").replace(/\D/g, "");
  return digits ? Number(digits) : null;
};
function apiValues(form) {
  return {
    update_status: form.update_status || null,
    follow_up_date: form.follow_up_date || null,
    notes: String(form.notes ?? "").trim() || null,
    quoted_amount: amount(form.quoted_amount),
    quoted_date: form.quoted_date || null,
    conversion_amount: amount(form.conversion_amount),
  };
}

// PUT body for one card: only the fields that changed
export function copyChanges(copy, form) {
  const before = apiValues(copyForm(copy));
  const after = apiValues(form);
  const out = {};
  for (const f of COPY_FIELDS) if (before[f] !== after[f]) out[f] = after[f];
  return out;
}

// The save's options: admins name the vendor (?vendor=<id>); vendor logins never do
export const copySaveOptions = (isAdmin, vendorId) => (isAdmin && vendorId != null ? { vendor: vendorId } : {});

// One vendor's copy in a crm answer (after a save)
export const copyOf = (crm, vendorId) => vendorCopies(crm).find((c) => String(c.vendor.id) === String(vendorId)) ?? null;
