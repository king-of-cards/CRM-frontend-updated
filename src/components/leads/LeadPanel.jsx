import DateInput from "../shared/DateInput.jsx";
import VendorCopyCard from "./VendorCopyCard.jsx";
import { isMultiVendor, vendorChips, vendorCopies } from "./leadVendors.js";
import ContactActions from "../shared/ContactActions.jsx";
import { displayPhone } from "../shared/contact.js";
import { useEffect, useState } from "react";
import {
  BadgeCheck,
  Download,
  Loader2,
  X,
} from "lucide-react";
import {
  PENDING_UPDATE,
  UPDATE_OPTIONS,
  updateInfo,
  saveLeadCrm,
} from "../../api/leadCrm.js";
import { useVendors } from "./InlineCrm.jsx";
import { downloadLeadPdf } from "./leadPdf.js";
import { useAuth } from "../../auth/useAuth.js";
import { assignableVendors, assignedText, assignmentChange, assignmentOf, automaticLabel, AUTOMATIC_CHOICE, panelChanges, UNASSIGNED_CHOICE } from "./crmAccess.js";
import LeadBackButton from "../layout/LeadBackButton.jsx";
import HotLeadStar from "./HotLeadStar.jsx";
import LeadActivity from "./LeadActivity.jsx";
import { vendorNameLookup } from "./activityUtils.js";
import { ReadOnlyFields } from "../shared/ViewOnly.jsx";
import AlsoInBadges from "./AlsoInBadges.jsx";
import { alsoInPlaces, alsoInLine } from "./alsoIn.js";
import { formatDateTime, formatDay, personName } from "../shared/dates.js";
import PayoutField from "./PayoutField.jsx";
import { payoutText, payoutValues, percentError } from "./payout.js";

// Who last saved the CRM details (docs section 5: crm.updated_by_name, "Deleted user" from the
// API) and when: "Asha · 19 Nov 2026, 10:30 am". null when nobody saved them yet.
function lastUpdated(crm) {
  const name = personName(crm?.updated_by_name, "");
  if (!name) return null;
  return crm?.updated_at ? `${name} · ${formatDateTime(crm.updated_at)}` : name;
}

// Who edits what: Assigned to = admins (vendors see it as text); Update, Quoted amount/date,
// Conversion amount and Notes = admins and the assigned vendor. Only changed, allowed fields are sent.
// A lead with several vendors (docs section 19), for admins and viewers: Assigned to stays here
// (it changes the lead, no ?vendor=), and each vendor's copy is a card with its own Save
// (VendorCopyCard, ?vendor=<id>). Vendor logins only ever get their own copy: the form below.

// "Phodeo · auto, Kraftyz · auto"
const chipsText = (crm) => vendorChips(crm).map((c) => c.text).join(", ");

function VendorChips({ crm }) {
  return (
    <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Assigned to">
      {vendorChips(crm).map((c) => (
        <li key={c.key} className={`inline-flex max-w-full break-words rounded-full px-3 py-1 text-xs font-medium ring-1 ${c.tone === "manual" ? "bg-brand-700 text-white ring-brand-700" : c.tone === "auto" ? "bg-brand-50 text-brand-800 ring-brand-200" : "bg-amber-50 text-amber-700 ring-amber-200"}`}>
          {c.text}
        </li>
      ))}
    </ul>
  );
}

// Side panel for one lead: header in the app's green, a soft white gradient body,
// contact buttons, the editable CRM details, every field, and a PDF download.
//
// lead = {
//   source, sourceLabel, row, crm, context,
//   title, subtitle, phone (digits with country code), email,
//   sections: [{ title, rows: [[label, value], ...] }],   // shown and put in the PDF
//   extra?: node                                           // e.g. the planner's events
//   alsoIn?: [{ source, count, vendors? }]                 // the API's also_in (shown and in the PDF)
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
    // Automatic, Unassigned or a vendor id (sent as assigned_to or vendor_id, crmAccess.js)
    assignment: assignmentOf(crm),
    update_status: crm?.update_status ?? "",
    quoted_amount: crm?.quoted_amount != null ? String(crm.quoted_amount) : "",
    quoted_date: crm?.quoted_date ?? "",
    conversion_amount: crm?.conversion_amount != null ? String(crm.conversion_amount) : "",
    payout_percent: crm?.payout_percent != null ? String(crm.payout_percent) : "",
    notes: crm?.notes ?? "",
  };
}

