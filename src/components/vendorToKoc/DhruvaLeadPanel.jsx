import { useEffect, useState } from "react";
import { Archive, Download, RotateCcw } from "lucide-react";
import {
  archiveDhruvaLead,
  unarchiveDhruvaLead,
  updateDhruvaLead,
} from "../../api/dhruva.js";
import { downloadLeadPdf } from "../leads/leadPdf.js";
import Drawer, { Alert, fieldCls, primaryBtn, secondaryBtn } from "../crmLeads/Drawer.jsx";
import { dateTimeText, dayText, dhruvaErrors, phoneText, rupeesText, statusLabel, STATUSES, PENDING } from "../../pages/dhruvaUtils.js";

const basicFields = [
  ["name", "Name", "text"],
  ["venue", "Venue", "text"],
  ["date", "Event date", "text"],
  ["phone", "Phone", "tel"],
  ["alt_phone", "Alt phone", "tel"],
  ["event_type", "Event type", "text"],
];
const fieldsOf = (lead) => ({
  name: lead?.name ?? "",
  venue: lead?.venue ?? "",
  date: lead?.event_date_text ?? lead?.event_date ?? "",
  phone: lead?.phone ?? "",
  alt_phone: lead?.alt_phone ?? "",
  event_type: lead?.event_type ?? "",
  update_status: lead?.update_status ?? PENDING,
  additional_comments: lead?.additional_comments ?? "",
  follow_up_date: lead?.follow_up_date ?? "",
  quoted_amount: lead?.quoted_amount == null ? "" : String(lead.quoted_amount),
  conversion_amount: lead?.conversion_amount == null ? "" : String(lead.conversion_amount),
});
const amountValue = (v) => (String(v).trim() ? Number(String(v).replace(/,/g, "")) : null);

