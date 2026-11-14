import { useEffect, useState } from "react";
import {
  BadgeCheck,
  Download,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  X,
} from "lucide-react";
import {
  INTEREST_OPTIONS,
  interestInfo,
  saveLeadCrm,
} from "../../api/leadCrm.js";
import { useVendors } from "./InlineCrm.jsx";
import { downloadLeadPdf } from "./leadPdf.js";

// Side panel for one lead: header in the app's green, a soft white gradient body,
// contact buttons, the editable CRM details, every field, and a PDF download.
//
// lead = {
//   source, sourceLabel, row, crm, context,
//   title, subtitle, phone (digits with country code), email,
//   sections: [{ title, rows: [[label, value], ...] }],   // shown and put in the PDF
//   extra?: node                                           // e.g. the planner's events
// }

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const fieldCls =
  "w-full rounded-xl border border-gray-200 bg-white/90 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20";

const initials = (name) =>
  String(name || "?")
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "#";

function formFrom(crm) {
  return {
    vendor_id:
      crm?.vendor_source === "manual" && crm?.vendor
        ? String(crm.vendor.id)
        : "",
    interest: crm?.interest ?? "",
    quoted_amount: crm?.quoted_amount != null ? String(crm.quoted_amount) : "",
    quoted_date: crm?.quoted_date ?? "",
    converted: Boolean(crm?.converted),
    notes: crm?.notes ?? "",
  };
}

