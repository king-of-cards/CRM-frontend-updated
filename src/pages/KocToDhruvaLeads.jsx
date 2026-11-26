import DateInput from "../components/shared/DateInput.jsx";
import ContactActions from "../components/shared/ContactActions.jsx";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { FileUp, PanelRightOpen, Send } from "lucide-react";
import ExportMenu from "../components/shared/ExportMenu.jsx";
import { useAuth } from "../auth/useAuth.js";
import DashboardLayout from "../components/layout/DashboardLayout.jsx";
import {
  exportKocToDhruvaLeads,
  getKocToDhruvaFilterOptions,
  getKocToDhruvaStats,
  listKocToDhruvaLeads,
  saveKocToDhruvaCrm,
} from "../api/kocToDhruva.js";
import { setKocToDhruvaLeadHot } from "../api/hotLeads.js";
import HotLeadStar from "../components/leads/HotLeadStar.jsx";
import { toggleHotOptimistically } from "../components/leads/hotLeadToggle.js";
import { CARD_AMOUNTS, Pagination, SectionShell } from "../components/leads/LeadKit.jsx";
import LeadFilterBar from "../components/leads/LeadFilterBar.jsx";
import { useLeadFilters } from "../components/leads/useLeadFilters.js";
import { KOC_TO_DHRUVA } from "../components/leads/leadFilters.js";
import { kpiCards } from "../components/leads/kpiCards.js";
import { AmountCell, UpdateCell } from "../components/leads/InlineCrm.jsx";
import AlsoInBadges from "../components/leads/AlsoInBadges.jsx";
import { branchOf } from "../components/leads/stores.js";
import BranchCell from "../components/leads/BranchCell.jsx";
import { fieldCls } from "../components/crmLeads/Drawer.jsx";
import KocToDhruvaLeadPanel from "../components/vendorToKoc/KocToDhruvaLeadPanel.jsx";
import BulkUploadDialog from "../components/crmLeads/BulkUploadDialog.jsx";
import { dateTimeText, dayText, dhruvaErrors } from "./dhruvaUtils.js";
import { budgetText, quantityText, spinField } from "./kocToDhruvaUtils.js";
import { SkeletonRows } from "../components/shared/Skeleton.jsx";

// KOC → Dhruva (docs/API_REFERENCE.md section 18): the spin leads shared with Dhruva by rule
// (budget per card ≥ ₹70 or quantity ≥ 1000). Admins and Dhruva logins edit this section's CRM
// details inline and in the panel; view-only logins read them; vendors never get here
// (App.jsx / permissions.js). No Add lead or Bulk upload: rows come only from the rule.

// "" = the API's default order (newest first)
const SORTS = [
  { value: "", label: "Newest first" },
  { value: "received:asc", label: "Oldest first" },
  { value: "event_date:asc", label: "Event date (soonest)" },
  { value: "quantity_required:desc", label: "Quantity (largest)" },
];
const sortQuery = (value) => {
  if (!value) return {};
  const [sort, order] = value.split(":");
  return { sort, order };
};
const th = "whitespace-nowrap px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500";

