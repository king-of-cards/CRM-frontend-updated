import { useCallback, useEffect, useState } from "react";
import { Camera } from "lucide-react";
import { getFilterOptions, getLeadStats, listLeads, listQuery } from "../../api/leadLists.js";
import { useAuth } from "../../auth/useAuth.js";
import { parseSort } from "./FilterSelect.jsx";
import { withCrm } from "../leads/CrmColumns.jsx";
import {
  countdown,
  dateTime,
  dayDate,
  fmt,
  inr,
  LeadTable,
  Pagination,
  SectionShell,
  SyncButton,
  timeAgo,
  useSheetSync,
} from "../leads/LeadKit.jsx";
import CrmLeadActions from "../crmLeads/CrmLeadActions.jsx";
import CrmRowBadge from "../crmLeads/CrmRowBadge.jsx";
import LeadFilterBar from "../leads/LeadFilterBar.jsx";
import { useLeadFilters } from "../leads/useLeadFilters.js";

// Wedding & event photography leads from the Wedding Google Sheet.

const SOURCE = "wedding";
const PAGE_SIZE = 8; // same as TAB_DEFAULTS.wedding

const SORTS = [
  { value: "submitted_at:desc", label: "Newest first" },
  { value: "event_date:asc", label: "Event date (soonest)" },
  { value: "budget_amount:desc", label: "Budget (highest)" },
  { value: "name:asc", label: "Name A–Z" },
];

const OCCASION_STYLES = {
  wedding: "bg-rose-50 text-rose-700 ring-rose-200",
  "pre-wedding": "bg-pink-50 text-pink-700 ring-pink-200",
  engagement: "bg-violet-50 text-violet-700 ring-violet-200",
  anniversary: "bg-amber-50 text-amber-700 ring-amber-200",
};

