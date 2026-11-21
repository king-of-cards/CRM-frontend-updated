import DateInput from "../shared/DateInput.jsx";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { ChevronDown, Download, FileUp, Handshake, Loader2, Plus } from "lucide-react";
import { useAuth } from "../../auth/useAuth.js";
import {
  exportKocLeads,
  getKocStats,
  listKocLeads,
  listKocVendors,
  updateKocLead,
} from "../../api/vendorToKoc.js";
import { parseSort } from "../dashboard/FilterSelect.jsx";
import { fmt, Pagination, SectionShell } from "../leads/LeadKit.jsx";
import LeadFilterBar from "../leads/LeadFilterBar.jsx";
import { useLeadFilters } from "../leads/useLeadFilters.js";
import { KOC, withoutKocAdminKeys } from "../leads/leadFilters.js";
import { fieldCls } from "../crmLeads/Drawer.jsx";
import KocAddLeadDialog from "./KocAddLeadDialog.jsx";
import KocBulkUploadDialog from "./KocBulkUploadDialog.jsx";
import KocLeadPanel from "./KocLeadPanel.jsx";
import { flowLabels } from "../layout/leadFlow.js";
import { listUsers } from "../../api/users.js";
import { AmountCell } from "../leads/InlineCrm.jsx";
import { kpiCards } from "../leads/kpiCards.js";
import { dateTimeText, dayText, kocErrors, PENDING, phoneText, statusLabel, STATUSES } from "./kocUtils.js";
import { setKocLeadHot } from "../../api/hotLeads.js";
import HotLeadStar from "../leads/HotLeadStar.jsx";
import AlsoInBadges from "../leads/AlsoInBadges.jsx";
import { toggleHotOptimistically } from "../leads/hotLeadToggle.js";

// Vendors → KOC leads (docs/API_REFERENCE.md section 11). Admins see every vendor's leads and
// edit Update, Additional comments and Follow-up date in the table; vendor logins see only
// their own leads, with those columns read-only (and never the Vendor column), and are the only ones who add leads (single or bulk).
// Both export.

const SORTS_ALL = [
  { value: "created_at:desc", label: "Newest first" },
  { value: "created_at:asc", label: "Oldest first" },
  { value: "updated_at:desc", label: "Recently updated" },
  { value: "lead_date:desc", label: "Lead date (latest)" },
  { value: "name:asc", label: "Name A–Z" },
  { value: "city:asc", label: "City A–Z" },
  { value: "follow_up_date:asc", label: "Follow-up (soonest)" },
  { value: "update_status:asc", label: "Update" },
];
// Admins also sort by vendor (vendor logins never see the Vendor column)
const SORTS_ADMIN = [...SORTS_ALL, { value: "vendor_name:asc", label: "Vendor A–Z" }];
const th = "whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500";

function CellError({ text }) {
  if (!text) return null;
  return (
    <span role="alert" className="mt-1 block max-w-[220px] whitespace-normal text-[11px] leading-tight text-red-600">
      {text}
    </span>
  );
}

// One admin field, saved on its own (PATCH). The row updates from the answer.
function useSave(lead, onSaved) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async (changes) => {
    setBusy(true);
    setError("");
    try {
      onSaved(await updateKocLead(lead.id, changes));
    } catch (err) {
      setError(kocErrors(err).message || Object.values(kocErrors(err).fields).join(" "));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, save };
}

function StatusCell({ lead, onSaved }) {
  const { busy, error, save } = useSave(lead, onSaved);
  return (
    <div>
      <select
        aria-label="Update"
        value={lead.update_status ?? PENDING}
        disabled={busy}
        onChange={(e) => save({ update_status: e.target.value === PENDING ? null : e.target.value })}
        className={`${fieldCls} w-52 py-1.5 text-xs`}
      >
        <option value={PENDING}>Pending</option>
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <CellError text={error} />
    </div>
  );
}

function CommentCell({ lead, onSaved }) {
  const { busy, error, save } = useSave(lead, onSaved);
  const [text, setText] = useState(lead.additional_comments ?? "");
  useEffect(() => setText(lead.additional_comments ?? ""), [lead.additional_comments]);
  return (
    <div>
      <textarea
        aria-label="Additional comments"
        rows={1}
        value={text}
        maxLength={5000}
        disabled={busy}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if (text !== (lead.additional_comments ?? "")) save({ additional_comments: text.trim() || null });
        }}
        placeholder="Add a comment…"
        className={`${fieldCls} w-56 resize-y py-1.5 text-xs`}
      />
      <CellError text={error} />
    </div>
  );
}