export default function DhruvaLeadPanel({ lead, isAdmin, onClose, onSaved, onArchived }) {
  const [form, setForm] = useState(() => fieldsOf(lead));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [duplicate, setDuplicate] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setForm(fieldsOf(lead));
    setError("");
    setFieldErrors({});
    setDuplicate(null);
    setSaved(false);
  }, [lead?.id]);

  if (!lead) return null;
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const basicPayload = () => Object.fromEntries(basicFields.map(([key]) => [key, form[key].trim() || null]));
  const adminPayload = () => ({
    update_status: form.update_status === PENDING ? null : form.update_status,
    additional_comments: form.additional_comments.trim() || null,
    follow_up_date: form.follow_up_date || null,
    quoted_amount: amountValue(form.quoted_amount),
    conversion_amount: amountValue(form.conversion_amount),
  });

  async function save(e, allowDuplicate = false) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    setFieldErrors({});
    try {
      const basic = basicPayload();
      const original = {
        name: lead.name ?? null, venue: lead.venue ?? null,
        date: lead.event_date_text ?? lead.event_date ?? null,
        phone: lead.phone ?? null, alt_phone: lead.alt_phone ?? null, event_type: lead.event_type ?? null,
      };
      const changes = Object.fromEntries(Object.entries(basic).filter(([key, value]) => value !== original[key]));
      if (isAdmin) {
        const admin = adminPayload();
        const adminOriginal = {
          update_status: lead.update_status ?? null, additional_comments: lead.additional_comments ?? null,
          follow_up_date: lead.follow_up_date ?? null, quoted_amount: lead.quoted_amount ?? null,
          conversion_amount: lead.conversion_amount ?? null,
        };
        for (const [key, value] of Object.entries(admin)) if (value !== adminOriginal[key]) changes[key] = value;
      }
      if (!Object.keys(changes).length) { setSaved(true); return; }
      if (allowDuplicate) changes.allow_duplicate = true;
      const savedLead = await updateDhruvaLead(lead.id, changes);
      setDuplicate(null);
      setSaved(true);
      onSaved(savedLead);
    } catch (err) {
      const parsed = dhruvaErrors(err);
      setFieldErrors(parsed.fields);
      if (err.status === 409 && parsed.duplicate && !allowDuplicate) {
        setDuplicate(parsed.duplicate);
        setError(parsed.message || "This phone number matches another lead.");
      } else {
        setError(parsed.message || Object.values(parsed.fields).join(" ") || err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    if (!window.confirm(lead.archived ? "Unarchive this lead?" : "Archive this lead?")) return;
    setArchiveBusy(true);
    setError("");
    try {
      const res = lead.archived ? await unarchiveDhruvaLead(lead.id) : await archiveDhruvaLead(lead.id);
      onArchived(res);
    } catch (err) {
      setError(dhruvaErrors(err).message || err.message);
    } finally {
      setArchiveBusy(false);
    }
  }

  async function pdf() {
    setDownloading(true);
    try {
      await downloadLeadPdf({
        title: lead.name || phoneText(lead.phone),
        subtitle: [lead.venue, lead.event_type].filter(Boolean).join(" · "),
        source: "Dhruva lead",
        fileName: `dhruva-lead-${lead.id}.pdf`,
        sections: [
          { title: "Lead details", rows: [["Venue", lead.venue], ["Event date", lead.event_date_text || dayText(lead.event_date)], ["Phone", phoneText(lead.phone)], ["Alt phone", phoneText(lead.alt_phone)], ["Event type", lead.event_type], ["Received", dateTimeText(lead.created_at)], ["Added by", lead.created_by_name]] },
          { title: "Update", rows: [["Status", statusLabel(lead.update_status)], ["Additional comments", lead.additional_comments], ["Follow-up date", dayText(lead.follow_up_date)], ["Quoted amount", rupeesText(lead.quoted_amount)], ["Conversion amount", rupeesText(lead.conversion_amount)], ["Last updated", lead.status_updated_at ? `${lead.status_updated_by_name || "—"} · ${dateTimeText(lead.status_updated_at)}` : null]] },
        ],
      });
    } catch (err) {
      setError(err.message || "Could not create the PDF.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Drawer kicker="Dhruva leads" title={lead.name || "Lead details"} onClose={onClose} wide
      footer={<>
        {isAdmin && <button type="button" onClick={archive} disabled={archiveBusy} className={secondaryBtn}>{lead.archived ? <RotateCcw size={15} className="mr-1 inline" /> : <Archive size={15} className="mr-1 inline" />}{lead.archived ? "Unarchive" : "Archive"}</button>}
        <button type="button" onClick={pdf} disabled={downloading} className={secondaryBtn}><Download size={15} className="mr-1 inline" />{downloading ? "Preparing…" : "Download PDF"}</button>
        <button type="button" onClick={onClose} className={secondaryBtn}>Close</button>
        <button type="submit" form="dhruva-edit-lead" disabled={busy} className={primaryBtn}>{busy ? "Saving…" : "Save changes"}</button>
      </>}
    >
      <form id="dhruva-edit-lead" onSubmit={save} className="space-y-5">
        {error && <Alert>{error}</Alert>}
        {saved && <Alert kind="success">Lead saved.</Alert>}
        {duplicate && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200"><span>Save this lead despite the duplicate match?</span><button type="button" disabled={busy} onClick={() => save(undefined, true)} className={primaryBtn}>Save anyway</button></div>}
        <section className="grid gap-4 sm:grid-cols-2">
          {basicFields.map(([key, label, type]) => <label key={key} className="block"><span className="mb-1 block text-xs font-medium text-gray-600">{label}</span><input type={type} value={form[key]} onChange={(e) => { set(key, e.target.value); setFieldErrors((old) => ({ ...old, [key]: undefined })); }} className={`${fieldCls} ${fieldErrors[key] ? "border-red-300" : ""}`} maxLength={key === "venue" ? 300 : 200} />{fieldErrors[key] && <span className="mt-1 block text-xs text-red-600">{fieldErrors[key]}</span>}</label>)}
        </section>
        <p className="text-xs text-gray-500">Received {dateTimeText(lead.created_at)} · Added by {lead.created_by_name || "—"}</p>
        {isAdmin && <section className="space-y-4 rounded-2xl bg-gray-50 p-4 ring-1 ring-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Admin update</h3>
          <label className="block"><span className="mb-1 block text-xs font-medium text-gray-600">Update</span><select value={form.update_status} onChange={(e) => set("update_status", e.target.value)} className={fieldCls}><option value={PENDING}>Pending</option>{STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-gray-600">Additional comments</span><textarea rows={3} value={form.additional_comments} onChange={(e) => set("additional_comments", e.target.value)} className={fieldCls} /></label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block"><span className="mb-1 block text-xs font-medium text-gray-600">Follow-up date</span><input type="date" value={form.follow_up_date} onChange={(e) => set("follow_up_date", e.target.value)} className={fieldCls} /></label>
            <label className="block"><span className="mb-1 block text-xs font-medium text-gray-600">Quoted amount</span><input inputMode="numeric" value={form.quoted_amount} onChange={(e) => set("quoted_amount", e.target.value)} className={fieldCls} /></label>
            <label className="block"><span className="mb-1 block text-xs font-medium text-gray-600">Conversion amount</span><input inputMode="numeric" value={form.conversion_amount} onChange={(e) => set("conversion_amount", e.target.value)} className={fieldCls} /></label>
          </div>
        </section>}
      </form>
    </Drawer>
  );
}
