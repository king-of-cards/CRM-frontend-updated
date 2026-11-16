import { useCallback, useEffect, useState } from "react";
import { Download, FileUp, Plus, Star } from "lucide-react";
import { useAuth } from "../auth/useAuth.js";
import { exportDhruvaLeads, getDhruvaFilterOptions, getDhruvaStats, listDhruvaLeads, updateDhruvaLead } from "../api/dhruva.js";
import { parseSort } from "../components/dashboard/FilterSelect.jsx";
import { fmt, Pagination, SectionShell } from "../components/leads/LeadKit.jsx";
import LeadFilterBar from "../components/leads/LeadFilterBar.jsx";
import { useLeadFilters } from "../components/leads/useLeadFilters.js";
import { DHRUVA } from "../components/leads/leadFilters.js";
import { kpiCards } from "../components/leads/kpiCards.js";
import { AmountCell } from "../components/leads/InlineCrm.jsx";
import { fieldCls } from "../components/crmLeads/Drawer.jsx";
import DhruvaAddLeadDialog from "../components/vendorToKoc/DhruvaAddLeadDialog.jsx";
import DhruvaBulkUploadDialog from "../components/vendorToKoc/DhruvaBulkUploadDialog.jsx";
import DhruvaLeadPanel from "../components/vendorToKoc/DhruvaLeadPanel.jsx";
import { dateTimeText, dayText, dhruvaErrors, phoneText, statusLabel, STATUSES, PENDING } from "./dhruvaUtils.js";