export default function LeadPanel({ lead, onClose, onSaved }) {
  const { isAdmin, canEdit, seesAll } = useAuth();
  const vendors = useVendors();
  const [shown, setShown] = useState(false);
  const [crm, setCrm] = useState(lead?.crm ?? null);
  const [form, setForm] = useState(() => formFrom(lead?.crm));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [activityRefreshKey, setActivityRefreshKey] = useState(0);

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
  // Several vendors (admins and viewers): one card per vendor's copy
  const multi = Boolean(seesAll) && isMultiVendor(crm);

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  };

  async function save(e) {
    e.preventDefault();
    if (!crm) return;
    const amount = (text) => {
      const digits = text.replace(/\D/g, "");
      return digits ? Number(digits) : null;
    };
    const toValues = (f) => ({
      update_status: f.update_status || null,
      quoted_amount: amount(f.quoted_amount),
      quoted_date: f.quoted_date || null,
      conversion_amount: amount(f.conversion_amount),
      // Payout: % of the conversion amount, and the rupees that works out to (admins only)
      ...payoutValues(f.conversion_amount, f.payout_percent),
      notes: f.notes,
    });
    if (isAdmin && percentError(form.payout_percent)) {
      setError(percentError(form.payout_percent));
      return;
    }
    // Several vendors: this form only changes who has the lead; the copies save in their cards
    const changes = multi ? {} : panelChanges(isAdmin, toValues(formFrom(crm)), toValues(form));
    if (isAdmin && form.assignment !== formFrom(crm).assignment) Object.assign(changes, assignmentChange(form.assignment));
    if (!Object.keys(changes).length) {
      setError("Nothing to save: no changes.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const next = await saveLeadCrm(
        lead.source,
        crm.lead_key,
        changes,
        lead.context ?? {},
      );
      setCrm(next);
      setSaved(true);
      setActivityRefreshKey((key) => key + 1);
      onSaved?.(crm.lead_key, next);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // A card's star changed: that copy, and the lead's overall star (hot on any copy)
  function copyHotChanged(vendorId, isHot) {
    const vendors = (crm?.vendors ?? []).map((c) => (String(c.vendor?.id) === String(vendorId) ? { ...c, is_hot: isHot } : c));
    const next = { ...crm, vendors, is_hot: vendors.some((c) => c.is_hot) };
    setCrm(next);
    setActivityRefreshKey((key) => key + 1);
    onSaved?.(crm.lead_key, next);
  }

  function copySaved(next) {
    setCrm(next);
    setActivityRefreshKey((key) => key + 1);
    onSaved?.(next?.lead_key ?? crm.lead_key, next);
  }

  async function download() {
    setDownloading(true);
    try {
      const update = updateInfo(crm?.update_status);
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
              ["Phone", displayPhone(lead.phone) || null],
              ["Email", lead.email],
            ],
          },
          {
            title: "CRM",
            rows: [
              [
                "Assigned to",
                multi ? chipsText(crm) : assignedText(crm),
              ],
              ["Update", update.label],
              [
                "Quoted amount",
                crm?.quoted_amount != null
                  ? inr.format(crm.quoted_amount)
                  : null,
              ],
              ["Quoted date", formatDay(crm?.quoted_date)],
              [
                "Conversion amount",
                crm?.conversion_amount != null
                  ? inr.format(crm.conversion_amount)
                  : null,
              ],
              ["Notes", crm?.notes],
              ["Last updated by", lastUpdated(crm)],
            ],
          },
          { title: "Also in", rows: alsoInPlaces(lead.alsoIn).map((p) => [p.label, alsoInLine(p).slice(p.label.length + 2)]) },
          ...lead.sections,
        ],
      });
    } catch (err) {
      setError(`Download failed: ${err.message}`);
    } finally {
      setDownloading(false);
    }
  }

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
        <header className="relative overflow-hidden bg-linear-to-r from-brand-800 via-brand-700 to-brand-600 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] text-white sm:px-6 sm:pb-5 sm:pt-5">
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
              {(lead.onToggleHot || lead.showHot) && (multi
                ? <HotLeadStar isHot={Boolean(crm?.is_hot)} note="Per vendor: set it in each vendor's card" />
                : <HotLeadStar isHot={lead.isHot} pending={lead.hotPending} onToggle={lead.onToggleHot} />)}
              <LeadBackButton inverted />
              <button
                type="button"
                onClick={download}
                disabled={downloading}
                aria-label="Download PDF"
                className="flex h-10 w-10 items-center justify-center gap-1.5 rounded-full bg-white text-sm font-medium text-brand-800 shadow-sm transition hover:bg-brand-50 disabled:opacity-70 sm:h-auto sm:w-auto sm:px-3.5 sm:py-1.5"
              >
                {downloading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
                <span className="hidden sm:inline">Download</span>
              </button>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="flex h-11 w-11 items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white"
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
              <span className="rounded-full bg-white/15 px-2.5 py-1 ring-1 ring-white/20">
                {updateInfo(crm.update_status).label}
              </span>
              {crm.quoted_amount != null && (
                <span className="rounded-full bg-white/15 px-2.5 py-1 ring-1 ring-white/20">
                  Quoted {inr.format(crm.quoted_amount)}
                </span>
              )}
              {crm.conversion_amount != null && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400 px-2.5 py-1 font-semibold text-emerald-950">
                  <BadgeCheck size={13} /> Converted {inr.format(crm.conversion_amount)}
                </span>
              )}
              {crm.payout_amount != null && (
                <span className="rounded-full bg-amber-300 px-2.5 py-1 font-semibold text-amber-950">
                  Payout {inr.format(crm.payout_amount)}
                </span>
              )}
            </div>
          )}
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 sm:px-6 sm:py-6">
          {/* Contact */}
          <ContactActions variant="panel" phone={lead.phone} email={lead.email} name={lead.title} />

          {/* CRM: view-only logins read it as plain text (no inputs, no Save) */}
          {crm && !canEdit && multi && <ReadOnlyFields title="Lead status" items={[["Assigned to", chipsText(crm)]]} />}
          {crm && !canEdit && !multi && (
            <ReadOnlyFields
              title="Lead status"
              items={[
                ["Assigned to", assignedText(crm)],
                ["Update", updateInfo(crm.update_status).label],
                ["Quoted amount", crm.quoted_amount != null ? inr.format(crm.quoted_amount) : null],
                ["Quoted date", formatDay(crm.quoted_date)],
                ["Conversion amount", crm.conversion_amount != null ? inr.format(crm.conversion_amount) : null],
                ["Payout", payoutText(crm.payout_amount, crm.payout_percent, inr)],
                ["Notes", crm.notes],
                ["Last updated by", lastUpdated(crm)],
              ]}
            />
          )}
          {crm && canEdit && (
            <form
              onSubmit={save}
              className="rounded-3xl bg-white/80 p-5 ring-1 ring-gray-100 shadow-sm backdrop-blur"
            >
              <h3 className="text-sm font-semibold text-gray-900">
                Lead status
              </h3>

              {!isAdmin ? (
                <div className="mt-4">
                  <span className="text-xs font-medium text-gray-600">
                    Assigned to
                  </span>
                  <p className="mt-1.5 text-sm font-medium text-gray-900">
                    {assignedText(crm)}
                  </p>
                </div>
              ) : (
              <label className="mt-4 block">
                <span className="text-xs font-medium text-gray-600">
                  Assigned to
                </span>
                <select
                  value={form.assignment}
                  onChange={(e) => set("assignment", e.target.value)}
                  className={`mt-1.5 ${fieldCls}`}
                >
                  <option value={AUTOMATIC_CHOICE}>{automaticLabel(crm)}</option>
                  <option value={UNASSIGNED_CHOICE}>Unassigned</option>
                  {/* Active vendors only; the lead's own inactive vendor stays visible but can't be picked */}
                  {assignableVendors(vendors, crm?.vendor_source === "manual" ? crm.vendor : null).map((v) => (
                    <option key={v.id} value={v.id} disabled={v.inactive}>
                      {v.inactive ? `${v.name} (inactive)` : v.name}
                      {v.coverage ? ` · ${v.coverage}` : ""}
                    </option>
                  ))}
                </select>
                {multi && <VendorChips crm={crm} />}
                <span className="mt-1 block text-[11px] text-gray-500">
                  {lead.context?.sheet_vendor
                    ? `Sheet says ${lead.context.sheet_vendor}. `
                    : ""}
                  {crm.vendor_source === "source_default" && crm.vendor
                    ? `Gift leads go to ${crm.vendor.name} automatically.` // source_default: docs section 17
                    : crm.suggested_vendor
                      ? `Area rules suggest ${crm.suggested_vendor.name}.`
                      : "Location unknown, no automatic match."}
                </span>
              </label>
              )}

              {/* Update and the amounts: admins and the assigned vendor (several vendors: in the cards) */}
              {!multi && (<>
              <label className="mt-4 block">
                <span className="text-xs font-medium text-gray-600">Update</span>
                <select
                  value={form.update_status}
                  onChange={(e) => set("update_status", e.target.value)}
                  className={`mt-1.5 ${fieldCls}`}
                >
                  <option value="">{PENDING_UPDATE.label}</option>
                  {UPDATE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>

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
                  <DateInput
                    type="date"
                    value={form.quoted_date}
                    onChange={(e) => set("quoted_date", e.target.value)}
                    className={`mt-1.5 ${fieldCls}`}
                  />
                </label>
              </div>

              <label className="mt-4 block">
                <span className="text-xs font-medium text-gray-600">
                  Conversion amount (₹)
                </span>
                <input
                  inputMode="numeric"
                  value={form.conversion_amount}
                  onChange={(e) =>
                    set(
                      "conversion_amount",
                      e.target.value.replace(/[^\d,]/g, ""),
                    )
                  }
                  placeholder="e.g. 40000"
                  className={`mt-1.5 ${fieldCls}`}
                />
              </label>

              {/* Payout (commission): admins set the %, vendors see the result */}
              <PayoutField
                className="mt-4"
                conversion={form.conversion_amount}
                value={form.payout_percent}
                onChange={(v) => set("payout_percent", v)}
                fieldCls={fieldCls}
                readOnly={!isAdmin}
              />

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
              </>)}

              {error && (
                <p
                  role="alert"
                  className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200"
                >
                  {error}
                </p>
              )}

              {/* Phones: the Save button stays at the bottom of the screen while the form scrolls */}
              <div className="sticky bottom-0 z-10 -mx-5 -mb-5 mt-4 flex items-center justify-end gap-3 rounded-b-3xl bg-white/95 px-5 py-3 backdrop-blur sm:static sm:m-0 sm:mt-4 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
                {saved && (
                  <span className="shrink-0 text-sm text-emerald-600">Saved ✓</span>
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-11 flex-1 rounded-full bg-linear-to-r from-brand-600 to-brand-800 px-6 py-2 text-sm font-semibold sm:min-h-0 sm:flex-none text-white shadow-md shadow-brand-700/25 transition hover:-translate-y-0.5 disabled:opacity-60"
                >
                  {saving ? "Saving…" : multi ? "Save assignment" : "Save changes"}
                </button>
              </div>
              {!multi && lastUpdated(crm) && (
                <p className="mt-3 text-right text-xs text-gray-500">Last updated by {lastUpdated(crm)}</p>
              )}
            </form>
          )}

          {/* Several vendors: one card per vendor's copy, each with its own Save (admins) */}
          {crm && multi && (
            <section aria-label="Vendors' copies" className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Vendors</h3>
                <p className="mt-0.5 text-xs text-gray-500">Each vendor works its own copy; Save changes only that vendor's.</p>
              </div>
              {vendorCopies(crm).map((c) => (
                <VendorCopyCard
                  key={`${crm.lead_key}:${c.vendor.id}`}
                  copy={c}
                  source={lead.source}
                  leadKey={crm.lead_key}
                  context={lead.context ?? {}}
                  isAdmin={isAdmin}
                  canEdit={Boolean(isAdmin && canEdit)}
                  onSaved={copySaved}
                  onHotChanged={copyHotChanged}
                />
              ))}
            </section>
          )}

          {/* Other places with the same phone (the API's also_in) */}
          {alsoInPlaces(lead.alsoIn).length > 0 && (
            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-brand-700">Also in</h3>
              <div className="mt-2 rounded-2xl bg-white/80 px-4 py-3 ring-1 ring-gray-100">
                <AlsoInBadges alsoIn={lead.alsoIn} variant="panel" />
              </div>
            </section>
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
                      className="grid grid-cols-[120px_1fr] gap-3 px-4 py-2.5 text-sm sm:grid-cols-[150px_1fr]"
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
          <LeadActivity
            source={lead.source}
            leadKey={crm?.lead_key}
            refreshKey={activityRefreshKey}
            vendorName={vendorNameLookup(vendors, crm?.vendor, crm?.suggested_vendor)}
          />
        </div>
      </aside>
    </div>
  );
}
