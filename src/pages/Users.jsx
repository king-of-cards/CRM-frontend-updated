import { useCallback, useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import DashboardLayout from "../components/layout/DashboardLayout.jsx";
import { createUser, listUsers } from "../api/users.js";

const EMPTY_FORM = { name: "", email: "", password: "", role: "vendor" };

const inputClass =
  "w-full rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition placeholder:text-gray-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20";

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

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setUsers(await listUsers());
    } catch (err) {
      setError(
        err.status === 403
          ? "Only admins can manage team members."
          : err.message,
      );
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

    setSaving(true);
    try {
      await createUser({
        ...form,
        name: form.name.trim(),
        email: form.email.trim(),
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      await load();
    } catch (err) {
      setFormError(
        err.status === 409
          ? "Someone with that email is already registered."
          : err.message,
      );
    } finally {
      setSaving(false);
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
              People who can sign in to the CRM.
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
              className={`w-full min-w-[600px] text-left text-sm ${loading ? "opacity-50" : ""}`}
            >
              <thead className="border-y border-gray-100 bg-gray-50/60 text-xs text-gray-500">
                <tr>
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Role</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-gray-100 last:border-0"
                  >
                    <td className="px-6 py-2.5">
                      <p className="font-semibold leading-tight text-gray-900">
                        {u.name}
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
                    <td className="px-6 py-2.5 text-gray-600">
                      {u.is_active ? "Active" : "Disabled"}
                    </td>
                    <td className="px-6 py-2.5 text-gray-600">
                      {formatDate(u.created_at)}
                    </td>
                  </tr>
                ))}
                {!loading && users.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
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
    </DashboardLayout>
  );
}