export default function WeddingLeads() {
  const { isAdmin, canSeeLeads } = useAuth();
  const [page, setPage] = useState(1);
  // Filters, kept in the URL; the same for the list, its stats and the export
  const { filters, query, queryKey, update, clear, apply, clearFilters, count } = useLeadFilters(SOURCE);
  const sortValue = filters.sort || SORTS[0].value;
  const listParams = (p) =>
    listQuery({ page: p, pageSize: PAGE_SIZE, filters: query, ...parseSort(sortValue) });
  const [data, setData] = useState(
    () => listLeads.peek(SOURCE, listParams(1)) ?? null,
  );
  const [stats, setStats] = useState(() => getLeadStats.peek(SOURCE, query) ?? null);
  const [options, setOptions] = useState(() => getFilterOptions.peek(SOURCE) ?? null);
  const [loading, setLoading] = useState(
    () => !listLeads.peek(SOURCE, listParams(1)),
  );
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const { lastSync, syncing, message, sync } = useSheetSync(isAdmin ? SOURCE : null, reload); // sheet sync: admins only

  // Any filter or sort change goes back to page 1
  useEffect(() => setPage(1), [queryKey, sortValue]);

  // Dropdown values (vendor logins: counted over their own leads)
  useEffect(() => {
    if (!canSeeLeads) return;
    getFilterOptions(SOURCE).then(setOptions).catch(() => {});
  }, [canSeeLeads, reloadKey]);

  useEffect(() => {
    if (!canSeeLeads) return;
    let cancelled = false;
    const params = listParams(page);
    const cached = listLeads.peek(SOURCE, params);
    if (cached) setData(cached);
    setLoading(!cached);
    listLeads(SOURCE, params)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setError(null);
        }
      })
      .catch(
        (err) => !cancelled && setError({ kind: "error", text: err.message }),
      )
      .finally(() => !cancelled && setLoading(false));
    getLeadStats(SOURCE, query)
      .then((s) => !cancelled && setStats(s))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSeeLeads, page, queryKey, sortValue, reloadKey]);

  if (!canSeeLeads) return null;
  const items = data?.items ?? [];

  return (
    <SectionShell
      theme="wedding"
      icon={Camera}
      title="Wedding & event photography leads"
      subtitle={
        isAdmin
          ? `Wedding sheet · last synced ${timeAgo(lastSync?.last_success?.finished_at)}${lastSync?.latest_sync?.status === "failed" ? " · last attempt failed" : ""}`
          : "Wedding sheet"
      }
      action={
        <div className="flex items-center gap-2">
          {isAdmin && <SyncButton syncing={syncing} onClick={sync} />}
          <CrmLeadActions
            source="wedding"
            exportParams={{ ...query, ...parseSort(sortValue) }}
            onChanged={reload}
          />
        </div>
      }
      message={message ?? error}
      stats={[
        { label: "Total leads", value: fmt(stats?.total) },
        {
          label: "Last 7 days",
          value: fmt(stats?.last_7_days),
          tone: stats?.last_7_days ? "emerald" : undefined,
        },
        { label: "Upcoming events", value: fmt(stats?.upcoming_events) },
        {
          label: "Not shared in sheet",
          value: fmt(stats?.not_shared),
          tone: stats?.not_shared ? "amber" : undefined,
        },
      ]}
      toolbar={
        <LeadFilterBar
          source={SOURCE}
          filters={filters}
          update={update}
          clear={clear}
          apply={apply}
          clearFilters={clearFilters}
          count={count}
          options={options}
          isAdmin={isAdmin}
          sorts={SORTS}
          sortValue={sortValue}
          placeholder="Search name, phone, city…"
        />
      }
      footer={
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={data?.total}
          onPage={setPage}
          disabled={loading}
        />
      }
    >
      <LeadTable
        theme="wedding"
        rows={items}
        rowKey={(l) => l.id}
        loading={loading && !data}
        dimmed={loading && Boolean(data)}
        identity={(l) => ({
          name: l.name ?? l.phone_display ?? "Unnamed",
          subtitle: l.email ?? l.city,
          badge: (
            <>
              {l.is_repeat ? (
                <span
                  title="This contact submitted the form earlier too"
                  className="rounded bg-gray-100 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-gray-500"
                >
                  Repeat
                </span>
              ) : null}
              <CrmRowBadge source="wedding" lead={l} />
            </>
          ),
        })}
        contact={(l) => ({ phone: l.phone, email: l.email })}
        columns={[
          {
            id: "occasion",
            header: "Occasion",
            render: (l) =>
              l.occasion && (
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${OCCASION_STYLES[l.occasion.toLowerCase()] ?? "bg-gray-100 text-gray-700 ring-gray-200"}`}
                >
                  {l.occasion}
                </span>
              ),
          },
          {
            id: "event",
            header: "Event date",
            render: (l) => {
              if (!l.event_date && !l.event_date_text) return null;
              const cd = countdown(l.event_date);
              return (
                <span>
                  <span
                    className={
                      l.event_date ? "text-gray-800" : "italic text-gray-500"
                    }
                  >
                    {l.event_date ? dayDate(l.event_date) : l.event_date_text}
                  </span>
                  {cd && (
                    <span className={`ml-1.5 text-xs ${cd.tone}`}>
                      {cd.text}
                    </span>
                  )}
                </span>
              );
            },
          },
          {
            id: "city",
            header: "City",
            render: (l) =>
              l.city && (
                <span
                  className="block max-w-[180px] truncate text-gray-700"
                  title={l.city}
                >
                  {l.city}
                </span>
              ),
          },
          {
            id: "budget",
            header: "Budget",
            align: "right",
            render: (l) =>
              l.budget_amount != null ? (
                <span className="font-semibold tabular-nums text-gray-900">
                  {inr.format(l.budget_amount)}
                </span>
              ) : (
                l.budget_text
              ),
          },
        ]}
        trailing={[
          {
            id: "submitted",
            header: "Submitted",
            render: (l) => (
              <span className="text-gray-500">{dateTime(l.submitted_at)}</span>
            ),
          },
        ]}
        source="wedding"
        crm={(l) => l.crm}
        crmKey={(l) => l.lead_key}
        context={(l) => ({ location: l.city, sheet_vendor: l.shared_with })}
        onCrmSaved={(key, crm) => setData((d) => withCrm(d, key, crm))}
        panel={(l) => ({
          sourceLabel: "Wedding lead",
          title: l.name ?? l.phone_display ?? "Lead",
          subtitle: [l.occasion, l.city].filter(Boolean).join(" · "),
          sections: [
            {
              title: "Lead details",
              rows: [
                ["Name", l.name],
                ["Phone", l.phone_display],
                ["Email", l.email],
                ["City / location", l.city],
                ["Occasion", l.occasion],
                ["Event date", l.event_date ? dayDate(l.event_date) : null],
                ["Event date (as typed)", l.event_date_text],
                [
                  "Budget",
                  l.budget_amount != null ? inr.format(l.budget_amount) : null,
                ],
                ["Budget (as typed)", l.budget_text],
              ],
            },
            {
              title: "From the sheet",
              rows: [
                ["Leads shared", l.shared_with ?? "Not shared"],
                ["OSE ID", l.oseid],
                [
                  "Repeat enquiry",
                  l.is_repeat ? "Yes, this contact applied before" : "No",
                ],
                ["Submitted", dateTime(l.submitted_at)],
                ["Sheet row", l.sheet_row],
              ],
            },
          ],
        })}
        empty={
          count || filters.search
            ? "No leads match these filters."
            : "No leads yet. Click “Sync now” to copy them from the sheet."
        }
      />
    </SectionShell>
  );
}
