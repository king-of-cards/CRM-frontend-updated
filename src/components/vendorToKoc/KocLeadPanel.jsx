import DateInput from "../shared/DateInput.jsx";
import { useEffect, useState } from "react";
import { MessageCircle, Phone, X } from "lucide-react";
import { updateKocLead } from "../../api/vendorToKoc.js";
import { downloadLeadPdf } from "../leads/leadPdf.js";
import LeadPdfButton from "../leads/LeadPdfButton.jsx";
import LeadBackButton from "../layout/LeadBackButton.jsx";
import HotLeadStar from "../leads/HotLeadStar.jsx";
import LeadActivity from "../leads/LeadActivity.jsx";
import { useAuth } from "../../auth/useAuth.js";
import {
  dateTimeText,
  dayText,
  kocErrors,
  PENDING,
  phoneText,
  sourceLabel,
  statusLabel,
  STATUSES,
} from "./kocUtils.js";

// Details of one Vendors → KOC lead, in the style of the KOC → Vendors lead panel.
// Everyone: vendor, date, name, phone, city, source, received, added by, KOC's update (Update,
// Additional comments, Follow-up date, "Last updated: <name> · <when>"), and a PDF.
// Admins edit the update (only changed fields are sent); vendor logins see it read-only.
//   people(id): a login's name for "Added by" (never an id). "Last updated by" is the API's
//   status_updated_by_name, never the user id.

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

const formOf = (lead) => ({
  update_status: lead?.update_status ?? PENDING,
  additional_comments: lead?.additional_comments ?? "",
  follow_up_date: lead?.follow_up_date ?? "",
  quoted_amount: lead?.quoted_amount != null ? String(lead.quoted_amount) : "",
  conversion_amount: lead?.conversion_amount != null ? String(lead.conversion_amount) : "",
});
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const amountOf = (text) => {
  const digits = String(text ?? "").replace(/\D/g, "");
  return digits ? Number(digits) : null;
};

