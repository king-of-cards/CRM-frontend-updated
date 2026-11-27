import { useEffect, useState } from "react";
import { Archive, BadgeCheck, RotateCcw } from "lucide-react";
import ContactActions from "../shared/ContactActions.jsx";
import {
  archiveDhruvaLead,
  unarchiveDhruvaLead,
  updateDhruvaLead,
} from "../../api/dhruva.js";
import { downloadLeadPdf } from "../leads/leadPdf.js";
import LeadPdfButton from "../leads/LeadPdfButton.jsx";
import HotLeadStar from "../leads/HotLeadStar.jsx";
import Drawer, { Alert, primaryBtn, secondaryBtn } from "../crmLeads/Drawer.jsx";
import {
  dateTimeText, dhruvaChanges, dhruvaErrors, dhruvaFieldAccess, dhruvaFormErrors, dhruvaFormOf, eventDatesOf, eventDatesText, KOC_FIELDS, LEAD_FIELDS, phonesOf, phoneText, rupeesText, statusLabel,
} from "../../pages/dhruvaUtils.js";
import LeadActivity from "../leads/LeadActivity.jsx";
import AlsoInBadges from "../leads/AlsoInBadges.jsx";
import { alsoInLine, alsoInPlaces } from "../leads/alsoIn.js";
import { useAuth } from "../../auth/useAuth.js";
import { ViewOnlyBadge } from "../shared/ViewOnly.jsx";
import { duplicateMessage } from "../shared/duplicates.js";
import { DhruvaFieldInput, DhruvaFieldList, dhruvaValueText } from "./DhruvaFields.jsx";

// The lead's initials for the header (as in the Spin / Wedding lead panels)
const initials = (name) =>
  String(name || "?")
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

// White rounded cards, the same as the Spin lead panel's "Lead status" card
const CARD = "space-y-4 rounded-3xl bg-white/80 p-5 ring-1 ring-gray-100 shadow-sm backdrop-blur";
const CHIP = "rounded-full bg-white/15 px-2.5 py-1 ring-1 ring-white/20";
// The panel no longer shows Response (removed on request); the field itself is unchanged
const PANEL_KOC_FIELDS = KOC_FIELDS.filter((f) => f.key !== "response");

