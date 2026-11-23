// Team page helpers (docs/API_REFERENCE.md section 12). Pure, no React.

// The edit form for a login
export function editFormOf(user) {
  return {
    name: user?.name ?? "",
    email: user?.email ?? "",
    role: user?.role ?? "vendor",
    vendor_id: user?.vendor_id != null ? String(user.vendor_id) : "",
    password: "",
  };
}

// What PATCH /users/{id} gets: only what changed. Your own login never sends a role.
// vendor_id goes only while the role is vendor (required then), never for other roles.
export function userChanges(form, user, { own = false } = {}) {
  const changes = {};
  const name = form.name.trim();
  const email = form.email.trim();
  if (name !== (user.name ?? "")) changes.name = name;
  if (email !== (user.email ?? "")) changes.email = email;
  const role = own ? user.role : form.role;
  if (role !== user.role) changes.role = role;
  if (role === "vendor") {
    const current = user.vendor_id != null ? String(user.vendor_id) : "";
    if (form.vendor_id && (form.vendor_id !== current || changes.role)) changes.vendor_id = Number(form.vendor_id);
  }
  if (form.password) changes.password = form.password;
  return changes;
}

// A problem to fix before sending, or "" (the API checks the rest and its answer is shown as is)
export function editProblem(form, user, { own = false } = {}) {
  if (!form.name.trim() || !form.email.trim()) return "Enter a name and an email address.";
  if (form.password && form.password.length < 8) return "The new password needs at least 8 characters.";
  const role = own ? user.role : form.role;
  if (role === "vendor" && !form.vendor_id) return "Pick the vendor this login belongs to.";
  return "";
}

// Remove is confirmed by typing the login's email (any case, surrounding spaces ignored)
export const emailConfirmed = (typed, email) =>
  Boolean(email) && String(typed ?? "").trim().toLowerCase() === String(email).trim().toLowerCase();

// The vendor picker: active vendors only. A login's current inactive vendor is kept (disabled) so
// the picker shows what it is linked to, but it can't be chosen.
export function vendorChoices(vendors, currentId) {
  const current = currentId != null && currentId !== "" ? String(currentId) : "";
  return (vendors ?? [])
    .filter((v) => v.is_active !== false || String(v.id) === current)
    .map((v) => ({ id: String(v.id), name: v.name, disabled: v.is_active === false }));
}