function FollowUpCell({ lead, onSaved }) {
  const { busy, error, save } = useSave(lead, onSaved);
  return (
    <div className="flex items-center gap-1">
      <DateInput
        type="date"
        aria-label="Follow-up date"
        value={lead.follow_up_date ?? ""}
        disabled={busy}
        onChange={(e) => save({ follow_up_date: e.target.value || null })}
        className={`${fieldCls} w-40 py-1.5 text-xs`}
      />
      {busy && <Loader2 size={13} className="animate-spin text-gray-400" />}
      <CellError text={error} />
    </div>
  );
}

function ExportMenu({ onExport, busy }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
      >
        <Download size={15} />
        {busy ? "Exporting…" : "Export"}
        <ChevronDown size={14} className="opacity-70" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-44 overflow-hidden rounded-2xl bg-white py-1 shadow-xl ring-1 ring-gray-100">
          {[
            ["xlsx", "Excel (.xlsx)"],
            ["csv", "CSV"],
          ].map(([f, label]) => (
            <button
              key={f}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onExport(f);
              }}
              className="flex w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-brand-50"
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function VendorToKocLeads() {
  // seesAll: the admin view (admins and view-only logins); isAdmin && canEdit: admin edits
  const { isAdmin, seesAll, canEdit, canSeeLeads, user: me } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  // Rows per page live in the URL too (?page_size=25)
  const { filters, query, queryKey, update, clear, apply, clearFilters, count, pageSize, setPageSize } =
    useLeadFilters(KOC);
  const sorts = seesAll ? SORTS_ADMIN : SORTS_ALL;
  const sortValue = sorts.some((s) => s.value === filters.sort) ? filters.sort : sorts[0].value;
  // Vendor logins can't use the admin filters (the API answers 422): leave them out
  const apiFilters = seesAll ? query : withoutKocAdminKeys(query);
  const listParams = (p) => ({ page: p, page_size: pageSize, ...apiFilters, ...parseSort(sortValue) });

  const [data, setData] = useState(() => listKocLeads.peek(listParams(1)) ?? null);
  const [stats, setStats] = useState(() => getKocStats.peek(apiFilters) ?? null);
  const [vendors, setVendors] = useState(() => (seesAll ? (listKocVendors.peek() ?? []) : []));
  const [loading, setLoading] = useState(() => !listKocLeads.peek(listParams(1)));
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [dialog, setDialog] = useState(null); // "single" | "bulk"
  const [exporting, setExporting] = useState(false);
  const [openId, setOpenId] = useState(null); // the lead shown in the details panel
  const [hotOverrides, setHotOverrides] = useState({});
  const [hotPending, setHotPending] = useState({});
  const [userNames, setUserNames] = useState({}); // admins: login id -> name ("Added by")
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  // Any filter or sort change goes back to page 1
  useEffect(() => setPage(1), [queryKey, sortValue, pageSize]);

  // Vendors for the filter and the add forms, and login names (admins only)
  useEffect(() => {
    if (!canSeeLeads || !seesAll) return;
    listKocVendors().then(setVendors).catch(() => {});
    // Login names come from Team (GET /users), which view-only logins can't read
    if (!isAdmin) return;
    listUsers({ limit: 200 })
      .then((list) => setUserNames(Object.fromEntries(list.map((u) => [u.id, u.name]))))
      .catch(() => {});
  }, [canSeeLeads, seesAll, isAdmin, reloadKey]);

  useEffect(() => {
    if (!canSeeLeads) return;
    let cancelled = false;
    const params = listParams(page);
    const cached = listKocLeads.peek(params);
    if (cached) setData(cached);
    setLoading(!cached);
    listKocLeads(params)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setError(null);
        }
      })
      .catch((err) => !cancelled && setError({ kind: "error", text: kocErrors(err).message }))
      .finally(() => !cancelled && setLoading(false));
    getKocStats(apiFilters)
      .then((s) => !cancelled && setStats(s))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSeeLeads, seesAll, page, pageSize, queryKey, sortValue, reloadKey]);

  const items = data?.items ?? [];
  useEffect(() => {
    const target = searchParams.get("notification_lead_id");
    if (target == null) return;
    const lead = items.find((item) => String(item.id) === target);
    if (lead) {
      setOpenId(lead.id);
      const next = new URLSearchParams(searchParams);
      next.delete("notification_lead_id");
      setSearchParams(next, { replace: true });
    }
  }, [items, searchParams, setSearchParams]);
  // Hot column: admins, viewers and vendors; only those who can edit may toggle it
  const showHot = seesAll || Boolean(me?.vendor);
  const canToggleHot = (isAdmin || Boolean(me?.vendor)) && canEdit;
  const isHot = (lead) => hotOverrides[String(lead.id)] ?? Boolean(lead.is_hot);
  const toggleHot = (lead) => {
    const key = String(lead.id);
    if (!canToggleHot || hotPending[key]) return;
    setHotPending((current) => ({ ...current, [key]: true }));
    toggleHotOptimistically(isHot(lead), (next) => setKocLeadHot(lead.id, next), (next) => setHotOverrides((current) => ({ ...current, [key]: next })))
      .catch(() => {})
      .finally(() => setHotPending((current) => ({ ...current, [key]: false })));
  };
  if (!canSeeLeads) return null;

  // An inline edit: put the saved lead in its row (keeping its Sl. No) and refresh the numbers
  const onSaved = (saved) => {
    setData((d) => d && { ...d, items: d.items.map((i) => (i.id === saved.id ? { ...i, ...saved } : i)) });
    getKocStats(apiFilters).then(setStats).catch(() => {});
  };

  async function runExport(format) {
    setExporting(true);
    setMessage(null);
    try {
      const name = await exportKocLeads(format, { ...apiFilters, ...parseSort(sortValue) });
      setMessage({ kind: "ok", text: `Downloaded ${name}.` });
    } catch (err) {
      setMessage({ kind: "error", text: kocErrors(err).message });
    } finally {
      setExporting(false);
    }
  }

  // "Added by" as a name, never an id. Vendor logins can't list logins: "You" for their own,
  // else "Another team member" (no vendor name).
  const people = (id, lead) => {
    if (id == null) return null;
    if (seesAll) return userNames[id] ?? "—";
    return id === me?.id ? "You" : "Another team member";
  };
  const openLead = items.find((i) => i.id === openId) ?? null;

  const done = (text) => {
    setDialog(null);
    reload();
    setMessage({ kind: "ok", text });
  };

  // The six KPIs over the current filters (stats.kpis), then Pending and Follow-ups due
  const statChips = [
    ...kpiCards(stats?.kpis),
    { label: "Pending", value: stats?.by_status?.pending ? fmt(stats.by_status.pending) : "—", tone: stats?.by_status?.pending ? "amber" : undefined },
    { label: "Follow-ups due", value: stats?.follow_ups_due ? fmt(stats.follow_ups_due) : "—", tone: stats?.follow_ups_due ? "rose" : undefined },
  ];
  const colCount = (seesAll ? 11 : 10) + (showHot ? 1 : 0);
  const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
  // An admin's amount edit (PATCH), for AmountCell: errors are shown under the cell
  const saveAmount = (lead) => async (changes) => onSaved(await updateKocLead(lead.id, changes));

  return (
    <SectionShell
      theme="whatsapp"
      icon={Handshake}
      title={flowLabels(me?.role === "vendor" ? me.vendor : null).vendors}
      subtitle={seesAll ? "Leads vendors send to KOC" : "Leads you send to KOC"}
      action={
        <div className="flex items-center gap-2">
          {/* Adding leads: vendor logins only (admins and view-only logins get 403 from the API) */}
          {!seesAll && canEdit && (
            <>
              <button
                type="button"
                onClick={() => setDialog("single")}
                className="flex items-center gap-1.5 rounded-full bg-linear-to-r from-brand-600 to-brand-800 px-4 py-2 text-sm font-medium text-white shadow-md shadow-brand-700/25 transition hover:opacity-95"
              >
                <Plus size={15} /> Add lead
              </button>
              <button
                type="button"
                onClick={() => setDialog("bulk")}
                className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                <FileUp size={15} /> Bulk upload
              </button>
            </>
          )}
          <ExportMenu onExport={runExport} busy={exporting} />
        </div>
      }
      message={message ?? error}
      stats={statChips}
      toolbar={
        <LeadFilterBar
          source={KOC}
          filters={filters}
          update={update}
          clear={clear}
          apply={apply}
          clearFilters={clearFilters}
          count={count}
          options={{ vendors }}
          isAdmin={seesAll}
          sorts={sorts}
          sortValue={sortValue}
          placeholder="Search name, city or phone…"
        />
      }
      footer={
        <Pagination
          page={page}
          pageSize={pageSize}
          total={data?.total}
          onPage={setPage}
          onPageSize={setPageSize}
          disabled={loading}
        />
      }
    >
      <div className="overflow-x-auto">
        <table className={`w-full text-sm transition-opacity ${loading && data ? "opacity-50" : ""}`}>
          <thead className="border-y border-gray-100 bg-gray-50/80">
            <tr>
              {showHot && <th className={th} aria-label="Hot lead" />}
              <th className={th}>Sl. No</th>
              {seesAll && <th className={th}>Vendor</th>}
              <th className={th}>Date</th>
              <th className={th}>Name</th>
              <th className={th}>Phone</th>
              <th className={th}>City</th>
              {/* KOC's update: admins edit it, vendor logins see it read-only */}
              <th className={th}>Update</th>
              <th className={th}>Additional comments</th>
              <th className={th}>Follow-up date</th>
              <th className={`${th} text-right`}>Quoted amount</th>
              <th className={`${th} text-right`}>Conversion amount</th>
            </tr>
          </thead>
          <tbody>
            {loading && !data && (
              <tr>
                <td colSpan={colCount} className="px-6 py-10 text-center text-sm text-gray-400">
                  Loading…
                </td>
              </tr>
            )}
            {items.map((l) => (
              <tr
                key={l.id}
                onClick={() => setOpenId(l.id)}
                className={`cursor-pointer border-b border-gray-50 align-top transition-colors hover:bg-brand-50/40 ${openId === l.id ? "bg-brand-50/60" : ""}`}
              >
                {showHot && <td className="px-2 py-2" onClick={(event) => event.stopPropagation()}><HotLeadStar isHot={isHot(l)} pending={Boolean(hotPending[String(l.id)])} onToggle={canToggleHot ? () => toggleHot(l) : null} /></td>}
                <td className="px-4 py-3 tabular-nums text-gray-500">{l.sl_no ?? "—"}</td>
                {seesAll && <td className="whitespace-nowrap px-4 py-3 text-gray-800">{l.vendor_name ?? "—"}</td>}
                <td className="whitespace-nowrap px-4 py-3 text-gray-800">{dayText(l.lead_date)}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{l.name || "—"}<AlsoInBadges alsoIn={l.also_in} /></td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums text-gray-800">{phoneText(l.phone)}</td>
                <td className="px-4 py-3 text-gray-700">{l.city || "—"}</td>
                {isAdmin && canEdit ? (
                  <>
                    {/* Editing here mustn't open the details panel */}
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <StatusCell lead={l} onSaved={onSaved} />
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <CommentCell lead={l} onSaved={onSaved} />
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <FollowUpCell lead={l} onSaved={onSaved} />
                    </td>
                    {/* Amounts: admins edit them (PATCH quoted_amount / conversion_amount) */}
                    <td className="whitespace-nowrap px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <AmountCell crm={l} save={saveAmount(l)} field="quoted_amount" label="Quoted amount" setQuotedDate={false} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <AmountCell crm={l} save={saveAmount(l)} field="conversion_amount" label="Conversion amount" setQuotedDate={false} />
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{statusLabel(l.update_status)}</span>
                      {l.status_updated_at && (
                        <span className="mt-0.5 block text-[11px] text-gray-500">
                          Last updated: {l.status_updated_by_name || "—"} · {dateTimeText(l.status_updated_at)}
                        </span>
                      )}
                    </td>
                    <td className="max-w-[280px] whitespace-pre-line px-4 py-3 text-gray-700">{l.additional_comments || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-800">{l.follow_up_date ? dayText(l.follow_up_date) : "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-gray-800">
                      {l.quoted_amount != null ? inr.format(l.quoted_amount) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-gray-800">
                      {l.conversion_amount != null ? inr.format(l.conversion_amount) : "—"}
                    </td>
                  </>
                )}
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-6 py-14 text-center text-sm text-gray-500">
                  {count || filters.search ? "No leads match these filters." : "No leads yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <KocLeadPanel
        lead={openLead}
        isAdmin={seesAll}
        showHot={showHot}
        isHot={openLead ? isHot(openLead) : false}
        hotPending={openLead ? Boolean(hotPending[String(openLead.id)]) : false}
        onToggleHot={canToggleHot && openLead ? () => toggleHot(openLead) : null}
        people={people}
        onClose={() => setOpenId(null)}
        onSaved={onSaved}
      />
      {!seesAll && canEdit && dialog === "single" && <KocAddLeadDialog onClose={() => setDialog(null)} onAdded={done} />}
      {!seesAll && canEdit && dialog === "bulk" && <KocBulkUploadDialog onClose={() => setDialog(null)} onImported={reload} />}
    </SectionShell>
  );
}
