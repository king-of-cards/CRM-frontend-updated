import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Building2,
  DownloadCloud,
  MapPin,
  Pencil,
  Phone,
  Plus,
  User,
  X,
} from "lucide-react";
import DashboardLayout from "../components/layout/DashboardLayout.jsx";
import {
  createBranch,
  importBranches,
  listBranches,
  updateBranch,
} from "../api/branches.js";
import { listVendors } from "../api/vendors.js";

// Branches (stores): the spin wheel stores a branch id on every lead. Each branch has a
// vendor, so spin leads from that store go to the right partner automatically.

const fmt = (n) => (n ?? 0).toLocaleString("en-IN");
const fieldCls =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20";
const CITY_TONES = [
  "from-brand-600 to-brand-800",
  "from-violet-500 to-violet-700",
  "from-rose-500 to-rose-700",
  "from-amber-500 to-amber-600",
  "from-sky-500 to-sky-700",
];
const tone = (city) =>
  CITY_TONES[
    [...String(city || "")].reduce((t, c) => t + c.charCodeAt(0), 0) %
      CITY_TONES.length
  ];

function BranchForm({ branch, presetId, vendors, onClose, onSaved }) {
  const isNew = !branch;
  const [form, setForm] = useState(() => ({
    id: branch?.id ?? presetId ?? "",
    name: branch?.name ?? "",
    code: branch?.code ?? "",
    city: branch?.city ?? "",
    vendor_id: branch?.vendor ? String(branch.vendor.id) : "",
    manager_name: branch?.manager_name ?? "",
    contact_number: branch?.contact_number ?? "",
    address: branch?.address ?? "",
    is_active: branch?.is_active ?? true,
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) return setError("Enter the branch name.");
    setSaving(true);
    setError("");
    const body = {
      name: form.name.trim(),
      code: form.code.trim() || null,
      city: form.city.trim() || null,
      vendor_id: form.vendor_id ? Number(form.vendor_id) : null,
      manager_name: form.manager_name.trim() || null,
      contact_number: form.contact_number.trim() || null,
      address: form.address.trim() || null,
      is_active: form.is_active,
    };
    try {
      if (isNew)
        await createBranch({ ...body, id: form.id ? Number(form.id) : null });
      else await updateBranch(branch.id, body);
      onSaved();
      onClose();
    } catch (err) {
      setError(
        err.status === 409
          ? `Branch id ${form.id} already exists.`
          : err.message,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={isNew ? "Add branch" : `Edit ${branch.name}`}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-gray-900/30 backdrop-blur-[2px]"
      />
      <form
        onSubmit={submit}
        className="relative flex h-full w-full max-w-md flex-col bg-linear-to-b from-white via-white to-brand-50 shadow-2xl"
      >
        <div className="flex items-center justify-between bg-linear-to-r from-brand-800 via-brand-700 to-brand-600 px-6 py-5 text-white">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
              Branch
            </p>
            <h2 className="text-lg font-semibold">
              {isNew ? "Add branch" : branch.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
          <div className="grid grid-cols-[110px_1fr] gap-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-600">
                Branch id
              </span>
              <input
                type="number"
                min={1}
                value={form.id}
                onChange={(e) => set("id", e.target.value)}
                disabled={!isNew}
                placeholder="auto"
                className={`mt-1.5 ${fieldCls} disabled:bg-gray-50 disabled:text-gray-500`}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Name</span>
              <input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Koramangala"
                className={`mt-1.5 ${fieldCls}`}
              />
            </label>
          </div>
          {isNew && (
            <p className="-mt-2 text-[11px] text-gray-500">
              Use the same id the spin wheel uses for this store, so its leads
              show this branch.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Code</span>
              <input
                value={form.code}
                onChange={(e) => set("code", e.target.value)}
                placeholder="KRM-013"
                className={`mt-1.5 ${fieldCls}`}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">City</span>
              <input
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                placeholder="Bangalore"
                className={`mt-1.5 ${fieldCls}`}
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-gray-600">
              Vendor for this branch's leads
            </span>
            <select
              value={form.vendor_id}
              onChange={(e) => set("vendor_id", e.target.value)}
              className={`mt-1.5 ${fieldCls}`}
            >
              <option value="">
                {branch?.auto_vendor
                  ? `Automatic · ${branch.auto_vendor.name} (area rules)`
                  : "Automatic (area rules)"}
              </option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                  {v.coverage ? ` · ${v.coverage}` : ""}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Manager</span>
              <input
                value={form.manager_name}
                onChange={(e) => set("manager_name", e.target.value)}
                className={`mt-1.5 ${fieldCls}`}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">
                Contact number
              </span>
              <input
                value={form.contact_number}
                onChange={(e) => set("contact_number", e.target.value)}
                className={`mt-1.5 ${fieldCls}`}
              />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Address</span>
            <textarea
              rows={2}
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              className={`mt-1.5 resize-y ${fieldCls}`}
            />
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => set("is_active", e.target.checked)}
              className="h-4 w-4 accent-brand-600"
            />
            Active store
          </label>
          {error && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200"
            >
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-linear-to-r from-brand-600 to-brand-800 px-6 py-2 text-sm font-semibold text-white shadow-md shadow-brand-700/25 disabled:opacity-60"
          >
            {saving ? "Saving…" : isNew ? "Add branch" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function Branches() {
  const [data, setData] = useState(() => listBranches.peek() ?? null);
  const [vendors, setVendors] = useState(() => listVendors.peek() ?? []);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(undefined); // undefined closed, null new, object edit
  const [presetId, setPresetId] = useState(null);
  const [importing, setImporting] = useState(false);
  const [savingVendor, setSavingVendor] = useState(null);

  const load = useCallback(() => {
    listBranches()
      .then((d) => {
        setData(d);
        setError("");
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    load();
    listVendors()
      .then(setVendors)
      .catch(() => {});
  }, [load]);

  async function changeVendor(branch, vendorId) {
    setSavingVendor(branch.id);
    try {
      await updateBranch(branch.id, {
        vendor_id: vendorId ? Number(vendorId) : null,
      });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingVendor(null);
    }
  }

  async function runImport() {
    setImporting(true);
    setNotice("");
    try {
      const r = await importBranches();
      setNotice(
        r.added
          ? `${r.added} new branch${r.added === 1 ? "" : "es"} added from the spin wheel.`
          : "All spin wheel branches are already here.",
      );
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  const branches = data?.branches ?? [];
  const active = branches.filter((b) => b.is_active);
  const totalLeads = branches.reduce((t, b) => t + (b.spin_leads ?? 0), 0);
  const cities = new Set(active.map((b) => b.city).filter(Boolean));
  const noVendor = active.filter((b) => !b.vendor && !b.auto_vendor).length;

  return (
    <DashboardLayout
      title="Branches"
      description="King of Cards stores. Spin leads show their branch and go to the branch's vendor."
      actions={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={runImport}
            disabled={importing}
            className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-200 transition hover:bg-gray-50 disabled:opacity-60"
          >
            <DownloadCloud size={15} />{" "}
            {importing ? "Importing…" : "Import from spin wheel"}
          </button>
          <button
            type="button"
            onClick={() => {
              setPresetId(null);
              setEditing(null);
            }}
            className="flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700"
          >
            <Plus size={15} /> Add branch
          </button>
        </div>
      }
    >
      {(error || notice) && (
        <p
          role={error ? "alert" : "status"}
          className={`mt-6 rounded-xl px-4 py-3 text-sm ring-1 ${error ? "bg-red-50 text-red-700 ring-red-200" : "bg-emerald-50 text-emerald-700 ring-emerald-200"}`}
        >
          {error || notice}
        </p>
      )}

      {/* Branch ids used by spin leads that aren't set up */}
      {data?.unknown_branch_ids?.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl bg-amber-50 px-5 py-4 ring-1 ring-amber-200">
          <AlertTriangle size={18} className="text-amber-600" />
          <p className="text-sm text-amber-800">
            Spin leads use branch ids that aren't set up yet:
          </p>
          {data.unknown_branch_ids.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setPresetId(id);
                setEditing(null);
              }}
              className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-amber-800 ring-1 ring-amber-300 hover:bg-amber-100"
            >
              + Add #{id}
            </button>
          ))}
        </div>
      )}

      {/* Totals */}
      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Active branches", value: fmt(active.length) },
          { label: "Cities", value: fmt(cities.size) },
          { label: "Spin leads with a branch", value: fmt(totalLeads) },
          {
            label: "Branches without a vendor",
            value: fmt(noVendor),
            warn: noVendor > 0,
          },
        ].map((k) => (
          <div
            key={k.label}
            className={`rounded-2xl p-5 ring-1 shadow-sm ${k.warn ? "bg-amber-50 ring-amber-100" : "bg-white ring-gray-100 shadow-gray-200/60"}`}
          >
            <p
              className={`text-sm font-medium ${k.warn ? "text-amber-700" : "text-gray-500"}`}
            >
              {k.label}
            </p>
            <p
              className={`mt-2 text-3xl font-bold tabular-nums ${k.warn ? "text-amber-800" : "text-gray-900"}`}
            >
              {data ? k.value : "—"}
            </p>
          </div>
        ))}
      </section>

      {/* Branch cards */}
      <section className="mt-6 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {!data &&
          Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-3xl bg-gray-100"
            />
          ))}
        {branches.map((b) => (
          <article
            key={b.id}
            className={`overflow-hidden rounded-3xl bg-white ring-1 ring-gray-100 shadow-sm shadow-gray-200/60 transition hover:shadow-lg ${b.is_active ? "" : "opacity-60"}`}
          >
            <div className={`h-1.5 bg-linear-to-r ${tone(b.city)}`} />
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-linear-to-br text-white ${tone(b.city)}`}
                  >
                    <Building2 size={20} aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">
                      {b.name}
                      {!b.is_active && (
                        <span className="ml-2 rounded bg-gray-100 px-1.5 text-xs font-medium text-gray-500">
                          Inactive
                        </span>
                      )}
                    </h2>
                    <p className="flex items-center gap-1 text-sm text-gray-500">
                      <MapPin size={13} aria-hidden="true" />
                      {b.city || "City not set"}
                      <span className="text-gray-300">·</span>
                      <span className="font-mono text-xs">
                        {b.code || "no code"}
                      </span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(b)}
                  aria-label={`Edit ${b.name}`}
                  className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-900"
                >
                  <Pencil size={16} />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-gray-50 px-4 py-3">
                  <p className="text-[11px] text-gray-500">Spin leads</p>
                  <p className="text-xl font-bold tabular-nums text-gray-900">
                    {fmt(b.spin_leads)}
                  </p>
                </div>
                <label className="rounded-2xl bg-gray-50 px-4 py-3">
                  <span className="block text-[11px] text-gray-500">
                    Vendor
                  </span>
                  <select
                    value={b.vendor ? String(b.vendor.id) : ""}
                    disabled={savingVendor === b.id}
                    onChange={(e) => changeVendor(b, e.target.value)}
                    className={`mt-0.5 w-full cursor-pointer bg-transparent text-sm font-semibold outline-none ${b.vendor || b.auto_vendor ? "text-brand-800" : "text-amber-700"}`}
                  >
                    <option value="">
                      {b.auto_vendor
                        ? `${b.auto_vendor.name} · auto`
                        : "Not set"}
                    </option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-600">
                  Spin id #{b.id}
                </span>
                {b.manager_name && (
                  <span className="flex items-center gap-1">
                    <User size={12} /> {b.manager_name}
                  </span>
                )}
                {b.contact_number && (
                  <a
                    href={`tel:${b.contact_number}`}
                    className="flex items-center gap-1 hover:text-gray-900"
                  >
                    <Phone size={12} /> {b.contact_number}
                  </a>
                )}
                <span className="ml-auto text-gray-400">
                  {b.source === "workflow" ? "From spin wheel" : "Added in CRM"}
                </span>
              </div>
            </div>
          </article>
        ))}
      </section>

      <p className="mt-6 text-xs text-gray-500">
        A spin lead's vendor: one picked in the CRM wins; otherwise its branch's
        vendor. A branch's vendor is automatic (“· auto”, from the vendors' area
        rules: RJ for Chamrajpet, Phodeo for the rest of Bangalore, OHP
        elsewhere) unless you pick one here.
      </p>

      {editing !== undefined && (
        <BranchForm
          branch={editing}
          presetId={presetId}
          vendors={vendors}
          onClose={() => setEditing(undefined)}
          onSaved={load}
        />
      )}
    </DashboardLayout>
  );
}