// isAdmin: the admin view (admins and view-only logins); only logins that can edit get the form
export default function KocLeadPanel({ lead, isAdmin, people, onClose, onSaved, isHot, hotPending, onToggleHot, showHot = false }) {
  const { canEdit } = useAuth();
  const editable = isAdmin && canEdit;
  const [shown, setShown] = useState(false);
  const [form, setForm] = useState(() => formOf(lead));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [activityRefreshKey, setActivityRefreshKey] = useState(0);
  const leadId = lead?.id ?? null;

  function close() {
    setShown(false);
    setTimeout(onClose, 200);
  }

  // Slide in; reset when another lead is opened
  useEffect(() => {
    setForm(formOf(lead));
    setError("");
    setSaved(false);
    const t = requestAnimationFrame(() => setShown(Boolean(lead)));
    return () => cancelAnimationFrame(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  // Escape closes; the page behind doesn't scroll
  useEffect(() => {
    if (leadId == null) return undefined;
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

  const title = lead.name || phoneText(lead.phone);
  // Header / PDF subtitle: vendor and city for admins; just the city for vendor logins
  const subtitle = [isAdmin ? lead.vendor_name : null, lead.city].filter(Boolean).join(" · ");
  const digits = lead.phone ? `91${lead.phone}` : null;
  const details = [
    // Vendor: admins only (vendor logins never see it, in the panel or the PDF)
    ...(isAdmin ? [["Vendor", lead.vendor_name]] : []),
    ["Date", lead.lead_date ? dayText(lead.lead_date) : null],
    ["Name", lead.name],
    ["Phone", lead.phone ? phoneText(lead.phone) : null],
    ["City", lead.city],
    ["Source", lead.source ? sourceLabel(lead.source) : null],
    ["Received", lead.created_at ? dateTimeText(lead.created_at) : null],
    ["Added by", people(lead.created_by, lead)],
  ];
  const followRows = [
        ["Update", statusLabel(lead.update_status)],
        ["Additional comments", lead.additional_comments],
        ["Follow-up date", lead.follow_up_date ? dayText(lead.follow_up_date) : null],
        ["Quoted amount", lead.quoted_amount != null ? inr.format(lead.quoted_amount) : null],
        ["Conversion amount", lead.conversion_amount != null ? inr.format(lead.conversion_amount) : null],
        [
          "Last updated",
          lead.status_updated_at
            ? `${lead.status_updated_by_name || "—"} · ${dateTimeText(lead.status_updated_at)}`
            : null,
        ],
      ];

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  };

  async function save(e) {
    e.preventDefault();
    const before = formOf(lead);
    const changes = {};
    if (form.update_status !== before.update_status)
      changes.update_status = form.update_status === PENDING ? null : form.update_status;
    if (form.additional_comments !== before.additional_comments)
      changes.additional_comments = form.additional_comments.trim() || null;
    if (form.follow_up_date !== before.follow_up_date) changes.follow_up_date = form.follow_up_date || null;
    if (form.quoted_amount !== before.quoted_amount) changes.quoted_amount = amountOf(form.quoted_amount);
    if (form.conversion_amount !== before.conversion_amount) changes.conversion_amount = amountOf(form.conversion_amount);
    if (!Object.keys(changes).length) return setError("Nothing to save: no changes.");
    setSaving(true);
    setError("");
    try {
      const next = await updateKocLead(lead.id, changes);
      setSaved(true);
      setActivityRefreshKey((key) => key + 1);
      onSaved(next);
    } catch (err) {
      const { fields, message } = kocErrors(err);
      setError(message || Object.values(fields).join(" "));
    } finally {
      setSaving(false);
    }
  }

  async function download() {
    setDownloading(true);
    try {
      await downloadLeadPdf({
        title,
        subtitle,
        source: "Vendors → KOC lead",
        fileName: `vendor-lead-${String(title || "lead")
          .replace(/[^\w]+/g, "-")
          .toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`,
        sections: [
          { title: "Lead details", rows: details },
          { title: "KOC follow-up", rows: followRows },
        ],
      });
    } catch (err) {
      setError(`Download failed: ${err.message}`);
    } finally {
      setDownloading(false);
    }
  }

  const btn = "flex flex-1 items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-medium transition";
  // Admins edit Update / comments / follow-up / amounts in the form above, so only "Last updated" is listed
  // for them; vendor and view-only logins see every follow-up field read-only
  const sections = [
    { title: "Lead details", rows: details },
    editable
      ? { title: "Last update", rows: followRows.filter(([label]) => label === "Last updated") }
      : { title: "KOC follow-up", rows: followRows },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`Lead: ${title}`}>
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
        <header className="relative overflow-hidden bg-linear-to-r from-brand-800 via-brand-700 to-brand-600 px-6 pb-5 pt-5 text-white">
          <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-base font-semibold ring-1 ring-white/30">
                {initials(lead.name || (isAdmin ? lead.vendor_name : lead.city))}
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">Vendors → KOC lead</p>
                <h2 className="truncate text-xl font-semibold">{title}</h2>
                <p className="truncate text-sm text-white/80">{subtitle}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {(onToggleHot || showHot) && <HotLeadStar isHot={isHot} pending={hotPending} onToggle={onToggleHot} />}
              <LeadBackButton inverted />
              <LeadPdfButton onClick={download} loading={downloading} />
              <button type="button" onClick={close} aria-label="Close" className="rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white">
                <X size={18} />
              </button>
            </div>
          </div>
          {(
            <div className="relative mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-white/15 px-2.5 py-1 ring-1 ring-white/20">{statusLabel(lead.update_status)}</span>
              {lead.follow_up_date && (
                <span className="rounded-full bg-white/15 px-2.5 py-1 ring-1 ring-white/20">Follow-up {dayText(lead.follow_up_date)}</span>
              )}
            </div>
          )}
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          <div className="flex gap-2">
            {digits ? (
              <a href={`tel:+${digits}`} className={`${btn} bg-sky-50 text-sky-700 ring-1 ring-sky-100 hover:bg-sky-100`}>
                <Phone size={16} /> Call
              </a>
            ) : (
              <span className={`${btn} cursor-not-allowed bg-gray-50 text-gray-300`}>
                <Phone size={16} /> Call
              </span>
            )}
            {digits ? (
              <a
                href={`https://wa.me/${digits}`}
                target="_blank"
                rel="noreferrer"
                className={`${btn} bg-emerald-500 text-white shadow-md shadow-emerald-500/25 hover:bg-emerald-600`}
              >
                <MessageCircle size={16} /> WhatsApp
              </a>
            ) : (
              <span className={`${btn} cursor-not-allowed bg-gray-50 text-gray-300`}>
                <MessageCircle size={16} /> WhatsApp
              </span>
            )}
          </div>

          {/* KOC follow-up: admins only (view-only logins read it in the list below) */}
          {editable && (
            <form onSubmit={save} className="rounded-3xl bg-white/80 p-5 ring-1 ring-gray-100 shadow-sm backdrop-blur">
              <h3 className="text-sm font-semibold text-gray-900">KOC follow-up</h3>
              <label className="mt-4 block">
                <span className="text-xs font-medium text-gray-600">Update</span>
                <select value={form.update_status} onChange={(e) => set("update_status", e.target.value)} className={`mt-1.5 ${fieldCls}`}>
                  <option value={PENDING}>Pending</option>
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-4 block">
                <span className="text-xs font-medium text-gray-600">Additional comments</span>
                <textarea
                  rows={3}
                  maxLength={5000}
                  value={form.additional_comments}
                  onChange={(e) => set("additional_comments", e.target.value)}
                  placeholder="Calls, follow-ups, anything useful…"
                  className={`mt-1.5 resize-y ${fieldCls}`}
                />
              </label>
              <label className="mt-4 block">
                <span className="text-xs font-medium text-gray-600">Follow-up date</span>
                <DateInput type="date" value={form.follow_up_date} onChange={(e) => set("follow_up_date", e.target.value)} className={`mt-1.5 ${fieldCls}`} />
              </label>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">Quoted amount (₹)</span>
                  <input
                    inputMode="numeric"
                    value={form.quoted_amount}
                    onChange={(e) => set("quoted_amount", e.target.value.replace(/[^\d,]/g, ""))}
                    placeholder="e.g. 45000"
                    className={`mt-1.5 ${fieldCls}`}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">Conversion amount (₹)</span>
                  <input
                    inputMode="numeric"
                    value={form.conversion_amount}
                    onChange={(e) => set("conversion_amount", e.target.value.replace(/[^\d,]/g, ""))}
                    placeholder="e.g. 40000"
                    className={`mt-1.5 ${fieldCls}`}
                  />
                </label>
              </div>
              {error && (
                <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
                  {error}
                </p>
              )}
              <div className="mt-4 flex items-center justify-end gap-3">
                {saved && <span className="text-sm text-emerald-600">Saved ✓</span>}
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
          {!editable && error && (
            <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
              {error}
            </p>
          )}

          {sections.map((section) => {
            const rows = section.rows.filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "");
            if (!rows.length) return null;
            return (
              <section key={section.title}>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-brand-700">{section.title}</h3>
                <dl className="mt-2 divide-y divide-gray-100 rounded-2xl bg-white/80 ring-1 ring-gray-100">
                  {rows.map(([label, value]) => (
                    <div key={label} className="grid grid-cols-[150px_1fr] gap-3 px-4 py-2.5 text-sm">
                      <dt className="text-gray-500">{label}</dt>
                      <dd className="whitespace-pre-line break-words text-gray-900">{String(value)}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            );
          })}
          <LeadActivity source="vendor_to_koc" leadKey={lead.id} refreshKey={activityRefreshKey} />
        </div>
      </aside>
    </div>
  );
}
