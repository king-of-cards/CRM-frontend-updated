import { useCallback, useEffect, useRef, useState } from "react";
import { MoreHorizontal, Pencil, Plus, Trash2, X } from "lucide-react";
import DashboardLayout from "../components/layout/DashboardLayout.jsx";
import Modal, { modalCancelBtn, modalDangerBtn, modalPrimaryBtn } from "../components/shared/Modal.jsx";
import { SkeletonRows } from "../components/shared/Skeleton.jsx";
import VendorsSection from "../components/team/VendorsSection.jsx";
import { createUser, deleteUser, listUsers, setUserActive, updateUser } from "../api/users.js";
import { linkVendorUser, listKocVendors, unlinkVendorUser } from "../api/vendorToKoc.js";
import { apiErrorText } from "../api/errors.js";
import { useAuth } from "../auth/useAuth.js";
import { roleLabel, ROLES } from "../auth/permissions.js";
import { formatDay } from "../components/shared/dates.js";
import { editFormOf, editProblem, emailConfirmed, listOrNull, rowMenuItems, userChanges, vendorChoices } from "./teamUtils.js";

// Team (admin only; docs/API_REFERENCE.md section 12): logins with their role, vendor and status;
// create a login (vendor logins pick their vendor); link / move / unlink a vendor login;
// Status (Active / Blocked) is a control in the row; edit and remove are in each row's ⋯ menu.
// Your own row: no role change, no status change, no remove. Below the members: the vendors
// (VendorsSection; /vendors opens this page). API errors (400, 404, 409, 422) are shown as returned.

const USERS_QUERY = { limit: 200 };
const EMPTY_FORM = { name: "", email: "", password: "", role: "vendor", vendor_id: "" };
// Roles that require a vendor to be linked
const NEEDS_VENDOR = ["vendor"];
const NOT_LINKED = "";

const inputClass =
  "w-full min-h-11 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition placeholder:text-gray-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 disabled:bg-gray-50 disabled:text-gray-500";
const smallSelect =
  "min-h-11 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-800 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 disabled:opacity-60 sm:min-h-0";

const formatDate = (value) => formatDay(value, "—");

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block px-1 text-xs font-medium text-gray-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block px-1 text-[11px] text-gray-500">{hint}</span>}
    </label>
  );
}

function ErrorText({ children }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
      {children}
    </p>
  );
}

function VendorOptions({ vendors, current, placeholder }) {
  return (
    <>
      <option value="">{placeholder}</option>
      {vendorChoices(vendors, current).map((v) => (
        <option key={v.id} value={v.id} disabled={v.disabled}>
          {v.name}
          {v.disabled ? " (inactive)" : ""}
        </option>
      ))}
    </>
  );
}

