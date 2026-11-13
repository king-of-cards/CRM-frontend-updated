import { useEffect, useState } from "react";
import { BadgeCheck, Pencil, X } from "lucide-react";
import { INTEREST_OPTIONS, saveLeadCrm } from "../../api/leadCrm.js";
import { listVendors } from "../../api/vendors.js";

// The CRM columns every lead table shows (Assigned to, Interest, Quote, Converted)
// and the side panel to edit them. The details are saved in our own database next to
// the lead (sidecar), so the original source (read-only database or Google Sheet) is untouched.

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const shortDate = (d) =>
  d
    ? new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      })
    : null;

const HOW = {
  manual: {
    title: "Assigned in the CRM",
    cls: "bg-brand-700 text-white ring-brand-700",
  },
  sheet: {
    title: "From the sheet's “leads shared” column",
    cls: "bg-brand-50 text-brand-800 ring-brand-200",
  },
  suggested: {
    title: "Suggested by the vendor's area rules",
    cls: "bg-white text-gray-600 ring-gray-300",
  },
};

export function CrmHeaderCells({ className = "px-4 py-3 font-medium" }) {
  return (
    <>
      <th className={className}>Assigned to</th>
      <th className={className}>Interest</th>
      <th className={`${className} text-right`}>Quote</th>
      <th className={className}>Converted</th>
    </>
  );
}

export function CrmRowCells({ crm, onEdit, className = "px-4 py-2.5" }) {
  if (!crm) {
    return (
      <>
        {[0, 1, 2, 3].map((i) => (
          <td key={i} className={`${className} text-gray-300`}>
            —
          </td>
        ))}
      </>
    );
  }
  const how = HOW[crm.vendor_source];
  const interest = INTEREST_OPTIONS.find((o) => o.value === crm.interest);
  const open = (e) => {
    e.stopPropagation();
    onEdit();
  };
  return (
    <>
      {/* Assigned to */}
      <td className={`whitespace-nowrap ${className}`}>
        <button
          type="button"
          onClick={open}
          className="group inline-flex items-center gap-1.5"
          title={how?.title ?? "Assign a vendor"}
        >
          {crm.vendor ? (
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${how?.cls ?? ""} ${crm.vendor_source === "suggested" ? "border border-dashed border-gray-300 ring-0" : ""}`}
            >
              {crm.vendor.name}
            </span>
          ) : (
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
              Unassigned
            </span>
          )}
          {crm.vendor_source === "suggested" && (
            <span className="text-[10px] uppercase tracking-wide text-gray-400">
              auto
            </span>
          )}
          <Pencil
            size={12}
            className="text-gray-300 opacity-0 transition-opacity group-hover:opacity-100"
            aria-hidden="true"
          />
        </button>
      </td>

      {/* Interest */}
      <td className={`whitespace-nowrap ${className}`}>
        <button type="button" onClick={open} title="Change interest">
          {interest ? (
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${interest.style}`}
            >
              {interest.label}
            </span>
          ) : (
            <span className="text-xs text-gray-400 hover:text-gray-700">
              Set…
            </span>
          )}
        </button>
      </td>

      {/* Quote */}
      <td className={`whitespace-nowrap text-right ${className}`}>
        <button
          type="button"
          onClick={open}
          className="text-right"
          title="Add or change the quote"
        >
          {crm.quoted_amount != null || crm.quoted_date ? (
            <>
              <span className="block font-semibold tabular-nums leading-tight text-gray-900">
                {crm.quoted_amount != null
                  ? inr.format(crm.quoted_amount)
                  : "—"}
              </span>
              {crm.quoted_date && (
                <span className="block text-xs leading-tight text-gray-500">
                  {shortDate(crm.quoted_date)}
                </span>
              )}
            </>
          ) : (
            <span className="text-xs text-gray-400 hover:text-gray-700">
              Add…
            </span>
          )}
        </button>
      </td>

      {/* Converted */}
      <td className={`whitespace-nowrap ${className}`}>
        <button type="button" onClick={open} title="Mark as converted">
          {crm.converted ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-0.5 text-xs font-semibold text-white">
              <BadgeCheck size={13} /> Converted
            </span>
          ) : (
            <span className="text-xs text-gray-400 hover:text-gray-700">
              No
            </span>
          )}
        </button>
      </td>
    </>
  );
}

// Replace one lead's crm in a list answer { items: [...] }
export function withCrm(data, leadKey, crm) {
  if (!data) return data;
  return {
    ...data,
    items: data.items.map((i) =>
      i.crm?.lead_key === leadKey ? { ...i, crm } : i,
    ),
  };
}

const fieldCls =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20";

/**
 * Side panel to edit a lead's CRM details.
 * lead: { source, crm, title, subtitle, context: { location, pincode, sheet_vendor } } or null (closed)
 */
