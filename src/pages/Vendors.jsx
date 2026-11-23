import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, X } from "lucide-react";
import DashboardLayout from "../components/layout/DashboardLayout.jsx";
import Modal, { modalCancelBtn, modalDangerBtn, modalPrimaryBtn } from "../components/shared/Modal.jsx";
import { createVendor, listVendors, updateVendor } from "../api/vendors.js";
import { apiErrorText } from "../api/errors.js";

// Vendors (admin only; docs/API_REFERENCE.md sections 5 and 12): every vendor, active and
// inactive, with lead_count (KOC → Vendors leads assigned to it now) and vtk_lead_count (its
// Vendor → KOC leads). Add, rename, activate / deactivate. API errors (409, 400, 422) as returned.

const inputClass =
  "w-full min-h-11 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition placeholder:text-gray-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20";
const count = (n) => Number(n ?? 0).toLocaleString("en-IN");
const rowBtn = "inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-medium ring-1 transition";

function ErrorText({ children }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
      {children}
    </p>
  );
}

function RenameDialog({ vendor, onSaved, onCancel }) {
  const [name, setName] = useState(vendor.name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) return setError("Enter a name.");
    if (clean === vendor.name) return onCancel();
    setBusy(true);
    setError("");
    try {
      await updateVendor(vendor.id, { name: clean });
      await onSaved();
    } catch (err) {
      setError(apiErrorText(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Rename ${vendor.name}`}
      onClose={onCancel}
      footer={
        <>
          <button type="button" onClick={onCancel} className={modalCancelBtn}>Cancel</button>
          <button type="submit" form="rename-vendor" disabled={busy} className={modalPrimaryBtn}>{busy ? "Saving…" : "Save"}</button>
        </>
      }
    >
      <form id="rename-vendor" onSubmit={submit} noValidate>
        <label className="block">
          <span className="mb-1 block px-1 text-xs font-medium text-gray-600">Vendor name</span>
          <input value={name} onChange={(e) => { setName(e.target.value); setError(""); }} autoComplete="off" className={inputClass} />
        </label>
        <ErrorText>{error}</ErrorText>
      </form>
    </Modal>
  );
}

function StatusDialog({ vendor, onSaved, onCancel }) {
  const deactivate = vendor.is_active !== false;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      await updateVendor(vendor.id, { is_active: !deactivate });
      await onSaved();
    } catch (err) {
      setError(apiErrorText(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`${deactivate ? "Deactivate" : "Activate"} ${vendor.name}?`}
      role="alertdialog"
      size="sm:max-w-sm"
      onClose={onCancel}
      footer={
        <>
          <button type="button" onClick={onCancel} className={modalCancelBtn}>Cancel</button>
          <button type="button" onClick={confirm} disabled={busy} className={deactivate ? modalDangerBtn : modalPrimaryBtn}>
            {busy ? "Saving…" : deactivate ? "Deactivate" : "Activate"}
          </button>
        </>
      }
    >
      <p className="text-sm text-gray-600">
        {deactivate
          ? "Leads already assigned to it by hand keep showing it. Automatic rules stop choosing it, and it can't be picked again until you activate it."
          : "It can be picked again for leads and logins, and automatic rules may choose it."}
      </p>
      <ErrorText>{error}</ErrorText>
    </Modal>
  );
}

export default function Vendors() {
  const [vendors, setVendors] = useState(() => listVendors.peek({ includeInactive: true }) ?? []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [renaming, setRenaming] = useState(null);
  const [toggling, setToggling] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const list = await listVendors({ includeInactive: true });
      setVendors(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(apiErrorText(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function add(e) {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) return setFormError("Enter a name.");
    setSaving(true);
    setFormError("");
    try {
      await createVendor({ name: clean });
      setName("");
      setShowForm(false);
      await load();
    } catch (err) {
      setFormError(apiErrorText(err));
    } finally {
      setSaving(false);
    }
  }

  const done = async () => {
    setRenaming(null);
    setToggling(null);
    await load();
  };

  return (
    <DashboardLayout title="Vendors">
      <section className="min-w-0 rounded-2xl bg-white shadow-md shadow-gray-200/70 ring-1 ring-gray-100">
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 pt-5 sm:px-6 sm:pt-6">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900">Vendors</h2>
            <p className="mt-1 text-sm text-gray-500">
              Partners leads are assigned to. Inactive vendors keep their leads but can't be picked.
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
            {showForm ? "Cancel" : "Add vendor"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={add} noValidate className="mx-4 mt-5 rounded-2xl bg-gray-50 p-4 ring-1 ring-gray-100 sm:mx-6 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="block flex-1">
                <span className="mb-1 block px-1 text-xs font-medium text-gray-600">Vendor name</span>
                <input value={name} onChange={(e) => { setName(e.target.value); setFormError(""); }} autoComplete="off" className={inputClass} />
              </label>
              <button type="submit" disabled={saving} className="min-h-11 rounded-full bg-brand-700 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-800 disabled:opacity-60">
                {saving ? "Adding…" : "Add vendor"}
              </button>
            </div>
            {formError && (
              <p role="alert" className="mt-3 px-1 text-sm text-red-600">{formError}</p>
            )}
          </form>
        )}

        <div className="mt-5 overflow-x-auto">
          {error ? (
            <p role="alert" className="mx-4 mb-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200 sm:mx-6">
              {error}
            </p>
          ) : (
            <table className={`w-full min-w-[640px] text-left text-sm ${loading ? "opacity-50" : ""}`}>
              <thead className="border-y border-gray-100 bg-gray-50/60 text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium sm:px-6">Vendor</th>
                  <th className="px-4 py-3 font-medium sm:px-6">Status</th>
                  <th className="px-4 py-3 text-right font-medium sm:px-6">KOC → Vendor leads</th>
                  <th className="px-4 py-3 text-right font-medium sm:px-6">Vendor → KOC leads</th>
                  <th className="px-4 py-3 font-medium sm:px-6" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) => {
                  const active = v.is_active !== false;
                  return (
                    <tr key={v.id} className="border-b border-gray-100 last:border-0">
                      <td className="px-4 py-2.5 font-semibold text-gray-900 sm:px-6">{v.name}</td>
                      <td className="px-4 py-2.5 sm:px-6">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${active ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-gray-100 text-gray-600 ring-gray-200"}`}>
                          {active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-gray-800 sm:px-6">{count(v.lead_count)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-gray-800 sm:px-6">{count(v.vtk_lead_count)}</td>
                      <td className="px-4 py-1 sm:px-6">
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => setRenaming(v)} aria-label={`Rename ${v.name}`} className={`${rowBtn} text-gray-700 ring-gray-200 hover:bg-gray-50`}>
                            <Pencil size={13} /> Rename
                          </button>
                          <button
                            type="button"
                            onClick={() => setToggling(v)}
                            className={`${rowBtn} ${active ? "text-red-700 ring-red-200 hover:bg-red-50" : "text-emerald-700 ring-emerald-200 hover:bg-emerald-50"}`}
                          >
                            {active ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!loading && vendors.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-gray-500">No vendors yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {renaming && <RenameDialog vendor={renaming} onSaved={done} onCancel={() => setRenaming(null)} />}
      {toggling && <StatusDialog vendor={toggling} onSaved={done} onCancel={() => setToggling(null)} />}
    </DashboardLayout>
  );
}