// Edit a login: name, email, role (not your own), vendor (vendor logins), optional new password
function EditDialog({ user, own, vendors, onSaved, onCancel }) {
  const [form, setForm] = useState(() => editFormOf(user));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const role = own ? user.role : form.role;
  const set = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setError("");
  };

  async function submit(e) {
    e.preventDefault();
    const problem = editProblem(form, user, { own });
    if (problem) return setError(problem);
    const changes = userChanges(form, user, { own });
    if (!Object.keys(changes).length) return onCancel();
    setBusy(true);
    setError("");
    try {
      await updateUser(user.id, changes);
      await onSaved();
    } catch (err) {
      setError(apiErrorText(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Edit ${user.name}`}
      onClose={onCancel}
      footer={
        <>
          <button type="button" onClick={onCancel} className={modalCancelBtn}>Cancel</button>
          <button type="submit" form="edit-user" disabled={busy} className={modalPrimaryBtn}>
            {busy ? "Saving…" : "Save changes"}
          </button>
        </>
      }
    >
      <form id="edit-user" onSubmit={submit} noValidate className="space-y-3">
        <Field label="Full name">
          <input name="name" value={form.name} onChange={set} autoComplete="off" className={inputClass} />
        </Field>
        <Field label="Email">
          <input name="email" type="email" value={form.email} onChange={set} autoComplete="off" className={inputClass} />
        </Field>
        <Field label="Role" hint={own ? "You can't change your own role." : form.role !== user.role ? "Changing the role signs them out everywhere." : null}>
          <select name="role" value={role} onChange={set} disabled={own} className={inputClass}>
            {ROLES.map((r) => (
              <option key={r} value={r}>{roleLabel(r)}</option>
            ))}
          </select>
        </Field>
        {role === "vendor" && (
          <Field label={<>Vendor<span className="ml-0.5 text-red-600">*</span></>}>
            <select name="vendor_id" value={form.vendor_id} onChange={set} className={inputClass}>
              <VendorOptions vendors={vendors} current={user.vendor_id} placeholder="Pick a vendor" />
            </select>
          </Field>
        )}
        <Field label="New password (optional)" hint="At least 8 characters. Leave empty to keep the current one; a new one signs them out everywhere.">
          <input name="password" type="password" value={form.password} onChange={set} autoComplete="new-password" className={inputClass} />
        </Field>
        <ErrorText>{error}</ErrorText>
      </form>
    </Modal>
  );
}

// Remove a login: confirmed by typing its email
function RemoveDialog({ user, onRemoved, onCancel }) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ok = emailConfirmed(typed, user.email);

  async function remove(e) {
    e?.preventDefault();
    if (!ok) return;
    setBusy(true);
    setError("");
    try {
      await deleteUser(user.id);
      await onRemoved();
    } catch (err) {
      setError(apiErrorText(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Remove ${user.name}?`}
      role="alertdialog"
      onClose={onCancel}
      footer={
        <>
          <button type="button" onClick={onCancel} className={modalCancelBtn}>Cancel</button>
          <button type="submit" form="remove-user" disabled={!ok || busy} className={modalDangerBtn}>
            {busy ? "Removing…" : "Remove"}
          </button>
        </>
      }
    >
      <form id="remove-user" onSubmit={remove} noValidate>
        <p className="text-sm text-gray-600">
          The login is deleted with its sessions and can't sign in again. Leads it added or updated stay;
          they show <span className="font-medium">Deleted user</span>.
        </p>
        <Field label={<>Type <span className="font-semibold text-gray-900">{user.email}</span> to confirm</>}>
          <input value={typed} onChange={(e) => { setTyped(e.target.value); setError(""); }} autoComplete="off" autoCapitalize="none" spellCheck={false} aria-label="Email to confirm" className={`${inputClass} mt-1`} />
        </Field>
        <ErrorText>{error}</ErrorText>
      </form>
    </Modal>
  );
}

// The ⋯ menu of a row. Fixed position, so the table's scroll box never clips it.
export function RowMenu({ user, own, onEdit, onRemove }) {
  const [pos, setPos] = useState(null); // { top, right } while open
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!pos) return undefined;
    const close = (e) => {
      if (e.type === "keydown" && e.key !== "Escape") return;
      if (e.type === "mousedown" && (menuRef.current?.contains(e.target) || buttonRef.current?.contains(e.target))) return;
      setPos(null);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [pos]);

  function toggle() {
    if (pos) return setPos(null);
    const r = buttonRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) });
  }
  const pick = (fn) => () => {
    setPos(null);
    fn();
  };
  const item = "flex min-h-11 w-full items-center gap-2 px-4 text-left text-sm hover:bg-gray-50";
  const items = rowMenuItems({ own });

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-label={`Actions for ${user.name}`}
        aria-haspopup="menu"
        aria-expanded={Boolean(pos)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
      >
        <MoreHorizontal size={18} />
      </button>
      {pos && (
        <div ref={menuRef} role="menu" style={{ top: pos.top, right: pos.right }} className="fixed z-40 w-48 overflow-hidden rounded-xl bg-white py-1 shadow-xl ring-1 ring-gray-200">
          <button type="button" role="menuitem" onClick={pick(onEdit)} className={`${item} text-gray-800`}>
            <Pencil size={15} /> Edit
          </button>
          {items.includes("remove") && (
            <button type="button" role="menuitem" onClick={pick(onRemove)} className={`${item} text-red-700`}>
              <Trash2 size={15} /> Remove
            </button>
          )}
        </div>
      )}
    </>
  );
}

const STATUS_TONE = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  blocked: "border-red-200 bg-red-50 text-red-700",
};

