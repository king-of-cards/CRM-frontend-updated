// Who may change which CRM field (see docs/API_REFERENCE.md, "Access: who sees and edits what").
//   update_status, quoted_amount, quoted_date, conversion_amount: admins and the assigned vendor
//   vendor_id ("Assigned to"):                       admins only (vendors: read-only)
//   notes:                                           both

export const VENDOR_FIELDS = ["update_status", "quoted_amount", "quoted_date", "conversion_amount"];
export const ADMIN_FIELDS = ["vendor_id"];
export const SHARED_FIELDS = ["notes"];

export function canEdit(isAdmin, field) {
  if (SHARED_FIELDS.includes(field)) return true;
  if (ADMIN_FIELDS.includes(field)) return Boolean(isAdmin);
  if (VENDOR_FIELDS.includes(field)) return true;
  return false;
}

// How the vendor was chosen (crm.vendor_source). Named: by hand, the sheet or the branch.
// Automatic: area rules ("suggested") or the source's default vendor ("source_default", e.g. every
// Wedding gifts lead goes to its default vendor, docs section 17).
export const NAMED_VENDOR_SOURCES = ["manual", "sheet", "branch"];
export const AUTO_VENDOR_SOURCES = ["suggested", "source_default"];

// The "Assigned to" chip text: "Phodeo" (manual, sheet or branch), "Phodeo · auto"
// (area rules), "<vendor> · auto" (source default), or "Unassigned"
export function assignedText(crm) {
  if (!crm?.vendor) return "Unassigned";
  return NAMED_VENDOR_SOURCES.includes(crm.vendor_source) ? crm.vendor.name : `${crm.vendor.name} · auto`;
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
