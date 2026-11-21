// Who may change which CRM field (see docs/API_REFERENCE.md, "Access: who sees and edits what").
//   update_status, quoted_amount, quoted_date, conversion_amount: admins and the assigned vendor
//   vendor_id / assigned_to ("Assigned to"):         admins only (vendors: read-only)
//   notes:                                           both

export const VENDOR_FIELDS = ["update_status", "quoted_amount", "quoted_date", "conversion_amount"];
export const ADMIN_FIELDS = ["vendor_id", "assigned_to"];
export const SHARED_FIELDS = ["notes"];

export function canEdit(isAdmin, field) {
  if (SHARED_FIELDS.includes(field)) return true;
  if (ADMIN_FIELDS.includes(field)) return Boolean(isAdmin);
  if (VENDOR_FIELDS.includes(field)) return true;
  return false;
}

// How the vendor was chosen (crm.vendor_source). Named: by hand, the sheet or the branch.
// Automatic: area rules ("suggested") or the source's default vendor ("source_default", e.g. every
// gift lead, i.e. a spin lead asking for Wedding Gifts & Return Gifts, goes to Kraftyz: docs section 17).
export const NAMED_VENDOR_SOURCES = ["manual", "sheet", "branch"];
export const AUTO_VENDOR_SOURCES = ["suggested", "source_default"];

// The "Assigned to" chip text: "Phodeo" (manual, sheet or branch), "Phodeo · auto"
// (area rules), "<vendor> · auto" (source default), or "Unassigned"
export function assignedText(crm) {
  if (!crm?.vendor) return "Unassigned";
  return NAMED_VENDOR_SOURCES.includes(crm.vendor_source) ? crm.vendor.name : `${crm.vendor.name} · auto`;
}

// ── Assigned to: Automatic, Unassigned or a vendor (admins; docs section 5) ──
// The editors' value: a manual vendor's id, "unassigned" (no vendor and auto_assign false: an
// admin chose Unassigned, or it was uploaded unassigned), else "automatic"
export const AUTOMATIC_CHOICE = "automatic";
export const UNASSIGNED_CHOICE = "unassigned";
export function assignmentOf(crm) {
  if (crm?.vendor_source === "manual" && crm?.vendor) return String(crm.vendor.id);
  if (!crm?.vendor && crm?.auto_assign === false) return UNASSIGNED_CHOICE;
  return AUTOMATIC_CHOICE;
}

// What PUT …/crm gets for a choice: assigned_to for Automatic / Unassigned, vendor_id for a vendor
// (never both: the API answers 422)
export function assignmentChange(choice) {
  if (choice === AUTOMATIC_CHOICE) return { assigned_to: "automatic" };
  if (choice === UNASSIGNED_CHOICE) return { assigned_to: "unassigned" };
  return { vendor_id: Number(choice) };
}

// The vendors a manual assignment may pick: active ones only (an inactive vendor_id answers 422).
// current: the lead's manually assigned vendor ({ id, name }) or null; when it's inactive it is
// kept, flagged inactive: true, so the dropdown still shows it (disabled) instead of losing it.
export function assignableVendors(vendors, current = null) {
  const active = (vendors ?? []).filter((v) => v && v.is_active !== false);
  if (current?.id != null && !active.some((v) => String(v.id) === String(current.id))) {
    return [...active, { id: current.id, name: current.name, inactive: true }];
  }
  return active;
}

// The Automatic option's label: "Automatic · Phodeo" when a rule picks (or would pick) a vendor
export function automaticLabel(crm) {
  const auto = crm?.vendor && crm.vendor_source !== "manual" ? crm.vendor : crm?.suggested_vendor;
  return auto?.name ? `Automatic · ${auto.name}` : "Automatic";
}

// The side panel's save: only fields that changed and that this login may edit
export function panelChanges(isAdmin, before, after) {
  const out = {};
  for (const [field, value] of Object.entries(after)) {
    if (!canEdit(isAdmin, field)) continue;
    const old = before[field] ?? null;
    const now = value ?? null;
    if (old === now) continue;
    out[field] = now;
  }
  return out;
}