export default function LeadPanel({ lead, onClose, onSaved }) {
  const vendors = useVendors();
  const [shown, setShown] = useState(false);
  const [crm, setCrm] = useState(lead?.crm ?? null);
  const [form, setForm] = useState(() => formFrom(lead?.crm));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  // Which lead is open (the panel only resets when this changes, not on every refresh)
  const leadId = lead
    ? `${lead.source}:${lead.crm?.lead_key ?? lead.title}`
    : null;

  function close() {
    setShown(false);
    setTimeout(onClose, 200);
  }

  // Slide in; reset when another lead is opened
  useEffect(() => {
    setCrm(lead?.crm ?? null);
    setForm(formFrom(lead?.crm));
    setError("");
    setSaved(false);
    const t = requestAnimationFrame(() => setShown(Boolean(lead)));
    return () => cancelAnimationFrame(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  // Escape closes; the page behind doesn't scroll
  useEffect(() => {
    if (!leadId) return;
    const onKey = (e) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  if (!lead) return null;

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  };
  const automatic =
    crm && crm.vendor_source !== "manual" ? crm.vendor : crm?.suggested_vendor;

  async function save(e) {
    e.preventDefault();
    if (!crm) return;
    setSaving(true);
    setError("");
    try {
      const digits = form.quoted_amount.replace(/\D/g, "");
      const next = await saveLeadCrm(
        lead.source,
        crm.lead_key,
        {
          vendor_id: form.vendor_id ? Number(form.vendor_id) : null,
          interest: form.interest || null,
          quoted_amount: digits ? Number(digits) : null,
          quoted_date: form.quoted_date || null,
          converted: form.converted,
          notes: form.notes,
        },
        lead.context ?? {},
      );
      setCrm(next);
      setSaved(true);
      onSaved?.(crm.lead_key, next);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function download() {
    setDownloading(true);
    try {
      const interest = interestInfo(crm?.interest);
      await downloadLeadPdf({
        title: lead.title,
        subtitle: lead.subtitle,
        source: lead.sourceLabel,
        fileName: `lead-${String(lead.title || "lead")
          .replace(/[^\w]+/g, "-")
          .toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`,
        sections: [
          {
            title: "Contact",
            rows: [
              ["Name", lead.title],
              ["Phone", lead.phone ? `+${lead.phone}` : null],
              ["Email", lead.email],
            ],
          },
          {
            title: "CRM",
            rows: [
              [
                "Assigned to",
                crm?.vendor
                  ? `${crm.vendor.name}${crm.vendor_source === "manual" ? "" : " (automatic)"}`
                  : "Unassigned",
              ],
              ["Interest", interest?.label ?? "Not set"],
              [
                "Quoted amount",
                crm?.quoted_amount != null
                  ? inr.format(crm.quoted_amount)
                  : null,
              ],
              ["Quoted date", crm?.quoted_date],
              ["Converted", crm?.converted ? "Yes" : "No"],
              ["Notes", crm?.notes],
            ],
          },
          ...lead.sections,
        ],
      });
    } catch (err) {
      setError(`Download failed: ${err.message}`);
    } finally {
      setDownloading(false);
    }
  }

  const btn =
    "flex flex-1 items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-medium transition";

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={`Lead: ${lead.title}`}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        onClick={close}
        className={`absolute inset-0 bg-gray-900/30 backdrop-blur-[2px] transition-opacity duration-200 ${shown ? "opacity-100" : "opacity-0"}`}
      />

      <aside
        className={`relative flex h-full w-full max-w-xl flex-col bg-linear-to-b from-white via-white to-brand-50 shadow-2xl transition-transform duration-300 ease-out ${
          shown ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <header className="relative overflow-hidden bg-linear-to-r from-brand-800 via-brand-700 to-brand-600 px-6 pb-5 pt-5 text-white">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl"
          />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-base font-semibold ring-1 ring-white/30">
                {initials(lead.title)}
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
                  {lead.sourceLabel}
                </p>
                <h2 className="truncate text-xl font-semibold">{lead.title}</h2>
                {lead.subtitle && (
                  <p className="truncate text-sm text-white/80">
                    {lead.subtitle}
                  </p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={download}
                disabled={downloading}
                className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-sm font-medium text-brand-800 shadow-sm transition hover:bg-brand-50 disabled:opacity-70"
              >
                {downloading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
                Download
              </button>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Status chips */}
          {crm && (
            <div className="relative mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-white/15 px-2.5 py-1 ring-1 ring-white/20">
                {crm.vendor ? `Assigned: ${crm.vendor.name}` : "Unassigned"}
              </span>
              {interestInfo(crm.interest) && (
                <span className="rounded-full bg-white/15 px-2.5 py-1 ring-1 ring-white/20">
                  {interestInfo(crm.interest).label}
                </span>
              )}
              {crm.quoted_amount != null && (
                <span className="rounded-full bg-white/15 px-2.5 py-1 ring-1 ring-white/20">
                  Quoted {inr.format(crm.quoted_amount)}
                </span>
              )}
              {crm.converted && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400 px-2.5 py-1 font-semibold text-emerald-950">
                  <BadgeCheck size={13} /> Converted
                </span>
              )}
            </div>
          )}
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          {/* Contact */}
          <div className="flex gap-2">
            {lead.phone ? (
              <a
                href={`tel:+${lead.phone}`}
                className={`${btn} bg-sky-50 text-sky-700 ring-1 ring-sky-100 hover:bg-sky-100`}
              >
                <Phone size={16} /> Call
              </a>
            ) : (
              <span
                className={`${btn} cursor-not-allowed bg-gray-50 text-gray-300`}
              >
                <Phone size={16} /> Call
              </span>
            )}
            {lead.email ? (
              <a
                href={`mailto:${lead.email}`}
                className={`${btn} bg-violet-50 text-violet-700 ring-1 ring-violet-100 hover:bg-violet-100`}
              >
                <Mail size={16} /> Email
              </a>
            ) : (
              <span
                className={`${btn} cursor-not-allowed bg-gray-50 text-gray-300`}
              >
                <Mail size={16} /> Email
              </span>
            )}
            {lead.phone ? (
              <a
                href={`https://wa.me/${lead.phone}`}
                target="_blank"
                rel="noreferrer"
                className={`${btn} bg-emerald-500 text-white shadow-md shadow-emerald-500/25 hover:bg-emerald-600`}
              >
                <MessageCircle size={16} /> WhatsApp
              </a>
            ) : (
              <span
                className={`${btn} cursor-not-allowed bg-gray-50 text-gray-300`}
              >
                <MessageCircle size={16} /> WhatsApp
              </span>
            )}
          </div>

          {/* CRM */}
          {crm && (
            <form
              onSubmit={save}
              className="rounded-3xl bg-white/80 p-5 ring-1 ring-gray-100 shadow-sm backdrop-blur"
            >
              <h3 className="text-sm font-semibold text-gray-900">
                Lead status
              </h3>

              <label className="mt-4 block">
                <span className="text-xs font-medium text-gray-600">
                  Assigned to
                </span>
                <select
                  value={form.vendor_id}
                  onChange={(e) => set("vendor_id", e.target.value)}
                  className={`mt-1.5 ${fieldCls}`}
                >
                  <option value="">
                    {automatic ? `Automatic · ${automatic.name}` : "Unassigned"}
                  </option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                      {v.coverage ? ` · ${v.coverage}` : ""}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-[11px] text-gray-500">
                  {lead.context?.sheet_vendor
                    ? `Sheet says ${lead.context.sheet_vendor}. `
                    : ""}
                  {crm.suggested_vendor
                    ? `Area rules suggest ${crm.suggested_vendor.name}.`
                    : "Location unknown, no automatic match."}
                </span>
              </label>

              <fieldset className="mt-4">
                <legend className="text-xs font-medium text-gray-600">
                  Interest
                </legend>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  {INTEREST_OPTIONS.map((o) => {
                    const active = form.interest === o.value;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => set("interest", active ? "" : o.value)}
                        className={`rounded-xl px-2 py-2.5 text-xs font-semibold ring-1 transition ${active ? `${o.style} ring-2` : "bg-white text-gray-600 ring-gray-200 hover:bg-gray-50"}`}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">
                    Quoted amount (₹)
                  </span>
                  <input
                    inputMode="numeric"
                    value={form.quoted_amount}
                    onChange={(e) =>
                      set(
                        "quoted_amount",
                        e.target.value.replace(/[^\d,]/g, ""),
                      )
                    }
                    placeholder="e.g. 45000"
                    className={`mt-1.5 ${fieldCls}`}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">
                    Quoted date
                  </span>
                  <input
                    type="date"
                    value={form.quoted_date}
                    onChange={(e) => set("quoted_date", e.target.value)}
                    className={`mt-1.5 ${fieldCls}`}
                  />
                </label>
              </div>

              <fieldset className="mt-4">
                <legend className="text-xs font-medium text-gray-600">
                  Converted
                </legend>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {[
                    {
                      value: false,
                      label: "No",
                      on: "bg-gray-900 text-white ring-gray-900",
                    },
                    {
                      value: true,
                      label: "Yes",
                      on: "bg-emerald-500 text-white ring-emerald-500",
                    },
                  ].map((o) => (
                    <button
                      key={o.label}
                      type="button"
                      aria-pressed={form.converted === o.value}
                      onClick={() => set("converted", o.value)}
                      className={`rounded-xl py-2.5 text-sm font-semibold ring-1 transition ${form.converted === o.value ? o.on : "bg-white text-gray-600 ring-gray-200 hover:bg-gray-50"}`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <label className="mt-4 block">
                <span className="text-xs font-medium text-gray-600">Notes</span>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="Calls, follow-ups, anything useful…"
                  className={`mt-1.5 resize-y ${fieldCls}`}
                />
              </label>

              {error && (
                <p
                  role="alert"
                  className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200"
                >
                  {error}
                </p>
              )}

              <div className="mt-4 flex items-center justify-end gap-3">
                {saved && (
                  <span className="text-sm text-emerald-600">Saved ✓</span>
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-full bg-linear-to-r from-brand-600 to-brand-800 px-6 py-2 text-sm font-semibold text-white shadow-md shadow-brand-700/25 transition hover:-translate-y-0.5 disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          )}

          {/* Extra block (e.g. planner events) */}
          {lead.extra}

          {/* Every field */}
          {lead.sections.map((section) => {
            const rows = section.rows.filter(
              ([, v]) =>
                v !== null && v !== undefined && String(v).trim() !== "",
            );
            if (!rows.length) return null;
            return (
              <section key={section.title}>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-brand-700">
                  {section.title}
                </h3>
                <dl className="mt-2 divide-y divide-gray-100 rounded-2xl bg-white/80 ring-1 ring-gray-100">
                  {rows.map(([label, value]) => (
                    <div
                      key={label}
                      className="grid grid-cols-[150px_1fr] gap-3 px-4 py-2.5 text-sm"
                    >
                      <dt className="text-gray-500">{label}</dt>
                      <dd className="whitespace-pre-line break-words text-gray-900">
                        {String(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