// Dhruva → KOC lead (docs section 13). Lead fields (name … venue): admins and Dhruva logins edit.
// KOC fields (WhatsApp status … follow-up date): admins edit; read-only for everyone else.
// Sent at is set by the CRM: shown, never sent. The activity (who, when, field, old → new) below.
// isAdmin: a real admin. View-only logins (useAuth().canEdit false) read every field as text.
// whatsappStatuses: suggestions for WhatsApp status (filter-options whatsapp_statuses).
export default function DhruvaLeadPanel({ lead, isAdmin, onClose, onSaved, onArchived, isHot = false, hotPending = false, onToggleHot = null, showHot = false, whatsappStatuses = [] }) {
  const { canEdit } = useAuth();
  const [form, setForm] = useState(() => dhruvaFormOf(lead));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [duplicate, setDuplicate] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activityRefreshKey, setActivityRefreshKey] = useState(0);

  useEffect(() => {
    setForm(dhruvaFormOf(lead));
    setError("");
    setFieldErrors({});
    setDuplicate(null);
    setSaved(false);
  }, [lead?.id]);

  if (!lead) return null;
  const access = dhruvaFieldAccess(!canEdit ? "viewer" : isAdmin ? "admin" : "dhruva");
  const canSave = access.editBasic || access.editAdmin;
  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((old) => ({ ...old, [key]: undefined }));
    setSaved(false);
  };

  async function save(e, allowDuplicate = false) {
    e?.preventDefault();
    const local = dhruvaFormErrors(form, { koc: access.editAdmin });
    if (Object.keys(local).length) {
      setFieldErrors(local);
      setError("Fix the highlighted fields.");
      return;
    }
    setBusy(true);
    setError("");
    setFieldErrors({});
    try {
      const changes = dhruvaChanges(lead, form, { koc: access.editAdmin });
      if (!Object.keys(changes).length) { setSaved(true); return; }
      if (allowDuplicate) changes.allow_duplicate = true;
      const savedLead = await updateDhruvaLead(lead.id, changes);
      setDuplicate(null);
      setSaved(true);
      setActivityRefreshKey((key) => key + 1);
      onSaved(savedLead);
    } catch (err) {
      const parsed = dhruvaErrors(err);
      setFieldErrors(parsed.fields);
      if (err.status === 409 && parsed.duplicate && !allowDuplicate) {
        setDuplicate(parsed.duplicate);
        setError(duplicateMessage(err.detail));
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
      setActivityRefreshKey((key) => key + 1);
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
      const title = lead.name || phoneText(phonesOf(lead)[0]);
      await downloadLeadPdf({
        title,
        subtitle: [lead.venue, lead.event_type].filter(Boolean).join(" · "),
        source: "Dhruva lead",
        fileName: `dhruva-lead-${String(title || "lead")
          .replace(/[^\w]+/g, "-")
          .toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`,
        sections: [
          { title: "Lead details", rows: [...LEAD_FIELDS.map((f) => [f.label, dhruvaValueText(f, lead)]), ["Sent at", dateTimeText(lead.sent_at)], ["Received", dateTimeText(lead.created_at)]] },
          { title: "KOC", rows: PANEL_KOC_FIELDS.map((f) => [f.label, dhruvaValueText(f, lead)]) },
          { title: "Also in", rows: alsoInPlaces(lead.also_in).map((p) => [p.label, alsoInLine(p).slice(p.label.length + 2)]) },
        ],
      });
    } catch (err) {
      setError(`Download failed: ${err.message}`);
    } finally {
      setDownloading(false);
    }
  }

  const inputs = (fields) => (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((f) => (
        <DhruvaFieldInput
          key={f.key}
          field={f}
          value={form[f.key]}
          onChange={(v) => set(f.key, v)}
          error={fieldErrors[f.key]}
          suggestions={f.key === "whatsapp_status" ? whatsappStatuses : []}
        />
      ))}
    </div>
  );

  const title = lead.name || (phonesOf(lead).length ? phoneText(phonesOf(lead)[0]) : "") || "Lead details";
  const dates = eventDatesText(eventDatesOf(lead));
  const subtitle = [lead.event_type, dates !== "—" ? dates : null, lead.venue].filter(Boolean).join(" · ");
  // Status chips under the name: update, WhatsApp status, intervention, amounts, archived
  const chips = (
    <>
      <span className={CHIP}>{statusLabel(lead.update_status)}</span>
      {lead.whatsapp_status && <span className={CHIP}>WhatsApp: {lead.whatsapp_status}</span>}
      {lead.needs_intervention && <span className="rounded-full bg-amber-300 px-2.5 py-1 font-semibold text-amber-950">Needs intervention</span>}
      {lead.quoted_amount != null && <span className={CHIP}>Quoted {rupeesText(lead.quoted_amount)}</span>}
      {lead.conversion_amount != null && (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400 px-2.5 py-1 font-semibold text-emerald-950">
          <BadgeCheck size={13} /> Converted {rupeesText(lead.conversion_amount)}
        </span>
      )}
      {lead.archived && <span className={CHIP}>Archived</span>}
    </>
  );

  return (
    <Drawer lead kicker="Dhruva → KOC" title={title} avatar={initials(lead.name || title)} subtitle={subtitle} chips={chips} onClose={onClose} headerActions={<>{!canEdit && <ViewOnlyBadge inverted />}{(onToggleHot || showHot) && <HotLeadStar isHot={isHot} pending={hotPending} onToggle={onToggleHot} />}</>} endActions={<LeadPdfButton onClick={pdf} loading={downloading} />}
      footer={<>
        {access.archive && <button type="button" onClick={archive} disabled={archiveBusy} className={secondaryBtn}>{lead.archived ? <RotateCcw size={15} className="mr-1 inline" /> : <Archive size={15} className="mr-1 inline" />}{lead.archived ? "Unarchive" : "Archive"}</button>}
        <button type="button" onClick={onClose} className={secondaryBtn}>Close</button>
        {canSave && <button type="submit" form="dhruva-edit-lead" disabled={busy} className={primaryBtn}>{busy ? "Saving…" : access.editAdmin ? "Save changes" : "Save lead details"}</button>}
      </>}
    >
      {/* Contact: wide Call / WhatsApp / Copy buttons (one line per number), for every role */}
      <ContactActions variant="panel" phones={phonesOf(lead)} name={lead.name} />

      <form id="dhruva-edit-lead" onSubmit={save} className="space-y-6" noValidate>
        {error && <Alert>{error}</Alert>}
        {saved && <Alert kind="success">Lead saved.</Alert>}
        {duplicate && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200"><span>Save this lead despite the duplicate match?</span><button type="button" disabled={busy} onClick={() => save(undefined, true)} className={primaryBtn}>Save anyway</button></div>}

        {/* KOC details first: the lead's status, like "Lead status" in the Spin panel */}
        <section className={CARD} aria-label="KOC details">
          <h3 className="text-sm font-semibold text-gray-900">KOC details{!access.editAdmin && <span className="ml-2 text-xs font-normal text-gray-500">Read only</span>}</h3>
          {access.editAdmin ? inputs(PANEL_KOC_FIELDS) : <DhruvaFieldList fields={PANEL_KOC_FIELDS} lead={lead} label="KOC details, read only" />}
          {(lead.status_updated_by_name || lead.status_updated_at) && (
            <p className="text-right text-xs text-gray-500">
              Last updated by {lead.status_updated_by_name || "—"}{lead.status_updated_at ? ` · ${dateTimeText(lead.status_updated_at)}` : ""}
            </p>
          )}
        </section>

        <section className={CARD} aria-label="Lead details">
          <h3 className="text-sm font-semibold text-gray-900">Lead details</h3>
          {access.editBasic ? inputs(LEAD_FIELDS) : <DhruvaFieldList fields={LEAD_FIELDS} lead={lead} label="Lead details, read only" />}
          <p className="text-xs text-gray-500">
            Sent at {dateTimeText(lead.sent_at)} · Received {dateTimeText(lead.created_at)} · Added by {lead.created_by_name || "—"} · {lead.source === "bulk_upload" ? "Bulk upload" : "Manual"}
          </p>
        </section>

        {alsoInPlaces(lead.also_in).length > 0 && <section className={CARD}><h3 className="text-xs font-semibold uppercase tracking-wider text-brand-700">Also in</h3><AlsoInBadges alsoIn={lead.also_in} variant="panel" /></section>}
      </form>
      <LeadActivity source="dhruva" leadKey={lead.id} refreshKey={activityRefreshKey} />
    </Drawer>
  );
}
