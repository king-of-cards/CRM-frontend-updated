import { useCallback, useEffect, useState } from "react";
import { Globe } from "lucide-react";
import { getFilterOptions, getLeadStats, listLeads, listQuery } from "../../api/leadLists.js";
import { useAuth } from "../../auth/useAuth.js";
import { parseSort } from "./FilterSelect.jsx";
import { withCrm } from "../leads/CrmColumns.jsx";
import {
  countdown,
  dateTime,
  dayDate,
  fmt,
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

// International leads (WhatsApp numbers) from the International Google Sheet.

const SOURCE = "whatsapp"; // name in GOOGLE_SHEETS (backend .env)
const PAGE_SIZE = 10; // the default page size (10 / 25 / 50 / 100); same as TAB_DEFAULTS, so prefetched pages are reused

const SORTS = [
  { value: "submitted_at:desc", label: "Newest first" },
  { value: "submitted_at:asc", label: "Oldest first" },
  { value: "event_date:asc", label: "Event date (soonest)" },
  { value: "country:asc", label: "Country A–Z" },
];

export default function WhatsAppLeads() {
  const { isAdmin, canSeeLeads } = useAuth();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  // Filters, kept in the URL; the same for the list, its stats and the export
  const { filters, query, queryKey, update, clear, apply, clearFilters, count } = useLeadFilters(SOURCE);
  const sortValue = filters.sort || SORTS[0].value;
  const listParams = (p) =>
    listQuery({ page: p, pageSize, filters: query, ...parseSort(sortValue) });
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
  useEffect(() => setPage(1), [queryKey, sortValue, pageSize]);

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
  }, [canSeeLeads, page, pageSize, queryKey, sortValue, reloadKey]);

  if (!canSeeLeads) return null;
  const items = data?.items ?? [];

  return (
    <SectionShell
      theme="whatsapp"
      icon={Globe}
      title="International leads"
      subtitle={
        isAdmin
          ? `International sheet · last synced ${timeAgo(lastSync?.last_success?.finished_at)}${lastSync?.latest_sync?.status === "failed" ? " · last attempt failed" : ""}`
          : "International sheet"
      }
      action={
        <div className="flex items-center gap-2">
          {isAdmin && <SyncButton syncing={syncing} onClick={sync} />}
          <CrmLeadActions
            source="whatsapp"
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
          placeholder="Search country, number or date"
        />
      }
      footer={
        <Pagination
          page={page}
          pageSize={pageSize}
          onPageSize={setPageSize}
          total={data?.total}
          onPage={setPage}
          disabled={loading}
        />
      }
    >
      <LeadTable
        theme="whatsapp"
        rows={items}
        rowKey={(l) => l.id}
        loading={loading && !data}
        dimmed={loading && Boolean(data)}
        identity={(l) => ({
          name: l.phone_display,
          subtitle: l.country,
          badge: <CrmRowBadge source="whatsapp" lead={l} />,
        })}
        contact={(l) => ({ phone: l.phone })}
        columns={[
          {
            id: "country",
            header: "Country",
            render: (l) =>
              l.country && <span className="text-gray-800">{l.country}</span>,
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
        source="whatsapp"
        crm={(l) => l.crm}
        crmKey={(l) => l.lead_key}
        context={(l) => ({ location: l.country })}
        onCrmSaved={(key, crm) => setData((d) => withCrm(d, key, crm))}
        panel={(l) => ({
          sourceLabel: "International lead",
          title: l.phone_display,
          subtitle: [
            l.country,
            l.event_date ? dayDate(l.event_date) : l.event_date_text,
          ]
            .filter(Boolean)
            .join(" · "),
          sections: [
            {
              title: "Lead details",
              rows: [
                ["WhatsApp number", l.phone_display],
                ["Country", l.country],
                ["Event date", l.event_date ? dayDate(l.event_date) : null],
                ["Event date (as typed)", l.event_date_text],
                ["Submitted", dateTime(l.submitted_at)],
                ["First seen in CRM", dateTime(l.first_seen_at)],
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
