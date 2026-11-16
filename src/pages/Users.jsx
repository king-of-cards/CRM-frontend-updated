import { useCallback, useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import DashboardLayout from "../components/layout/DashboardLayout.jsx";
import { createUser, listUsers, setUserActive } from "../api/users.js";
import { linkVendorUser, listKocVendors, unlinkVendorUser } from "../api/vendorToKoc.js";
import { useAuth } from "../auth/useAuth.js";
import { kocErrors } from "../components/vendorToKoc/kocUtils.js";

// Team (admin only; docs/API_REFERENCE.md section 12): logins with their role, vendor and status;
// create a login (vendor logins pick their vendor); link / move / unlink a vendor login;
// block / unblock (not your own login). API errors are shown as the API returns them.

const EMPTY_FORM = { name: "", email: "", password: "", role: "vendor", vendor_id: "" };
const NOT_LINKED = "";

const inputClass =
  "w-full rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition placeholder:text-gray-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20";
const smallSelect =
  "rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-800 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 disabled:opacity-60";

// The API's message (a string, or FastAPI's validation list), as returned
const apiMessage = (err) => {
  const { fields, message } = kocErrors(err);
  return message || Object.values(fields).join(" ") || err.message;
};

function formatDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

function ConfirmDialog({ title, text, confirmLabel, danger, busy, error, onConfirm, onCancel }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Cancel" onClick={onCancel} className="absolute inset-0 bg-gray-900/30 backdrop-blur-[2px]" />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-gray-100">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        <p className="mt-2 text-sm text-gray-600">{text}</p>
        {error && (
          <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-full px-5 py-2 text-sm font-semibold text-white disabled:opacity-60 ${danger ? "bg-red-600 hover:bg-red-700" : "bg-brand-700 hover:bg-brand-800"}`}
          >
            {busy ? "Saving…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// The vendor of a vendor login: pick one to link / move, "Not linked" to unlink
function VendorCell({ user, vendors, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const current = user.vendor_id != null ? String(user.vendor_id) : NOT_LINKED;
  // Inactive vendors are listed only when the login is already linked to one
  const choices = vendors.filter((v) => v.is_active !== false || String(v.id) === current);

  async function change(value) {
    if (value === current) return;
    setBusy(true);
    setError("");
    try {
      if (value === NOT_LINKED) await unlinkVendorUser(current, user.id);
      else await linkVendorUser(value, user.id);
      await onChanged();
    } catch (err) {
      setError(apiMessage(err));
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
        className={`${smallSelect} ${current === NOT_LINKED ? "text-amber-700" : ""}`}
      >
        <option value={NOT_LINKED}>Not linked</option>
        {choices.map((v) => (
          <option key={v.id} value={String(v.id)}>
            {v.name}
            {v.is_active === false ? " (inactive)" : ""}
          </option>
        ))}
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
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [confirm, setConfirm] = useState(null); // { user, block }
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [u, v] = await Promise.all([listUsers({ limit: 200 }), listKocVendors()]);
      setUsers(u);
      setVendors(v);
    } catch (err) {
      setError(apiMessage(err));
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
    if (form.role === "vendor" && !form.vendor_id)
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
      setFormError(apiMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function confirmBlock() {
    setConfirmBusy(true);
    setConfirmError("");
    try {
      await setUserActive(confirm.user.id, !confirm.block);
      setConfirm(null);
      await load();
    } catch (err) {
      setConfirmError(apiMessage(err));
    } finally {
      setConfirmBusy(false);
    }
  }

  return (
    <DashboardLayout title="Team">
      <section className="rounded-2xl bg-white shadow-md shadow-gray-200/70 ring-1 ring-gray-100">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 pt-6">
          <div>
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
            className="flex items-center gap-1.5 rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
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
            className="mx-6 mt-5 rounded-2xl bg-gray-50 p-5 ring-1 ring-gray-100"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block px-1 text-xs font-medium text-gray-600">
                  Full name
                </span>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  autoComplete="off"
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1 block px-1 text-xs font-medium text-gray-600">
                  Email
                </span>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  autoComplete="off"
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1 block px-1 text-xs font-medium text-gray-600">
                  Temporary password (min. 8 characters)
                </span>
                <input
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1 block px-1 text-xs font-medium text-gray-600">
                  Role
                </span>
                <select
                  name="role"
                  value={form.role}
                  onChange={handleChange}
                  className={inputClass}
                >
                  <option value="vendor">Vendor</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              {form.role === "vendor" && (
                <label className="block">
                  <span className="mb-1 block px-1 text-xs font-medium text-gray-600">
                    Vendor<span className="ml-0.5 text-red-600">*</span>
                  </span>
                  <select
                    name="vendor_id"
                    value={form.vendor_id}
                    onChange={handleChange}
                    className={inputClass}
                  >
                    <option value="">Pick a vendor</option>
                    {vendors
                      .filter((v) => v.is_active !== false)
                      .map((v) => (
                        <option key={v.id} value={String(v.id)}>
                          {v.name}
                        </option>
                      ))}
                  </select>
                </label>
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
                className="rounded-full bg-brand-700 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-800 disabled:opacity-60"
              >
                {saving ? "Adding…" : "Add member"}
              </button>
            </div>
          </form>
        )}

        {/* List */}
        <div className="mt-5 overflow-x-auto">
          {error ? (
            <p
              role="alert"
              className="mx-6 mb-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200"
            >
              {error}
            </p>
          ) : (
            <table
              className={`w-full min-w-[760px] text-left text-sm ${loading ? "opacity-50" : ""}`}
            >
              <thead className="border-y border-gray-100 bg-gray-50/60 text-xs text-gray-500">
                <tr>
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Role</th>
                  <th className="px-6 py-3 font-medium">Vendor</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Joined</th>
                  <th className="px-6 py-3 font-medium" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const own = me?.id === u.id;
                  return (
                    <tr
                      key={u.id}
                      className="border-b border-gray-100 last:border-0"
                    >
                      <td className="px-6 py-2.5">
                        <p className="font-semibold leading-tight text-gray-900">
                          {u.name}
                          {own && <span className="ml-1.5 text-xs font-normal text-gray-400">(you)</span>}
                        </p>
                        <p className="text-xs leading-tight text-gray-500">
                          {u.email}
                        </p>
                      </td>
                      <td className="px-6 py-2.5">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                            u.role === "admin"
                              ? "bg-brand-50 text-brand-800 ring-1 ring-brand-200"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-2.5">
                        {u.role === "vendor" ? (
                          <VendorCell user={u} vendors={vendors} onChanged={load} />
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-6 py-2.5">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
                            u.is_active
                              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                              : "bg-red-50 text-red-700 ring-red-200"
                          }`}
                        >
                          {u.is_active ? "Active" : "Blocked"}
                        </span>
                      </td>
                      <td className="px-6 py-2.5 text-gray-600">
                        {formatDate(u.created_at)}
                      </td>
                      <td className="px-6 py-2.5 text-right">
                        {!own && (
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmError("");
                              setConfirm({ user: u, block: u.is_active });
                            }}
                            className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${
                              u.is_active
                                ? "text-red-700 ring-red-200 hover:bg-red-50"
                                : "text-emerald-700 ring-emerald-200 hover:bg-emerald-50"
                            }`}
                          >
                            {u.is_active ? "Block" : "Unblock"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!loading && users.length === 0 && (
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

      {confirm && (
        <ConfirmDialog
          title={confirm.block ? `Block ${confirm.user.name}?` : `Unblock ${confirm.user.name}?`}
          text={
            confirm.block
              ? "They're signed out everywhere at once and can't sign in until you unblock them."
              : "They can sign in again."
          }
          confirmLabel={confirm.block ? "Block" : "Unblock"}
          danger={confirm.block}
          busy={confirmBusy}
          error={confirmError}
          onConfirm={confirmBlock}
          onCancel={() => setConfirm(null)}
        />
      )}
    </DashboardLayout>
  );
}
