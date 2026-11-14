import { useCallback, useEffect, useState } from "react";
import { Globe } from "lucide-react";
import {
  getWhatsAppLeadStats,
  listWhatsAppLeads,
} from "../../api/whatsappLeads.js";
import { TAB_DEFAULTS } from "../../api/prefetch.js";
import { useAuth } from "../../auth/useAuth.js";
import FilterSelect, { parseSort } from "./FilterSelect.jsx";
import { withCrm } from "../leads/CrmColumns.jsx";
import {
  countdown,
  dateTime,
  dayDate,
  fmt,
  LeadTable,
  Pagination,
  SearchBox,
  SectionShell,
  SyncButton,
  timeAgo,
  useDebounced,
  useSheetSync,
} from "../leads/LeadKit.jsx";

// International leads (WhatsApp numbers) from the International Google Sheet.

const SOURCE = "whatsapp"; // name in GOOGLE_SHEETS (backend .env)
const PAGE_SIZE = 8; // same as TAB_DEFAULTS.whatsapp, so prefetched pages are reused

const SORTS = [
  { value: "submitted_at:desc", label: "Newest first" },
  { value: "submitted_at:asc", label: "Oldest first" },
  { value: "event_date:asc", label: "Event date (soonest)" },
  { value: "country:asc", label: "Country A–Z" },
];

export default function WhatsAppLeads() {
  const { isAdmin } = useAuth();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput.trim());
  const [country, setCountry] = useState("");
  const [sortValue, setSortValue] = useState(SORTS[0].value);
  const [data, setData] = useState(
    () => listWhatsAppLeads.peek(TAB_DEFAULTS.whatsapp) ?? null,
  );
  const [stats, setStats] = useState(() => getWhatsAppLeadStats.peek() ?? null);
  const [loading, setLoading] = useState(
    () => !listWhatsAppLeads.peek(TAB_DEFAULTS.whatsapp),
  );
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const { lastSync, syncing, message, sync } = useSheetSync(SOURCE, reload);

  useEffect(() => setPage(1), [search, country, sortValue]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    const params = {
      page,
      pageSize: PAGE_SIZE,
      search,
      country: country || undefined,
      ...parseSort(sortValue),
    };
    const cached = listWhatsAppLeads.peek(params);
    if (cached) setData(cached);
    setLoading(!cached);
    listWhatsAppLeads(params)
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
    getWhatsAppLeadStats()
      .then((s) => !cancelled && setStats(s))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAdmin, page, search, country, sortValue, reloadKey]);

  if (!isAdmin) return null;
  const items = data?.items ?? [];

  return (
    <SectionShell
      theme="whatsapp"
      icon={Globe}
      title="International leads"
      subtitle={`International sheet · last synced ${timeAgo(lastSync?.last_success?.finished_at)}${lastSync?.latest_sync?.status === "failed" ? " · last attempt failed" : ""}`}
      action={<SyncButton syncing={syncing} onClick={sync} />}
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
        <>
          <SearchBox
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search country, number or date"
          />
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <FilterSelect
              label="Country"
              value={country}
              onChange={setCountry}
              options={[
                { value: "", label: "All countries" },
                ...(stats?.top_countries ?? []).map((c) => ({
                  value: c.country,
                  label: `${c.country} (${c.count})`,
                })),
              ]}
            />
            <FilterSelect
              label="Sort"
              value={sortValue}
              onChange={setSortValue}
              options={SORTS}
            />
          </div>
        </>
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
        theme="whatsapp"
        rows={items}
        rowKey={(l) => l.id}
        loading={loading && !data}
        dimmed={loading && Boolean(data)}
        identity={(l) => ({ name: l.phone_display, subtitle: l.country })}
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
          search || country
            ? "No leads match these filters."
            : "No leads yet. Click “Sync now” to copy them from the sheet."
        }
      />
    </SectionShell>
  );
}