export function LeadCrmDrawer({ lead, onClose, onSaved }) {
  const [vendors, setVendors] = useState(() => listVendors.peek() ?? []);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    listVendors()
      .then(setVendors)
      .catch(() => {});
  }, []);

  // Fill the form whenever a different lead is opened
  useEffect(() => {
    if (!lead) return;
    const c = lead.crm;
    setForm({
      vendor_id:
        c.vendor_source === "manual" && c.vendor ? String(c.vendor.id) : "",
      interest: c.interest ?? "",
      converted: Boolean(c.converted),
      quoted_date: c.quoted_date ?? "",
      quoted_amount: c.quoted_amount != null ? String(c.quoted_amount) : "",
      notes: c.notes ?? "",
    });
    setError("");
  }, [lead]);

  // Close with Escape
  useEffect(() => {
    if (!lead) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lead, onClose]);

  if (!lead || !form) return null;
  const c = lead.crm;
  const automatic = c.vendor_source === "manual" ? null : c.vendor; // what applies with "Automatic"
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const amount = form.quoted_amount.replace(/[^\d]/g, "");
      const saved = await saveLeadCrm(
        lead.source,
        c.lead_key,
        {
          vendor_id: form.vendor_id ? Number(form.vendor_id) : null,
          interest: form.interest || null,
          converted: form.converted,
          quoted_date: form.quoted_date || null,
          quoted_amount: amount ? Number(amount) : null,
          notes: form.notes,
        },
        lead.context ?? {},
      );
      onSaved(c.lead_key, saved);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={`Edit ${lead.title}`}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-gray-900/30 backdrop-blur-[2px]"
      />
      <form
        onSubmit={save}
        className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 bg-linear-to-r from-brand-800 to-brand-600 px-6 py-5 text-white">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-white/70">
              {lead.sourceLabel}
            </p>
            <h2 className="truncate text-lg font-semibold">{lead.title}</h2>
            {lead.subtitle && (
              <p className="truncate text-sm text-white/80">{lead.subtitle}</p>
            )}
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

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          {/* Assigned to */}
          <div>
            <label
              htmlFor="crm-vendor"
              className="text-sm font-medium text-gray-900"
            >
              Assigned to
            </label>
            <select
              id="crm-vendor"
              value={form.vendor_id}
              onChange={(e) => set("vendor_id", e.target.value)}
              className={`mt-1.5 ${fieldCls}`}
            >
              <option value="">
                Automatic{automatic ? ` (${automatic.name})` : " (no match)"}
              </option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                  {v.coverage ? ` · ${v.coverage}` : ""}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-gray-500">
              {lead.context?.sheet_vendor
                ? `Sheet says: ${lead.context.sheet_vendor}. `
                : ""}
              {c.suggested_vendor
                ? `Area rules suggest: ${c.suggested_vendor.name}`
                : "No area match (location unknown)"}
              {lead.context?.location
                ? ` · location: ${lead.context.location}`
                : ""}
              {lead.context?.pincode
                ? ` · pincode ${lead.context.pincode}`
                : ""}
            </p>
          </div>

          {/* Interest */}
          <fieldset>
            <legend className="text-sm font-medium text-gray-900">
              Interest
            </legend>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {INTEREST_OPTIONS.map((o) => {
                const active = form.interest === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => set("interest", active ? "" : o.value)}
                    aria-pressed={active}
                    className={`rounded-xl px-2 py-2.5 text-xs font-medium ring-1 transition ${
                      active
                        ? o.style + " ring-2"
                        : "bg-white text-gray-600 ring-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Quote */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="crm-amount"
                className="text-sm font-medium text-gray-900"
              >
                Quoted amount (₹)
              </label>
              <input
                id="crm-amount"
                inputMode="numeric"
                placeholder="e.g. 45000"
                value={form.quoted_amount}
                onChange={(e) =>
                  set("quoted_amount", e.target.value.replace(/[^\d,]/g, ""))
                }
                className={`mt-1.5 ${fieldCls}`}
              />
            </div>
            <div>
              <label
                htmlFor="crm-date"
                className="text-sm font-medium text-gray-900"
              >
                Quoted date
              </label>
              <input
                id="crm-date"
                type="date"
                value={form.quoted_date}
                onChange={(e) => set("quoted_date", e.target.value)}
                className={`mt-1.5 ${fieldCls}`}
              />
            </div>
          </div>

          {/* Converted */}
          <label className="flex cursor-pointer items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
            <span>
              <span className="block text-sm font-medium text-gray-900">
                Converted
              </span>
              <span className="block text-xs text-gray-500">
                The lead became a booking
              </span>
            </span>
            <span className="relative inline-flex">
              <input
                type="checkbox"
                checked={form.converted}
                onChange={(e) => set("converted", e.target.checked)}
                className="peer sr-only"
              />
              <span className="h-6 w-11 rounded-full bg-gray-300 transition peer-checked:bg-emerald-500 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500/40" />
              <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
            </span>
          </label>

          {/* Notes */}
          <div>
            <label
              htmlFor="crm-notes"
              className="text-sm font-medium text-gray-900"
            >
              Notes
            </label>
            <textarea
              id="crm-notes"
              rows={4}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Calls, follow-ups, anything useful…"
              className={`mt-1.5 resize-y ${fieldCls}`}
            />
          </div>

          {c.updated_at && (
            <p className="text-xs text-gray-400">
              Last changed {new Date(c.updated_at).toLocaleString("en-IN")}
            </p>
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

        {/* Footer */}
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
