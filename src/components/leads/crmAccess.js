// Who may change which CRM field (see docs/API_REFERENCE.md, "Access: who sees and edits what").
//   interest, quoted_amount, quoted_date, converted: the assigned vendor only (admins: read-only)
//   vendor_id ("Assigned to"):                       admins only (vendors: read-only)
//   notes:                                           both

export const VENDOR_FIELDS = ["interest", "quoted_amount", "quoted_date", "converted"];
export const ADMIN_FIELDS = ["vendor_id"];
export const SHARED_FIELDS = ["notes"];

export function canEdit(isAdmin, field) {
  if (SHARED_FIELDS.includes(field)) return true;
  if (ADMIN_FIELDS.includes(field)) return Boolean(isAdmin);
  if (VENDOR_FIELDS.includes(field)) return !isAdmin;
  return false;
}

// The "Assigned to" chip text: "Phodeo" (manual, sheet or branch), "Phodeo · auto", or "Unassigned"
export function assignedText(crm) {
  if (!crm?.vendor) return "Unassigned";
  return ["manual", "sheet", "branch"].includes(crm.vendor_source) ? crm.vendor.name : `${crm.vendor.name} · auto`;
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