const SORTS = [
  { value: "created_at:desc", label: "Newest first" }, { value: "created_at:asc", label: "Oldest first" },
  { value: "updated_at:desc", label: "Recently updated" }, { value: "event_date:asc", label: "Event date (soonest)" },
  { value: "name:asc", label: "Name A–Z" }, { value: "venue:asc", label: "Venue A–Z" }, { value: "update_status:asc", label: "Update" },
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
  return <div><select aria-label="Update status" value={lead.update_status ?? PENDING} disabled={busy} onChange={(e) => save({ update_status: e.target.value === PENDING ? null : e.target.value })} className={`${fieldCls} w-48 py-1.5 text-xs`}><option value={PENDING}>Pending</option>{STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select><InlineError text={error} /></div>;
}
function AdminComments({ lead, onSaved }) {
  const { busy, error, save } = useSave(lead, onSaved); const [text, setText] = useState(lead.additional_comments ?? "");
  useEffect(() => setText(lead.additional_comments ?? ""), [lead.additional_comments]);
  return <div><textarea aria-label="Additional comments" rows={1} maxLength={5000} value={text} disabled={busy} onChange={(e) => setText(e.target.value)} onBlur={() => text !== (lead.additional_comments ?? "") && save({ additional_comments: text.trim() || null })} className={`${fieldCls} w-48 resize-y py-1.5 text-xs`} /><InlineError text={error} /></div>;
}
function AdminFollowUp({ lead, onSaved }) {
  const { busy, error, save } = useSave(lead, onSaved);
  return <div><input aria-label="Follow-up date" type="date" value={lead.follow_up_date ?? ""} disabled={busy} onChange={(e) => save({ follow_up_date: e.target.value || null })} className={`${fieldCls} w-36 py-1.5 text-xs`} /><InlineError text={error} /></div>;
}

export default function DhruvaLeads() {
  const { isAdmin } = useAuth();
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
  const items = data?.items ?? [];
  const onSaved = (saved) => { setData((d) => d && ({ ...d, items: d.items.map((l) => l.id === saved.id ? { ...l, ...saved } : l) })); getDhruvaStats(query).then(setStats).catch(() => {}); };
  async function runExport(format) {
    setExporting(true); setMessage(null);
    try { const file = await exportDhruvaLeads(format, { ...query, ...parseSort(sortValue) }); setMessage({ kind: "ok", text: `Downloaded ${file}.` }); }
    catch (err) { setMessage({ kind: "error", text: dhruvaErrors(err).message || err.message }); }
    finally { setExporting(false); }
  }
  const done = (text) => { setDialog(null); reload(); setMessage({ kind: "ok", text }); };
  const statsCards = kpiCards(stats?.kpis);
  const colCount = isAdmin ? 12 : 8;
  const saveAmount = (lead) => async (changes) => onSaved(await updateDhruvaLead(lead.id, changes));

  return <SectionShell theme="whatsapp" icon={Star} title="Dhruva leads" subtitle={isAdmin ? "Leads added by Dhruva team members" : "Leads you and your team have added"}
    action={<div className="flex flex-wrap gap-2"><button type="button" onClick={() => setDialog("single")} className="flex items-center gap-1.5 rounded-full bg-linear-to-r from-brand-600 to-brand-800 px-4 py-2 text-sm font-medium text-white"><Plus size={15} />Add lead</button><button type="button" onClick={() => setDialog("bulk")} className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm"><FileUp size={15} />Bulk upload</button><button type="button" onClick={() => runExport("xlsx")} disabled={exporting} className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm disabled:opacity-60"><Download size={15} />{exporting ? "Exporting…" : "Export"}</button><button type="button" onClick={() => runExport("csv")} disabled={exporting} className="rounded-full border border-gray-200 bg-white px-3 py-2 text-sm disabled:opacity-60">CSV</button></div>}
    message={message ?? error} stats={statsCards}
    toolbar={<LeadFilterBar source={DHRUVA} filters={filters} update={update} clear={clear} apply={apply} clearFilters={clearFilters} count={count} options={options} isAdmin={isAdmin} sorts={sorts} sortValue={sortValue} placeholder="Search name, venue, event type or phone…" />}
    footer={<Pagination page={page} pageSize={pageSize} total={data?.total} onPage={setPage} onPageSize={setPageSize} disabled={loading} />}>
    <div className="overflow-x-auto"><table className={`w-full min-w-[1000px] text-sm transition-opacity ${loading && data ? "opacity-50" : ""}`}>
      <thead className="border-y border-gray-100 bg-gray-50/80"><tr><th className={th}>Sl. No</th><th className={th}>Event date</th><th className={th}>Name</th><th className={th}>Venue</th><th className={th}>Phone</th><th className={th}>Event type</th><th className={th}>Update</th>{isAdmin && <><th className={th}>Comments</th><th className={th}>Follow-up</th><th className={`${th} text-right`}>Quoted</th><th className={`${th} text-right`}>Conversion</th></>}<th className={th}>Received</th></tr></thead>
      <tbody>
        {loading && !data && <tr><td colSpan={colCount} className="px-6 py-10 text-center text-gray-400">Loading…</td></tr>}
        {items.map((l) => <tr key={l.id} onClick={() => setOpenLead(l)} className="cursor-pointer border-b border-gray-50 align-top hover:bg-brand-50/40">
          <td className="px-3 py-3 tabular-nums text-gray-500">{l.sl_no ?? "—"}</td><td className="whitespace-nowrap px-3 py-3">{l.event_date_text || dayText(l.event_date)}</td>
          <td className="px-3 py-3 font-medium text-gray-900">{l.name || "—"}{(!l.phone && !l.alt_phone) && <span className="ml-2 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] text-sky-700">No phone</span>}{l.archived && <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[10px]">Archived</span>}</td>
          <td className="px-3 py-3">{l.venue || "—"}</td><td className="whitespace-nowrap px-3 py-3">{phoneText(l.phone)}{l.alt_phone && <span className="block text-xs text-gray-500">Alt: {phoneText(l.alt_phone)}</span>}</td><td className="px-3 py-3">{l.event_type || "—"}<span className="mt-1 inline-flex rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700">{l.source === "bulk_upload" ? "Bulk upload" : "Manual"}</span></td>
          {isAdmin ? <><td className="px-2 py-2" onClick={(e) => e.stopPropagation()}><AdminStatus lead={l} onSaved={onSaved} /></td><td className="px-2 py-2" onClick={(e) => e.stopPropagation()}><AdminComments lead={l} onSaved={onSaved} /></td><td className="px-2 py-2" onClick={(e) => e.stopPropagation()}><AdminFollowUp lead={l} onSaved={onSaved} /></td><td className="whitespace-nowrap px-2 py-2 text-right" onClick={(e) => e.stopPropagation()}><AmountCell crm={l} save={saveAmount(l)} field="quoted_amount" label="Quoted amount" setQuotedDate={false} /></td><td className="whitespace-nowrap px-2 py-2 text-right" onClick={(e) => e.stopPropagation()}><AmountCell crm={l} save={saveAmount(l)} field="conversion_amount" label="Conversion amount" setQuotedDate={false} /></td></> : <td className="px-3 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${l.update_status ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{statusLabel(l.update_status)}</span><span className="block text-[11px] text-gray-500">{l.additional_comments || ""}</span></td>}
          <td className="whitespace-nowrap px-3 py-3 text-gray-600" title={dateTimeText(l.created_at)}>{dayText(l.created_at)}</td>
        </tr>)}
        {!loading && !items.length && <tr><td colSpan={colCount} className="px-6 py-14 text-center text-gray-500">{count || filters.search ? "No leads match these filters." : "No Dhruva leads yet."}</td></tr>}
      </tbody>
    </table></div>
    <DhruvaLeadPanel lead={openLead} isAdmin={isAdmin} onClose={() => setOpenLead(null)} onSaved={onSaved} onArchived={(res) => { reload(); setOpenLead((old) => old ? { ...old, ...(res ?? {}), archived: !old.archived } : null); }} />
    {dialog === "single" && <DhruvaAddLeadDialog onClose={() => setDialog(null)} onAdded={done} />}
    {dialog === "bulk" && <DhruvaBulkUploadDialog onClose={() => setDialog(null)} onImported={reload} />}
  </SectionShell>;
}