// A date or text cell that saves on change / blur (view only: plain text). Rendered with a key
// that includes the saved value, so a new value from the API starts it afresh.
function SaveCell({ value, field, save, canEdit, kind = "date", label }) {
  const [text, setText] = useState(value ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!canEdit) {
    return kind === "date"
      ? <span className="whitespace-nowrap text-gray-700">{dayText(value)}</span>
      : <span className="block max-w-56 whitespace-pre-line text-gray-700">{value || "—"}</span>;
  }
  const commit = async (next) => {
    const clean = kind === "date" ? next || null : next.trim() || null;
    if (clean === (value ?? null)) return;
    setBusy(true);
    setError("");
    try {
      await save({ [field]: clean });
    } catch (err) {
      setError(dhruvaErrors(err).message || err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      {kind === "date" ? (
        <DateInput type="date" aria-label={label} value={text} disabled={busy} onChange={(e) => { setText(e.target.value); commit(e.target.value); }} className={`${fieldCls} w-36 py-1.5 text-xs`} />
      ) : (
        <textarea aria-label={label} rows={1} maxLength={5000} value={text} disabled={busy} onChange={(e) => setText(e.target.value)} onBlur={() => commit(text)} className={`${fieldCls} w-48 resize-y py-1.5 text-xs`} />
      )}
      {error && <span role="alert" className="mt-1 block max-w-[190px] text-[11px] text-red-600">{error}</span>}
    </div>
  );
}

export default function KocToDhruvaLeads() {
  // seesAll: admins and view-only logins (the In other sources filter); canEdit false: view only
  const { isAdmin, isDhruva, seesAll, canEdit } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const { filters, query, queryKey, update, clear, apply, clearFilters, count, pageSize, setPageSize } = useLeadFilters(KOC_TO_DHRUVA);
  const sortValue = SORTS.some((s) => s.value === filters.sort) ? filters.sort : "";
  const listParams = useCallback(
    (p) => ({ page: p, page_size: pageSize, ...query, ...sortQuery(sortValue) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pageSize, queryKey, sortValue],
  );
  const [data, setData] = useState(() => listKocToDhruvaLeads.peek(listParams(1)) ?? null);
  const [stats, setStats] = useState(() => getKocToDhruvaStats.peek(query) ?? null);
  const [options, setOptions] = useState(() => getKocToDhruvaFilterOptions.peek() ?? {});
  const [loading, setLoading] = useState(() => !listKocToDhruvaLeads.peek(listParams(1)));
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [openKey, setOpenKey] = useState(null);
  const [exporting, setExporting] = useState(false);
  // Bulk upload (docs section 18): admins only; view-only, Dhruva and vendor logins never see it
  const canUpload = isAdmin && canEdit;
  const [uploading, setUploading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => setPage(1), [queryKey, sortValue, pageSize]);
  useEffect(() => { getKocToDhruvaFilterOptions().then(setOptions).catch(() => {}); }, []);
  useEffect(() => {
    let cancelled = false;
    const params = listParams(page);
    const cached = listKocToDhruvaLeads.peek(params);
    if (cached) setData(cached);
    setLoading(!cached);
    listKocToDhruvaLeads(params)
      .then((res) => { if (!cancelled) { setData(res); setError(null); } })
      .catch((err) => !cancelled && setError({ kind: "error", text: err.status === 503 ? "The workflow database is unavailable right now." : dhruvaErrors(err).message || err.message }))
      .finally(() => !cancelled && setLoading(false));
    getKocToDhruvaStats(query).then((res) => !cancelled && setStats(res)).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, queryKey, sortValue, reloadKey]);

  const branches = useMemo(() => options.branches ?? [], [options]);
  // Spin's raw fields (name, phone, email) as display values; the branch is the API's item.branch
  // ({ id, name, code, city }, as on spin items), or looked up from item.branch_id
  const displayOf = useCallback((l) => ({
    name: l.name ?? spinField(l, "name"),
    phone: l.phone ?? spinField(l, "phone"),
    email: l.email ?? spinField(l, "email"),
    branch: branchOf(l, branches),
    city: l.city ?? spinField(l, "city"),
  }), [branches]);
  const items = useMemo(() => (data?.items ?? []).map((l) => ({ ...l, display: displayOf(l) })), [data, displayOf]);
  const openLead = openKey == null ? null : items.find((l) => String(l.lead_key) === String(openKey)) ?? null;

  // Notification / follow-up links: ?notification_lead_key=… opens that lead once it's listed
  useEffect(() => {
    const target = searchParams.get("notification_lead_key");
    if (!target) return;
    if (!items.some((l) => String(l.lead_key) === target)) return;
    setOpenKey(target);
    const next = new URLSearchParams(searchParams);
    next.delete("notification_lead_key");
    setSearchParams(next, { replace: true });
  }, [items, searchParams, setSearchParams]);

  const onSaved = (leadKey, crm) => {
    setData((d) => d && ({ ...d, items: d.items.map((l) => (String(l.lead_key) === String(leadKey) ? { ...l, crm: { ...(l.crm ?? {}), ...(crm ?? {}) } } : l)) }));
    getKocToDhruvaStats(query).then(setStats).catch(() => {});
  };
  const saveFor = (lead) => async (changes) => {
    const res = await saveKocToDhruvaCrm(lead.lead_key, changes);
    const crm = res?.crm ?? res;
    onSaved(lead.lead_key, crm);
    return crm;
  };

  async function runExport(format) {
    setExporting(true);
    setMessage(null);
    try {
      const file = await exportKocToDhruvaLeads(format, { ...query, ...sortQuery(sortValue) });
      setMessage({ kind: "ok", text: `Downloaded ${file}.` });
    } catch (err) {
      setMessage({ kind: "error", text: dhruvaErrors(err).message || err.message });
    } finally {
      setExporting(false);
    }
  }

  // Hot star: admins and Dhruva logins toggle it (optimistic, rolled back if refused); viewers see it
  const [hotOverrides, setHotOverrides] = useState({});
  const [hotPending, setHotPending] = useState({});
  const showHot = seesAll || isDhruva;
  const canToggleHot = (isAdmin || isDhruva) && canEdit;
  const isHot = (lead) => hotOverrides[String(lead.lead_key)] ?? Boolean(lead.is_hot);
  const toggleHot = (lead) => {
    const key = String(lead.lead_key);
    if (!canToggleHot || hotPending[key]) return;
    setHotPending((c) => ({ ...c, [key]: true }));
    toggleHotOptimistically(isHot(lead), (next) => setKocToDhruvaLeadHot(lead.lead_key, next), (next) => setHotOverrides((c) => ({ ...c, [key]: next })))
      .catch((err) => setMessage({ kind: "error", text: dhruvaErrors(err).message || err.message }))
      .finally(() => setHotPending((c) => ({ ...c, [key]: false })));
  };
  const colCount = 14 + (showHot ? 1 : 0);
  const stop = (e) => e.stopPropagation();
  const description = "Spin leads shared with Dhruva: budget per card ≥ ₹70 or quantity ≥ 1000";

  return (
    <DashboardLayout title="KOC → Dhruva" description={description}>
      <SectionShell
        theme="koc_to_dhruva"
        icon={Send}
        title="KOC → Dhruva"
        subtitle="Also listed in Spin; this section keeps its own updates"
        action={<div className="flex flex-wrap gap-2">
          {canUpload && <button type="button" onClick={() => setUploading(true)} className="flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-full bg-linear-to-r from-brand-600 to-brand-800 px-4 py-2 text-sm font-medium text-white shadow-md shadow-brand-700/25 sm:min-h-0"><FileUp size={15} />Bulk upload</button>}
          <ExportMenu onExport={runExport} busy={exporting} />
        </div>}
        message={message ?? error}
        stats={kpiCards(stats?.kpis)}
        toolbar={<LeadFilterBar source={KOC_TO_DHRUVA} filters={filters} update={update} clear={clear} apply={apply} clearFilters={clearFilters} count={count} options={options} isAdmin={seesAll} sorts={SORTS} sortValue={sortValue} placeholder="Search name, phone, email, occasion…" />}
        footer={<Pagination page={page} pageSize={pageSize} total={data?.total} onPage={setPage} onPageSize={setPageSize} disabled={loading} onPrefetch={(n) => listKocToDhruvaLeads(listParams(n)).catch(() => {})} />}
      >
        {/* Phones: one card per lead (the wide table is for md and up); the full details are in the panel */}
        <ul aria-label="Leads" className={`divide-y divide-gray-100 border-t border-gray-100 transition-opacity md:hidden ${loading && data ? "opacity-50" : ""}`}>
          {loading && !data && Array.from({ length: 4 }).map((_, i) => <li key={`s${i}`} className="px-4 py-4"><span className="block h-3 w-40 animate-pulse rounded bg-gray-100" /><span className="mt-3 block h-8 w-48 animate-pulse rounded-full bg-gray-100" /></li>)}
          {items.map((l) => {
            const crm = l.crm ?? {};
            const save = saveFor(l);
            const meta = [l.occasion, l.event_date ? dayText(l.event_date) : null].filter(Boolean).join(" · ");
            return (
              <li key={l.lead_key}>
                <div onClick={() => setOpenKey(l.lead_key)} className="cursor-pointer px-4 py-3.5 transition-colors active:bg-brand-50/60">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-gray-900">{l.display.name || "Unnamed lead"}</p>
                      {meta && <p className="mt-0.5 truncate text-xs text-gray-500">{meta}</p>}
                      <AlsoInBadges alsoIn={l.also_in} />
                    </div>
                    {showHot && <div onClick={stop}><HotLeadStar isHot={isHot(l)} pending={Boolean(hotPending[String(l.lead_key)])} onToggle={canToggleHot ? () => toggleHot(l) : null} /></div>}
                    <button type="button" onClick={(event) => { stop(event); setOpenKey(l.lead_key); }} aria-label={`Open ${l.display.name || "lead"}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-brand-700"><PanelRightOpen size={18} /></button>
                  </div>
                  {(l.display.phone || l.display.email) && <div className="mt-2.5" onClick={stop}><ContactActions phone={l.display.phone} email={l.display.email} name={l.display.name} /></div>}
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div className="min-w-0"><dt className="text-gray-500">Budget per card</dt><dd className="mt-0.5 font-semibold tabular-nums text-gray-800">{budgetText(l.estimated_budget_per_card)}</dd></div>
                    <div className="min-w-0"><dt className="text-gray-500">Quantity</dt><dd className="mt-0.5 font-semibold tabular-nums text-gray-800">{quantityText(l.quantity_required)}</dd></div>
                    <div className="min-w-0"><dt className="text-gray-500">Branch</dt><dd className="mt-0.5 truncate text-gray-800"><BranchCell branch={l.display.branch} empty="—" /></dd></div>
                    <div className="min-w-0"><dt className="text-gray-500">Received</dt><dd className="mt-0.5 text-gray-800">{dayText(l.received)}</dd></div>
                  </dl>
                  <div className="mt-3 space-y-2.5 rounded-2xl bg-gray-50/80 p-2.5 text-xs" onClick={stop}>
                    <div className="flex flex-wrap items-center gap-2"><span className="w-20 shrink-0 text-gray-500">Update</span><UpdateCell crm={crm} save={save} /></div>
                    <div className={`grid grid-cols-2 gap-2 ${CARD_AMOUNTS}`}>
                      <div className="flex flex-col items-start"><span className="text-gray-500">Quoted</span><AmountCell crm={crm} save={save} field="quoted_amount" label="Quoted amount" /></div>
                      <div className="flex flex-col items-start"><span className="text-gray-500">Converted</span><AmountCell crm={crm} save={save} field="conversion_amount" label="Conversion amount" setQuotedDate={false} /></div>
                    </div>
                    <div><p className="mb-1 text-gray-500">Follow-up date</p><SaveCell key={`mfu-${crm.follow_up_date ?? ""}`} field="follow_up_date" label="Follow-up date" value={crm.follow_up_date} save={save} canEdit={canEdit} /></div>
                  </div>
                </div>
              </li>
            );
          })}
          {!loading && !items.length && <li className="px-4 py-12 text-center text-sm text-gray-500">{count || filters.search ? "No leads match these filters." : "No KOC → Dhruva leads yet."}</li>}
        </ul>
        <div className="hidden overflow-x-auto md:block">
          <table className={`w-full min-w-[1400px] text-sm transition-opacity ${loading && data ? "opacity-50" : ""}`}>
            <thead className="border-y border-gray-100 bg-gray-50/80">
              <tr>
                {showHot && <th className={th} aria-label="Hot lead" />}
                <th className={th}>Name</th><th className={th}>Phone</th><th className={th}>Occasion</th><th className={th}>Event date</th>
                <th className={th}>Branch</th><th className={`${th} text-right`}>Estimated budget per card</th>
                <th className={`${th} text-right`}>Quantity required</th><th className={th}>Received</th>
                <th className={th}>Update</th><th className={th}>Additional comments</th><th className={`${th} text-right`}>Quoted amount</th>
                <th className={th}>Quoted date</th><th className={`${th} text-right`}>Conversion amount</th><th className={th}>Follow-up date</th>
              </tr>
            </thead>
            <tbody>
              {loading && !data && <SkeletonRows cols={colCount} label="Loading leads" />}
              {items.map((l) => {
                const crm = l.crm ?? {};
                const save = saveFor(l);
                return (
                  <tr key={l.lead_key} onClick={() => setOpenKey(l.lead_key)} className="cursor-pointer border-b border-gray-50 align-top hover:bg-brand-50/40">
                    {showHot && <td className="px-2 py-2" onClick={stop}><HotLeadStar isHot={isHot(l)} pending={Boolean(hotPending[String(l.lead_key)])} onToggle={canToggleHot ? () => toggleHot(l) : null} /></td>}
                    <td className="px-3 py-3 font-medium text-gray-900">
                      {l.display.name || "Unnamed lead"}
                      {l.display.email && <span className="block text-xs font-normal text-gray-500">{l.display.email}</span>}
                      <AlsoInBadges alsoIn={l.also_in} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3"><ContactActions phone={l.display.phone} email={l.display.email} name={l.display.name} /></td>
                    <td className="px-3 py-3">{l.occasion || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-3">{dayText(l.event_date)}</td>
                    <td className="px-3 py-3"><BranchCell branch={l.display.branch} empty="—" /></td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums">{budgetText(l.estimated_budget_per_card)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums">{quantityText(l.quantity_required)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-gray-600" title={dateTimeText(l.received)}>{dayText(l.received)}</td>
                    <td className="px-2 py-2" onClick={stop}><UpdateCell crm={crm} save={save} /></td>
                    <td className="px-2 py-2" onClick={stop}><SaveCell key={`notes-${crm.notes ?? ""}`} kind="text" field="notes" label="Additional comments" value={crm.notes} save={save} canEdit={canEdit} /></td>
                    <td className="whitespace-nowrap px-2 py-2 text-right" onClick={stop}><AmountCell crm={crm} save={save} field="quoted_amount" label="Quoted amount" /></td>
                    <td className="px-2 py-2" onClick={stop}><SaveCell key={`qd-${crm.quoted_date ?? ""}`} field="quoted_date" label="Quoted date" value={crm.quoted_date} save={save} canEdit={canEdit} /></td>
                    <td className="whitespace-nowrap px-2 py-2 text-right" onClick={stop}><AmountCell crm={crm} save={save} field="conversion_amount" label="Conversion amount" setQuotedDate={false} /></td>
                    <td className="px-2 py-2" onClick={stop}><SaveCell key={`fu-${crm.follow_up_date ?? ""}`} field="follow_up_date" label="Follow-up date" value={crm.follow_up_date} save={save} canEdit={canEdit} /></td>
                  </tr>
                );
              })}
              {!loading && !items.length && <tr><td colSpan={colCount} className="px-6 py-14 text-center text-gray-500">{count || filters.search ? "No leads match these filters." : "No KOC → Dhruva leads yet."}</td></tr>}
            </tbody>
          </table>
        </div>
        <KocToDhruvaLeadPanel
          lead={openLead}
          onClose={() => setOpenKey(null)}
          onSaved={onSaved}
          showHot={showHot}
          isHot={openLead ? isHot(openLead) : false}
          hotPending={openLead ? Boolean(hotPending[String(openLead.lead_key)]) : false}
          onToggleHot={canToggleHot && openLead ? () => toggleHot(openLead) : null}
        />
        {canUpload && uploading && (
          <BulkUploadDialog
            source="koc_to_dhruva"
            onClose={() => setUploading(false)}
            onImported={() => setReloadKey((k) => k + 1)}
          />
        )}
      </SectionShell>
    </DashboardLayout>
  );
}
