import DateInput from "../components/shared/DateInput.jsx";
import { useCallback, useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router";
import { Download, FileUp, Plus, Star } from "lucide-react";
import { useAuth } from "../auth/useAuth.js";
import DashboardLayout from "../components/layout/DashboardLayout.jsx";
import { exportDhruvaLeads, getDhruvaFilterOptions, getDhruvaStats, listDhruvaLeads, updateDhruvaLead } from "../api/dhruva.js";
import { setDhruvaLeadHot } from "../api/hotLeads.js";
import HotLeadStar from "../components/leads/HotLeadStar.jsx";
import AlsoInBadges from "../components/leads/AlsoInBadges.jsx";
import { toggleHotOptimistically } from "../components/leads/hotLeadToggle.js";
import { parseSort } from "../components/dashboard/FilterSelect.jsx";
import { Pagination, SectionShell } from "../components/leads/LeadKit.jsx";
import LeadFilterBar from "../components/leads/LeadFilterBar.jsx";
import { useLeadFilters } from "../components/leads/useLeadFilters.js";
import { DHRUVA } from "../components/leads/leadFilters.js";
import { kpiCards } from "../components/leads/kpiCards.js";
import { AmountCell } from "../components/leads/InlineCrm.jsx";
import { fieldCls } from "../components/crmLeads/Drawer.jsx";
import { UPDATE_OPTIONS } from "../api/leadCrm.js";
import DhruvaAddLeadDialog from "../components/vendorToKoc/DhruvaAddLeadDialog.jsx";
import DhruvaBulkUploadDialog from "../components/vendorToKoc/DhruvaBulkUploadDialog.jsx";
import DhruvaLeadPanel from "../components/vendorToKoc/DhruvaLeadPanel.jsx";
import { dateTimeText, dayText, dhruvaErrors, dhruvaStatCards, eventDatesOf, eventDatesText, phoneEntriesOf, phonesOf, rupeesText, statusLabel, PENDING } from "./dhruvaUtils.js";
import { SkeletonRows } from "../components/shared/Skeleton.jsx";
import { PhoneList } from "../components/vendorToKoc/PhoneNumbers.jsx";

// Dhruva → KOC (docs/API_REFERENCE.md section 13). Lead fields: admins and Dhruva logins (in the
// panel). KOC fields: admins only (inline here and in the panel); read-only for everyone else.
// Sent at is set by the CRM and only shown.
const SORTS = [
  { value: "created_at:desc", label: "Newest first" }, { value: "created_at:asc", label: "Oldest first" },
  { value: "sent_at:desc", label: "Sent (newest)" }, { value: "sent_at:asc", label: "Sent (oldest)" },
  { value: "updated_at:desc", label: "Recently updated" }, { value: "event_date:asc", label: "Event date (soonest)" },
  { value: "name:asc", label: "Name A–Z" }, { value: "venue:asc", label: "Venue A–Z" }, { value: "update_status:asc", label: "Update" },
  { value: "whatsapp_status:asc", label: "WhatsApp status A–Z" }, { value: "follow_up_date:asc", label: "Follow-up date" },
];
const th = "whitespace-nowrap px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500";
function InlineError({ text }) { return text ? <span role="alert" className="mt-1 block max-w-[190px] text-[11px] text-red-600">{text}</span> : null; }
function useSave(lead, onSaved) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const save = async (changes) => { setBusy(true); setError(""); try { onSaved(await updateDhruvaLead(lead.id, changes)); } catch (err) { const p = dhruvaErrors(err); setError(p.message || Object.values(p.fields).join(" ") || err.message); } finally { setBusy(false); } };
  return { busy, error, save };
}
function AdminStatus({ lead, onSaved }) {
  const { busy, error, save } = useSave(lead, onSaved);
  return <div><select aria-label="Update status" value={lead.update_status ?? PENDING} disabled={busy} onChange={(e) => save({ update_status: e.target.value === PENDING ? null : e.target.value })} className={`${fieldCls} w-48 py-1.5 text-xs`}><option value={PENDING}>Pending</option>{UPDATE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select><InlineError text={error} /></div>;
}
function AdminComments({ lead, onSaved }) {
  const { busy, error, save } = useSave(lead, onSaved); const [text, setText] = useState(lead.comments ?? "");
  useEffect(() => setText(lead.comments ?? ""), [lead.comments]);
  return <div><textarea aria-label="Comments" rows={1} maxLength={5000} value={text} disabled={busy} onChange={(e) => setText(e.target.value)} onBlur={() => text !== (lead.comments ?? "") && save({ comments: text.trim() || null })} className={`${fieldCls} w-48 resize-y py-1.5 text-xs`} /><InlineError text={error} /></div>;
}
function AdminFollowUp({ lead, onSaved }) {
  const { busy, error, save } = useSave(lead, onSaved);
  return <div><DateInput aria-label="Follow-up date" type="date" value={lead.follow_up_date ?? ""} disabled={busy} onChange={(e) => save({ follow_up_date: e.target.value || null })} className={`${fieldCls} w-36 py-1.5 text-xs`} /><InlineError text={error} /></div>;
}
function AdminIntervention({ lead, onSaved }) {
  const { busy, error, save } = useSave(lead, onSaved);
  return <div><label className="inline-flex items-center gap-1.5 text-xs"><input type="checkbox" aria-label="Needs Dhruva intervention" checked={lead.needs_intervention === true} disabled={busy} onChange={(e) => save({ needs_intervention: e.target.checked })} />Yes</label><InlineError text={error} /></div>;
}
const LongText = ({ text }) => <td className="max-w-56 whitespace-pre-line px-3 py-3 text-gray-700"><span className="line-clamp-3">{text || "—"}</span></td>;
export default function DhruvaLeads() {
  // isAdmin: admin edits; seesAll: the admin view (admins and view-only logins); canEdit false: view only
  const { isAdmin, isDhruva, seesAll, canEdit } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const { filters, query, queryKey, update, clear, apply, clearFilters, count, pageSize, setPageSize } = useLeadFilters(DHRUVA);
  const sorts = SORTS; const sortValue = sorts.some((s) => s.value === filters.sort) ? filters.sort : SORTS[0].value;
  const listParams = useCallback((p) => ({ page: p, page_size: pageSize, ...query, ...parseSort(sortValue) }), [pageSize, queryKey, sortValue]);
  const [data, setData] = useState(() => listDhruvaLeads.peek(listParams(1)) ?? null);
  const [stats, setStats] = useState(() => getDhruvaStats.peek(query) ?? null);
  const [options, setOptions] = useState(() => getDhruvaFilterOptions.peek() ?? {});
  const [loading, setLoading] = useState(() => !listDhruvaLeads.peek(listParams(1)));
  const [error, setError] = useState(null); const [message, setMessage] = useState(null);
  const [reloadKey, setReloadKey] = useState(0); const [dialog, setDialog] = useState(null);
  const [openLead, setOpenLead] = useState(null); const [exporting, setExporting] = useState(false);
  const reload = useCallback(() => setReloadKey((n) => n + 1), []);
  useEffect(() => setPage(1), [queryKey, sortValue, pageSize]);
  useEffect(() => { getDhruvaFilterOptions().then(setOptions).catch(() => {}); }, [reloadKey]);
  useEffect(() => {
    let cancelled = false; const params = listParams(page); const cached = listDhruvaLeads.peek(params);
    if (cached) setData(cached); setLoading(!cached);
    listDhruvaLeads(params).then((res) => { if (!cancelled) { setData(res); setError(null); } }).catch((err) => !cancelled && setError({ kind: "error", text: dhruvaErrors(err).message || err.message })).finally(() => !cancelled && setLoading(false));
    getDhruvaStats(query).then((res) => !cancelled && setStats(res)).catch(() => {});
    return () => { cancelled = true; };
  }, [page, pageSize, queryKey, sortValue, reloadKey]);
  // The same array until the data changes (the notification effect below runs only then)
  const items = useMemo(() => data?.items ?? [], [data]);
  useEffect(() => {
    const target = searchParams.get("notification_lead_id");
    if (!target) return;
    const match = items.find((lead) => String(lead.id) === target);
    if (!match) return;
    setOpenLead(match);
    const next = new URLSearchParams(searchParams);
    next.delete("notification_lead_id");
    setSearchParams(next, { replace: true });
  }, [items, searchParams, setSearchParams]);
  const onSaved = (saved) => { setData((d) => d && ({ ...d, items: d.items.map((l) => l.id === saved.id ? { ...l, ...saved } : l) })); getDhruvaStats(query).then(setStats).catch(() => {}); };
  async function runExport(format) {
    setExporting(true); setMessage(null);
    try { const file = await exportDhruvaLeads(format, { ...query, ...parseSort(sortValue) }); setMessage({ kind: "ok", text: `Downloaded ${file}.` }); }
    catch (err) { setMessage({ kind: "error", text: dhruvaErrors(err).message || err.message }); }
    finally { setExporting(false); }
  }
  const done = (text) => { setDialog(null); reload(); setMessage({ kind: "ok", text }); };
  // Hot star (admins and Dhruva logins): optimistic, rolled back if the API refuses
  const [hotOverrides, setHotOverrides] = useState({});
  const [hotPending, setHotPending] = useState({});
  const showHot = seesAll || isDhruva;
  const canToggleHot = (isAdmin || isDhruva) && canEdit;
  const isHot = (lead) => hotOverrides[String(lead.id)] ?? Boolean(lead.is_hot);
  const toggleHot = (lead) => {
    const key = String(lead.id);
    if (!canToggleHot || hotPending[key]) return;
    setHotPending((current) => ({ ...current, [key]: true }));
    toggleHotOptimistically(isHot(lead), (next) => setDhruvaLeadHot(lead.id, next), (next) => setHotOverrides((current) => ({ ...current, [key]: next })))
      .catch((err) => setMessage({ kind: "error", text: dhruvaErrors(err).message || err.message }))
      .finally(() => setHotPending((current) => ({ ...current, [key]: false })));
  };
  const statsCards = dhruvaStatCards(stats, kpiCards);
  const colCount = 17 + (showHot ? 1 : 0);
  const whatsappStatuses = (options?.whatsapp_statuses ?? []).map((o) => String(o.value)).filter(Boolean);
  // Upload: admins only (docs section 13: Dhruva and view-only logins 403)
  const canUpload = isAdmin && canEdit;
  const saveAmount = (lead) => async (changes) => onSaved(await updateDhruvaLead(lead.id, changes));

  return <DashboardLayout title="Dhruva → KOC" description={seesAll ? "Leads added by Dhruva team members" : "Leads you and your team have added"}><SectionShell theme="whatsapp" icon={Star} title="Dhruva → KOC" subtitle={seesAll ? "Leads added by Dhruva team members" : "Leads you and your team have added"}
    action={<div className="flex flex-wrap gap-2">{canEdit && <button type="button" onClick={() => setDialog("single")} className="flex items-center gap-1.5 rounded-full bg-linear-to-r from-brand-600 to-brand-800 px-4 py-2 text-sm font-medium text-white"><Plus size={15} />Add lead</button>}{canUpload && <button type="button" onClick={() => setDialog("bulk")} className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm"><FileUp size={15} />Bulk upload</button>}<button type="button" onClick={() => runExport("xlsx")} disabled={exporting} className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm disabled:opacity-60"><Download size={15} />{exporting ? "Exporting…" : "Export"}</button><button type="button" onClick={() => runExport("csv")} disabled={exporting} className="rounded-full border border-gray-200 bg-white px-3 py-2 text-sm disabled:opacity-60">CSV</button></div>}
    message={message ?? error} stats={statsCards}
    toolbar={<LeadFilterBar source={DHRUVA} filters={filters} update={update} clear={clear} apply={apply} clearFilters={clearFilters} count={count} options={options} isAdmin={seesAll} sorts={sorts} sortValue={sortValue} placeholder="Search name, phone, venue, WhatsApp status, notes…" />}
    footer={<Pagination page={page} pageSize={pageSize} total={data?.total} onPage={setPage} onPageSize={setPageSize} disabled={loading} onPrefetch={(n) => listDhruvaLeads(listParams(n)).catch(() => {})} />}>
    <div className="overflow-x-auto"><table className={`w-full min-w-[2000px] text-sm transition-opacity ${loading && data ? "opacity-50" : ""}`}>
      <thead className="border-y border-gray-100 bg-gray-50/80"><tr>{showHot && <th className={th} aria-label="Hot lead" />}<th className={th}>Sl. No</th><th className={th}>Name</th><th className={th}>Phone numbers</th><th className={th}>Event dates</th><th className={th}>Event type</th><th className={th}>Venue</th><th className={th}>Sent at</th><th className={th}>WhatsApp status</th><th className={th}>Response</th><th className={th}>Message sent</th><th className={th}>Follow-up notes</th><th className={th}>Comments</th><th className={th}>Needs intervention</th><th className={th}>Update</th><th className={`${th} text-right`}>Quoted amount</th><th className={`${th} text-right`}>Conversion amount</th><th className={th}>Follow-up date</th></tr></thead>
      <tbody>
        {loading && !data && <SkeletonRows cols={colCount} label="Loading leads" />}
        {items.map((l) => <tr key={l.id} onClick={() => setOpenLead(l)} className="cursor-pointer border-b border-gray-50 align-top hover:bg-brand-50/40">
          {showHot && <td className="px-2 py-2" onClick={(event) => event.stopPropagation()}><HotLeadStar isHot={isHot(l)} pending={Boolean(hotPending[String(l.id)])} onToggle={canToggleHot ? () => toggleHot(l) : null} /></td>}
          <td className="px-3 py-3 tabular-nums text-gray-500">{l.sl_no ?? "—"}</td>
          <td className="px-3 py-3 font-medium text-gray-900">{l.name || "—"}{!phonesOf(l).length && <span className="ml-2 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] text-sky-700">No phone</span>}<AlsoInBadges alsoIn={l.also_in} /></td>
          <td className="px-3 py-3"><PhoneList entries={phoneEntriesOf(l)} limit={2} name={l.name} label={`Phone numbers of ${l.name || "lead"}`} /></td>
          <td className="px-3 py-3"><span className="block max-w-48">{eventDatesText(eventDatesOf(l))}</span></td>
          <td className="px-3 py-3">{l.event_type || "—"}<span className="mt-1 block w-fit rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700">{l.source === "bulk_upload" ? "Bulk upload" : "Manual"}</span></td>
          <td className="px-3 py-3">{l.venue || "—"}</td>
          <td className="whitespace-nowrap px-3 py-3 text-gray-600" title={`Sent ${dateTimeText(l.sent_at)} · Received ${dateTimeText(l.created_at)}`}>{dayText(l.sent_at)}</td>
          <td className="px-3 py-3">{l.whatsapp_status || "—"}</td>
          <LongText text={l.response} /><LongText text={l.message_sent} /><LongText text={l.follow_up_notes} />
          {isAdmin ? <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}><AdminComments lead={l} onSaved={onSaved} /></td> : <LongText text={l.comments} />}
          {isAdmin ? <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}><AdminIntervention lead={l} onSaved={onSaved} /></td> : <td className="px-3 py-3">{l.needs_intervention ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">Yes</span> : "No"}</td>}
          {isAdmin ? <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}><AdminStatus lead={l} onSaved={onSaved} /></td> : <td className="px-3 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${l.update_status ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{statusLabel(l.update_status)}</span></td>}
          {isAdmin ? <td className="whitespace-nowrap px-2 py-2 text-right" onClick={(e) => e.stopPropagation()}><AmountCell crm={l} save={saveAmount(l)} field="quoted_amount" label="Quoted amount" setQuotedDate={false} /></td> : <td className="whitespace-nowrap px-3 py-3 text-right">{rupeesText(l.quoted_amount)}</td>}
          {isAdmin ? <td className="whitespace-nowrap px-2 py-2 text-right" onClick={(e) => e.stopPropagation()}><AmountCell crm={l} save={saveAmount(l)} field="conversion_amount" label="Conversion amount" setQuotedDate={false} /></td> : <td className="whitespace-nowrap px-3 py-3 text-right">{rupeesText(l.conversion_amount)}</td>}
          {isAdmin ? <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}><AdminFollowUp lead={l} onSaved={onSaved} /></td> : <td className="whitespace-nowrap px-3 py-3">{dayText(l.follow_up_date)}</td>}
        </tr>)}
        {!loading && !items.length && <tr><td colSpan={colCount} className="px-6 py-14 text-center text-gray-500">{count || filters.search ? "No leads match these filters." : "No Dhruva leads yet."}</td></tr>}
      </tbody>
    </table></div>

    <DhruvaLeadPanel lead={openLead} isAdmin={isAdmin} isHot={openLead ? isHot(openLead) : false} hotPending={openLead ? Boolean(hotPending[String(openLead.id)]) : false} onToggleHot={canToggleHot && openLead && !openLead.archived ? () => toggleHot(openLead) : null} showHot={showHot} whatsappStatuses={whatsappStatuses} onClose={() => setOpenLead(null)} onSaved={onSaved} onArchived={(res) => { reload(); setOpenLead((old) => old ? { ...old, ...(res ?? {}), archived: !old.archived } : null); }} />
    {canEdit && dialog === "single" && <DhruvaAddLeadDialog isAdmin={isAdmin} whatsappStatuses={whatsappStatuses} onClose={() => setDialog(null)} onAdded={done} />}
    {canUpload && dialog === "bulk" && <DhruvaBulkUploadDialog onClose={() => setDialog(null)} onImported={reload} />}
  </SectionShell></DashboardLayout>;
}
