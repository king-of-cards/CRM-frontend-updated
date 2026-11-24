import DateInput from "../shared/DateInput.jsx";
import ContactActions from "../shared/ContactActions.jsx";
import { useEffect, useState } from "react";
import { saveKocToDhruvaCrm } from "../../api/kocToDhruva.js";
import { downloadLeadPdf } from "../leads/leadPdf.js";
import LeadPdfButton from "../leads/LeadPdfButton.jsx";
import HotLeadStar from "../leads/HotLeadStar.jsx";
import LeadActivity from "../leads/LeadActivity.jsx";
import AlsoInBadges from "../leads/AlsoInBadges.jsx";
import { alsoInLine, alsoInPlaces } from "../leads/alsoIn.js";
import Drawer, { Alert, fieldCls, primaryBtn, secondaryBtn } from "../crmLeads/Drawer.jsx";
import { useAuth } from "../../auth/useAuth.js";
import { ViewOnlyBadge } from "../shared/ViewOnly.jsx";
import { dateTimeText, dayText, dhruvaErrors, phoneText, rupeesText, statusLabel, STATUSES, PENDING } from "../../pages/dhruvaUtils.js";
import { budgetText, crmChanges, crmFormOf as formOf, quantityText } from "../../pages/kocToDhruvaUtils.js";
import { branchText } from "../leads/stores.js";

// One KOC → Dhruva lead (docs section 18). Admins and Dhruva logins edit this section's CRM
// details (Update, comments, quoted amount / date, conversion amount, follow-up date); view-only
// logins read them. The Spin record of the same lead is never changed here.
// lead: the list item plus { display: { name, phone, email, branch ({ name, code, city } | null), city } }.