// Status: a chip on your own row (and for non-admins); otherwise Active / Blocked, saved at once
// with PATCH /users/{id} { is_active }. Blocked logins are signed out everywhere.
export function StatusCell({ user, editable, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const value = user.is_active ? "active" : "blocked";

  if (!editable) {
    return (
      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_TONE[value]}`}>
        {user.is_active ? "Active" : "Blocked"}
      </span>
    );
  }

  async function change(next) {
    if (next === value) return;
    setBusy(true);
    setError("");
    try {
      const saved = await setUserActive(user.id, next === "active");
      onSaved({ ...user, ...(saved && typeof saved === "object" ? saved : {}), is_active: next === "active" });
    } catch (err) {
      setError(apiErrorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <select
        aria-label={`Status of ${user.name}`}
        title={value === "active" ? "Blocking signs them out everywhere" : undefined}
        value={value}
        disabled={busy}
        onChange={(e) => change(e.target.value)}
        className={`${smallSelect} font-medium ${STATUS_TONE[value]}`}
      >
        <option value="active">Active</option>
        <option value="blocked">Blocked</option>
      </select>
      {error && (
        <p role="alert" className="mt-1 max-w-[220px] text-[11px] leading-tight text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

// The vendor of a vendor login: pick one to link / move, "Not linked" to unlink
function VendorCell({ user, vendors, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const current = user.vendor_id != null ? String(user.vendor_id) : NOT_LINKED;

  async function change(value) {
    if (value === current) return;
    setBusy(true);
    setError("");
    try {
      if (value === NOT_LINKED) await unlinkVendorUser(current, user.id);
      else await linkVendorUser(value, user.id);
      await onChanged();
    } catch (err) {
      setError(apiErrorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <select
        aria-label={`Vendor of ${user.name}`}
        value={current}
        disabled={busy}
        onChange={(e) => change(e.target.value)}
        className={`${smallSelect} max-w-[200px] ${current === NOT_LINKED ? "text-amber-700" : ""}`}
      >
        <VendorOptions vendors={vendors} current={current} placeholder="Not linked" />
      </select>
      {error && (
        <p role="alert" className="mt-1 max-w-[220px] text-[11px] leading-tight text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

export default function Users() {
  const { user: me, isAdmin } = useAuth();
  // The last answers show at once (null: never loaded, so placeholder rows); fresh ones replace them
  const [users, setUsers] = useState(() => listOrNull(listUsers.peek(USERS_QUERY)));
  const [vendors, setVendors] = useState(() => listOrNull(listKocVendors.peek()) ?? []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState(null); // user
  const [removing, setRemoving] = useState(null); // user

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [u, v] = await Promise.all([listUsers(USERS_QUERY), listKocVendors()]);
      setUsers(u);
      setVendors(v);
    } catch (err) {
      setError(apiErrorText(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setFormError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim())
      return setFormError("Enter a name and an email address.");
    if (form.password.length < 8)
      return setFormError("The password needs at least 8 characters.");
    if (NEEDS_VENDOR.includes(form.role) && !form.vendor_id)
      return setFormError("Pick the vendor this login belongs to.");

    setSaving(true);
    try {
      await createUser({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        vendorId: form.vendor_id,
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      await load();
    } catch (err) {
      setFormError(apiErrorText(err));
    } finally {
      setSaving(false);
    }
  }

  // Vendor changes in the section below: refresh the vendor pickers
  const reloadVendors = useCallback(() => {
    listKocVendors().then(setVendors).catch(() => {});
  }, []);
  const replaceUser = (saved) => setUsers((list) => (list ?? []).map((x) => (x.id === saved.id ? saved : x)));
  const rows = listOrNull(users) ?? [];

  return (
    <DashboardLayout title="Team">
      <section className="min-w-0 rounded-2xl bg-white shadow-md shadow-gray-200/70 ring-1 ring-gray-100">
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 pt-5 sm:px-6 sm:pt-6">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900">
              Team members
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              People who can sign in to the CRM. Vendor logins see only their vendor's leads.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowForm((v) => !v);
              setFormError("");
            }}
            className="flex min-h-11 items-center gap-1.5 rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
          >
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? "Cancel" : "Add member"}
          </button>
        </div>

        {/* Add member form */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            noValidate
            className="mx-4 mt-5 rounded-2xl bg-gray-50 p-4 ring-1 ring-gray-100 sm:mx-6 sm:p-5"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Full name">
                <input name="name" value={form.name} onChange={handleChange} autoComplete="off" className={inputClass} />
              </Field>
              <Field label="Email">
                <input name="email" type="email" value={form.email} onChange={handleChange} autoComplete="off" className={inputClass} />
              </Field>
              <Field label="Temporary password (min. 8 characters)">
                <input name="password" type="password" value={form.password} onChange={handleChange} autoComplete="new-password" className={inputClass} />
              </Field>
              <Field label="Role">
                <select name="role" value={form.role} onChange={handleChange} className={inputClass}>
                  {/* View only: sees what an admin sees, changes nothing; no vendor */}
                  {ROLES.map((role) => (
                    <option key={role} value={role}>{roleLabel(role)}</option>
                  ))}
                </select>
              </Field>
              {form.role === "vendor" && (
                <Field label={<>Vendor<span className="ml-0.5 text-red-600">*</span></>}>
                  <select name="vendor_id" value={form.vendor_id} onChange={handleChange} className={inputClass}>
                    <VendorOptions vendors={vendors} current="" placeholder="Pick a vendor" />
                  </select>
                </Field>
              )}
            </div>
            {formError && (
              <p role="alert" className="mt-3 px-1 text-sm text-red-600">
                {formError}
              </p>
            )}
            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="min-h-11 rounded-full bg-brand-700 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-800 disabled:opacity-60"
              >
                {saving ? "Adding…" : "Add member"}
              </button>
            </div>
          </form>
        )}

        {/* List (scrolls sideways inside the card on phones) */}
        <div className="mt-5 overflow-x-auto">
          {error ? (
            <p
              role="alert"
              className="mx-4 mb-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200 sm:mx-6"
            >
              {error}
            </p>
          ) : (
            <table
              className="w-full min-w-[720px] text-left text-sm"
            >
              <thead className="border-y border-gray-100 bg-gray-50/60 text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium sm:px-6">Name</th>
                  <th className="px-4 py-3 font-medium sm:px-6">Role</th>
                  <th className="px-4 py-3 font-medium sm:px-6">Vendor</th>
                  <th className="px-4 py-3 font-medium sm:px-6">Status</th>
                  <th className="px-4 py-3 font-medium sm:px-6">Joined</th>
                  <th className="px-4 py-3 font-medium sm:px-6" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {users === null && <SkeletonRows rows={5} cols={6} label="Loading team members" />}
                {rows.map((u) => {
                  const own = me?.id === u.id;
                  return (
                    <tr
                      key={u.id}
                      className="border-b border-gray-100 last:border-0"
                    >
                      <td className="px-4 py-2.5 sm:px-6">
                        <p className="font-semibold leading-tight text-gray-900">
                          {u.name}
                          {own && <span className="ml-1.5 text-xs font-normal text-gray-400">(you)</span>}
                        </p>
                        <p className="break-all text-xs leading-tight text-gray-500">
                          {u.email}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 sm:px-6">
                        <span
                          className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            u.role === "admin"
                              ? "bg-brand-50 text-brand-800 ring-1 ring-brand-200"
                              : u.role === "dhruva"
                                ? "bg-violet-50 text-violet-800 ring-1 ring-violet-200"
                                : u.role === "viewer"
                                  ? "bg-slate-100 text-slate-700 ring-1 ring-slate-300"
                                  : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {roleLabel(u.role)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 sm:px-6">
                        {u.role === "vendor" ? (
                          <VendorCell user={u} vendors={vendors} onChanged={load} />
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 sm:px-6">
                        <StatusCell user={u} editable={isAdmin && !own} onSaved={replaceUser} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-gray-600 sm:px-6">
                        {formatDate(u.created_at)}
                      </td>
                      <td className="px-4 py-1 text-right sm:px-6">
                        <RowMenu
                          user={u}
                          own={own}
                          onEdit={() => setEditing(u)}
                          onRemove={() => setRemoving(u)}
                        />
                      </td>
                    </tr>
                  );
                })}
                {!loading && users !== null && rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-10 text-center text-gray-500"
                    >
                      No team members yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {editing && (
        <EditDialog
          user={editing}
          own={me?.id === editing.id}
          vendors={vendors}
          onCancel={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      )}
      {removing && me?.id !== removing.id && (
        <RemoveDialog
          user={removing}
          onCancel={() => setRemoving(null)}
          onRemoved={() => {
            // The login is gone: its row disappears at once
            const id = removing.id;
            setRemoving(null);
            setUsers((list) => (list ?? []).filter((x) => x.id !== id));
          }}
        />
      )}

      <VendorsSection onChanged={reloadVendors} />
    </DashboardLayout>
  );
}
