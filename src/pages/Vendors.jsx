import { useCallback, useEffect, useState } from "react";
import {
  BadgeCheck,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Store,
  X,
} from "lucide-react";
import DashboardLayout from "../components/layout/DashboardLayout.jsx";
import {
  createVendor,
  getVendorStats,
  listVendors,
  updateVendor,
} from "../api/vendors.js";

// Vendors: the partners leads are assigned to, the areas they cover, and how they're doing.

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
function short(amount) {
  if (!amount) return "₹0";
  if (amount >= 1e7) return `₹${+(amount / 1e7).toFixed(2)} Cr`;
  if (amount >= 1e5) return `₹${+(amount / 1e5).toFixed(1)} L`;
  return inr.format(amount);
}
const fmt = (n) => (n ?? 0).toLocaleString("en-IN");

const SOURCE_LABELS = {
  spin: "Spin",
  whatsapp: "International",
  wedding: "Wedding",
  wedding_planner: "Planner",
};
const ACCENTS = [
  "from-brand-600 to-brand-800",
  "from-violet-500 to-violet-700",
  "from-rose-500 to-rose-700",
  "from-amber-500 to-amber-600",
  "from-sky-500 to-sky-700",
];

const EMPTY = {
  name: "",
  coverage: "",
  areas: "",
  pincodes: "",
  pincode_prefixes: "",
  is_fallback: false,
  priority: 50,
  contact_name: "",
  phone: "",
  email: "",
  notes: "",
  is_active: true,
};

const toList = (text) =>
  text
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

const fieldCls =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20";