export default function KocToDhruvaLeadPanel({ lead, onClose, onSaved, isHot = false, hotPending = false, onToggleHot = null, showHot = false }) {
  const { canEdit } = useAuth();
  const crm = lead?.crm ?? {};
  const [form, setForm] = useState(() => formOf(crm));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [activityKey, setActivityKey] = useState(0);

  useEffect(() => {
    setForm(formOf(lead?.crm));
    setError("");
    setSaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.lead_key]);

  if (!lead) return null;
  const d = lead.display ?? {};
  const set = (key, value) => { setSaved(false); setForm((f) => ({ ...f, [key]: value })); };

  async function save(e) {
    e?.preventDefault();
    const changes = crmChanges(form, crm);
    if (!Object.keys(changes).length) { setSaved(true); return; }
    setBusy(true);
    setError("");
    try {
      const res = await saveKocToDhruvaCrm(lead.lead_key, changes);
      onSaved(lead.lead_key, res?.crm ?? res);
      setSaved(true);
      setActivityKey((k) => k + 1);
    } catch (err) {
      const parsed = dhruvaErrors(err);
      setError(parsed.message || Object.values(parsed.fields).join(" ") || err.message);
    } finally {
      setBusy(false);
    }
  }

  const details = [
    ["Name", d.name || "—"],
    ["Phone", phoneText(d.phone)],
    ["Email", d.email || "—"],
    ["Occasion", lead.occasion || "—"],
    ["Event date", dayText(lead.event_date)],
    ["Branch", branchText(d.branch)],
    ["Estimated budget per card", budgetText(lead.estimated_budget_per_card)],
    ["Quantity required", quantityText(lead.quantity_required)],
    ["Received", dateTimeText(lead.received)],
  ];

  async function pdf() {
    setDownloading(true);
    try {
      const title = d.name || phoneText(d.phone);
      await downloadLeadPdf({
        title,
        subtitle: lead.occasion || "",
        source: "KOC → Dhruva lead",
        fileName: `koc-to-dhruva-lead-${String(title || "lead").replace(/[^\w]+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`,
        sections: [
          { title: "Lead details", rows: details },
          {
            title: "Update",
            rows: [
              ["Update", statusLabel(crm.update_status)],
              ["Additional comments", crm.notes || "—"],
              ["Quoted amount", rupeesText(crm.quoted_amount)],
              ["Quoted date", dayText(crm.quoted_date)],
              ["Conversion amount", rupeesText(crm.conversion_amount)],
              ["Follow-up date", dayText(crm.follow_up_date)],
              ["Last updated by", crm.updated_by_name || "—"],
            ],
          },
          { title: "Also in", rows: alsoInPlaces(lead.also_in).map((p) => [p.label, alsoInLine(p).slice(p.label.length + 2)]) },
        ],
      });
    } catch (err) {
      setError(`Download failed: ${err.message}`);
    } finally {
      setDownloading(false);
    }
  }

  const label = (text, control) => <label className="block"><span className="mb-1 block text-xs font-medium text-gray-600">{text}</span>{control}</label>;
  return (
    <Drawer
      kicker="KOC → Dhruva"
      title={d.name || "Lead details"}
      onClose={onClose}
      wide
      headerActions={<>{!canEdit && <ViewOnlyBadge inverted />}{(onToggleHot || showHot) && <HotLeadStar isHot={isHot} pending={hotPending} onToggle={onToggleHot} />}<LeadPdfButton onClick={pdf} loading={downloading} /></>}
      footer={<>
        <button type="button" onClick={onClose} className={secondaryBtn}>Close</button>
        {canEdit && <button type="submit" form="koc-to-dhruva-crm" disabled={busy} className={primaryBtn}>{busy ? "Saving…" : "Save changes"}</button>}
      </>}
    >
      <div className="space-y-5">
        {error && <Alert>{error}</Alert>}
        {saved && <Alert kind="success">Saved.</Alert>}
        <ContactActions variant="panel" phone={d.phone} email={d.email} name={d.name} />
        <dl className="grid gap-4 sm:grid-cols-3" aria-label="Lead details">
          {details.map(([k, v]) => <div key={k}><dt className="text-xs font-medium text-gray-500">{k}</dt><dd className="mt-1 break-words text-sm text-gray-900">{v}</dd></div>)}
        </dl>
        {alsoInPlaces(lead.also_in).length > 0 && (
          <section className="rounded-2xl bg-white p-4 ring-1 ring-gray-100">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-700">Also in</h3>
            <AlsoInBadges alsoIn={lead.also_in} variant="panel" />
          </section>
        )}
        {canEdit ? (
          <form id="koc-to-dhruva-crm" onSubmit={save} className="space-y-4 rounded-2xl bg-gray-50 p-4 ring-1 ring-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Update details</h3>
            {label("Update", <select value={form.update_status} onChange={(e) => set("update_status", e.target.value)} className={fieldCls}><option value={PENDING}>Pending</option>{STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>)}
            {label("Additional comments", <textarea rows={3} maxLength={5000} value={form.notes} onChange={(e) => set("notes", e.target.value)} className={fieldCls} />)}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {label("Quoted amount", <input inputMode="numeric" value={form.quoted_amount} onChange={(e) => set("quoted_amount", e.target.value.replace(/[^\d,]/g, ""))} className={fieldCls} />)}
              {label("Quoted date", <DateInput type="date" value={form.quoted_date} onChange={(e) => set("quoted_date", e.target.value)} className={fieldCls} />)}
              {label("Conversion amount", <input inputMode="numeric" value={form.conversion_amount} onChange={(e) => set("conversion_amount", e.target.value.replace(/[^\d,]/g, ""))} className={fieldCls} />)}
              {label("Follow-up date", <DateInput type="date" value={form.follow_up_date} onChange={(e) => set("follow_up_date", e.target.value)} className={fieldCls} />)}
            </div>
          </form>
        ) : (
          <section className="space-y-3 rounded-2xl bg-gray-50 p-4 ring-1 ring-gray-100" aria-label="Update details, read only">
            <h3 className="text-sm font-semibold text-gray-900">Update details</h3>
            <dl className="grid gap-3 sm:grid-cols-3">
              {[
                ["Update", statusLabel(crm.update_status)],
                ["Quoted amount", rupeesText(crm.quoted_amount)],
                ["Quoted date", dayText(crm.quoted_date)],
                ["Conversion amount", rupeesText(crm.conversion_amount)],
                ["Follow-up date", dayText(crm.follow_up_date)],
              ].map(([k, v]) => <div key={k}><dt className="text-xs font-medium text-gray-500">{k}</dt><dd className="mt-1 text-sm text-gray-900">{v}</dd></div>)}
              <div className="sm:col-span-3"><dt className="text-xs font-medium text-gray-500">Additional comments</dt><dd className="mt-1 whitespace-pre-wrap text-sm text-gray-900">{crm.notes || "—"}</dd></div>
            </dl>
          </section>
        )}
        {/* Who last saved the update details (the API's name; "Deleted user" for a removed login) */}
        {crm.updated_by_name && (
          <p className="text-xs text-gray-500">
            Last updated by {crm.updated_by_name}
            {crm.updated_at ? ` · ${dateTimeText(crm.updated_at)}` : ""}
          </p>
        )}
      </div>
      <div className="mt-5"><LeadActivity source="koc_to_dhruva" leadKey={lead.lead_key} refreshKey={activityKey} /></div>
    </Drawer>
  );
}