function VendorForm({ vendor, onClose, onSaved }) {
  const [form, setForm] = useState(() =>
    vendor
      ? {
          ...EMPTY,
          ...vendor,
          areas: (vendor.areas ?? []).join(", "),
          pincodes: (vendor.pincodes ?? []).join(", "),
          pincode_prefixes: (vendor.pincode_prefixes ?? []).join(", "),
          coverage: vendor.coverage ?? "",
          contact_name: vendor.contact_name ?? "",
          phone: vendor.phone ?? "",
          email: vendor.email ?? "",
          notes: vendor.notes ?? "",
        }
      : EMPTY,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) return setError("Enter a name.");
    setSaving(true);
    setError("");
    const body = {
      ...form,
      name: form.name.trim(),
      areas: toList(form.areas),
      pincodes: toList(form.pincodes),
      pincode_prefixes: toList(form.pincode_prefixes),
      priority: Number(form.priority) || 0,
      coverage: form.coverage || null,
      contact_name: form.contact_name || null,
      phone: form.phone || null,
      email: form.email || null,
      notes: form.notes || null,
    };
    delete body.id;
    try {
      const saved = vendor
        ? await updateVendor(vendor.id, body)
        : await createVendor(body);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(
        err.status === 409
          ? "A vendor with that name already exists."
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
      aria-label={vendor ? `Edit ${vendor.name}` : "Add vendor"}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-gray-900/30 backdrop-blur-[2px]"
      />
      <form
        onSubmit={submit}
        className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between bg-linear-to-r from-brand-800 to-brand-600 px-6 py-5 text-white">
          <h2 className="text-lg font-semibold">
            {vendor ? `Edit ${vendor.name}` : "Add vendor"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
          <div className="grid grid-cols-[1fr_96px] gap-3">
            <label className="block">
              <span className="text-sm font-medium text-gray-900">Name</span>
              <input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className={`mt-1.5 ${fieldCls}`}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-900">
                Priority
              </span>
              <input
                type="number"
                min={0}
                max={1000}
                value={form.priority}
                onChange={(e) => set("priority", e.target.value)}
                className={`mt-1.5 ${fieldCls}`}
              />
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-gray-900">
              Coverage (description)
            </span>
            <input
              value={form.coverage}
              onChange={(e) => set("coverage", e.target.value)}
              placeholder="e.g. All Bangalore stores except Chamrajpet"
              className={`mt-1.5 ${fieldCls}`}
            />
          </label>

          <div className="rounded-2xl bg-gray-50 p-4">
            <p className="text-sm font-medium text-gray-900">
              Automatic assignment rules
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              Vendors are checked by priority (lowest first). Separate values
              with commas.
            </p>
            <label className="mt-3 block">
              <span className="text-xs font-medium text-gray-700">
                Area / city words
              </span>
              <input
                value={form.areas}
                onChange={(e) => set("areas", e.target.value)}
                placeholder="chamrajpet, chamarajpet"
                className={`mt-1 ${fieldCls}`}
              />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-gray-700">
                  Exact pincodes
                </span>
                <input
                  value={form.pincodes}
                  onChange={(e) => set("pincodes", e.target.value)}
                  placeholder="560018"
                  className={`mt-1 ${fieldCls}`}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-700">
                  Pincodes starting with
                </span>
                <input
                  value={form.pincode_prefixes}
                  onChange={(e) => set("pincode_prefixes", e.target.value)}
                  placeholder="560"
                  className={`mt-1 ${fieldCls}`}
                />
              </label>
            </div>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.is_fallback}
                onChange={(e) => set("is_fallback", e.target.checked)}
                className="h-4 w-4 accent-brand-600"
              />
              Gets every lead no other vendor matches (fallback)
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-medium text-gray-900">
                Contact person
              </span>
              <input
                value={form.contact_name}
                onChange={(e) => set("contact_name", e.target.value)}
                className={`mt-1.5 ${fieldCls}`}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-900">Phone</span>
              <input
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                className={`mt-1.5 ${fieldCls}`}
              />
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-gray-900">Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              className={`mt-1.5 ${fieldCls}`}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-900">Notes</span>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              className={`mt-1.5 resize-y ${fieldCls}`}
            />
          </label>
          {vendor && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => set("is_active", e.target.checked)}
                className="h-4 w-4 accent-brand-600"
              />
              Active (inactive vendors get no new leads)
            </label>
          )}
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
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function Vendors() {
  const [vendors, setVendors] = useState(
    () => listVendors.peek({ includeInactive: true }) ?? null,
  );
  const [stats, setStats] = useState(() => getVendorStats.peek() ?? null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(undefined); // undefined = closed, null = new, object = edit

  const load = useCallback(() => {
    listVendors({ includeInactive: true })
      .then(setVendors)
      .catch((err) => setError(err.message));
    getVendorStats()
      .then(setStats)
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const statsFor = (id) => stats?.vendors.find((s) => s.vendor.id === id);
  const totals = (stats?.vendors ?? []).reduce(
    (t, s) => ({
      leads: t.leads + s.leads,
      converted: t.converted + s.converted,
      quoted_value: t.quoted_value + s.quoted_value,
      converted_value: t.converted_value + s.converted_value,
    }),
    { leads: 0, converted: 0, quoted_value: 0, converted_value: 0 },
  );

  return (
    <DashboardLayout
      title="Vendors"
      description="Partners your leads are assigned to, the areas they cover, and their results."
      actions={
        <button
          type="button"
          onClick={() => setEditing(null)}
          className="flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
        >
          <Plus size={15} /> Add vendor
        </button>
      }
    >
      {error && (
        <p
          role="alert"
          className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200"
        >
          {error}
        </p>
      )}

      {/* Totals */}
      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Assigned leads",
            value: fmt(totals.leads),
            sub: `${fmt(stats?.unassigned)} without a vendor`,
          },
          {
            label: "Converted",
            value: fmt(totals.converted),
            sub: totals.leads
              ? `${((totals.converted / totals.leads) * 100).toFixed(1)}% of assigned leads`
              : "—",
          },
          {
            label: "Quoted value",
            value: short(totals.quoted_value),
            sub: "All quotes given",
          },
          {
            label: "Converted value",
            value: short(totals.converted_value),
            sub: "Quotes of converted leads",
          },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-2xl bg-white p-5 ring-1 ring-gray-100 shadow-sm shadow-gray-200/60"
          >
            <p className="text-sm font-medium text-gray-500">{k.label}</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-gray-900">
              {stats ? k.value : "—"}
            </p>
            <p className="mt-1 text-xs text-gray-500">{k.sub}</p>
          </div>
        ))}
      </section>

      {/* Vendor cards */}
      <section className="mt-6 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {!vendors &&
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded-2xl bg-gray-100"
            />
          ))}
        {vendors?.map((v, i) => {
          const s = statsFor(v.id);
          const rate = s?.conversion_rate ?? 0;
          return (
            <article
              key={v.id}
              className={`relative overflow-hidden rounded-2xl bg-white ring-1 ring-gray-100 shadow-sm shadow-gray-200/60 ${v.is_active ? "" : "opacity-60"}`}
            >
              <div
                className={`h-1.5 bg-linear-to-r ${ACCENTS[i % ACCENTS.length]}`}
              />
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-11 w-11 items-center justify-center rounded-xl bg-linear-to-br text-white ${ACCENTS[i % ACCENTS.length]}`}
                    >
                      <Store size={20} aria-hidden="true" />
                    </span>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">
                        {v.name}
                        {!v.is_active && (
                          <span className="ml-2 rounded bg-gray-100 px-1.5 text-xs font-medium text-gray-500">
                            Inactive
                          </span>
                        )}
                      </h2>
                      <p className="flex items-center gap-1 text-sm text-gray-500">
                        <MapPin size={13} aria-hidden="true" />
                        {v.coverage ||
                          (v.is_fallback
                            ? "Everything not covered by others"
                            : "No coverage set")}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditing(v)}
                    className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-900"
                    aria-label={`Edit ${v.name}`}
                  >
                    <Pencil size={16} />
                  </button>
                </div>

                {/* Numbers */}
                <dl className="mt-5 grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: "Leads", value: fmt(s?.leads) },
                    { label: "Interested", value: fmt(s?.interested) },
                    { label: "Quoted", value: fmt(s?.quoted) },
                    {
                      label: "Converted",
                      value: fmt(s?.converted),
                      strong: true,
                    },
                  ].map((x) => (
                    <div
                      key={x.label}
                      className={`rounded-xl px-2 py-2.5 ${x.strong ? "bg-emerald-50" : "bg-gray-50"}`}
                    >
                      <dd
                        className={`text-lg font-bold tabular-nums ${x.strong ? "text-emerald-700" : "text-gray-900"}`}
                      >
                        {x.value}
                      </dd>
                      <dt
                        className={`text-[11px] ${x.strong ? "text-emerald-700" : "text-gray-500"}`}
                      >
                        {x.label}
                      </dt>
                    </div>
                  ))}
                </dl>

                {/* Conversion */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 font-medium text-gray-600">
                      <BadgeCheck size={13} className="text-emerald-600" />{" "}
                      Conversion
                    </span>
                    <span className="tabular-nums text-gray-900">{rate}%</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-linear-to-r from-emerald-400 to-emerald-600 transition-all duration-700"
                      style={{ width: `${Math.min(rate, 100)}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-gray-500">
                    {short(s?.quoted_value)} quoted ·{" "}
                    {short(s?.converted_value)} converted
                  </p>
                </div>

                {/* Leads per source */}
                {s && Object.keys(s.by_source).length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {Object.entries(s.by_source).map(([src, n]) => (
                      <span
                        key={src}
                        className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                      >
                        {SOURCE_LABELS[src] ?? src} · {fmt(n)}
                      </span>
                    ))}
                  </div>
                )}

                {/* Rules + contact */}
                <div className="mt-4 space-y-1 border-t border-gray-100 pt-3 text-xs text-gray-500">
                  <p>
                    <span className="font-medium text-gray-700">Rules: </span>
                    {[
                      v.pincodes.length && `pincodes ${v.pincodes.join(", ")}`,
                      v.pincode_prefixes.length &&
                        `pincodes starting ${v.pincode_prefixes.join(", ")}`,
                      v.areas.length && `areas ${v.areas.join(", ")}`,
                      v.is_fallback && "fallback for everything else",
                    ]
                      .filter(Boolean)
                      .join(" · ") || "none (manual assignment only)"}
                    <span className="text-gray-400">
                      {" "}
                      · priority {v.priority}
                    </span>
                  </p>
                  {(v.contact_name || v.phone) && (
                    <p className="flex items-center gap-1">
                      <Phone size={12} aria-hidden="true" />
                      {[v.contact_name, v.phone, v.email]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <p className="mt-6 text-xs text-gray-500">
        How a lead's vendor is chosen: a vendor picked in the CRM wins;
        otherwise the sheet's “leads shared” column; otherwise these area rules
        (checked by priority, lowest first).
      </p>

      {editing !== undefined && (
        <VendorForm
          vendor={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => load()}
        />
      )}
    </DashboardLayout>
  );
}
