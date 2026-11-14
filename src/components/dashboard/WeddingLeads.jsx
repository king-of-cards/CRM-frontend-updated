import { useCallback, useEffect, useState } from "react";
import { Camera } from "lucide-react";
import {
  getWeddingLeadStats,
  listWeddingLeads,
} from "../../api/weddingLeads.js";
import { TAB_DEFAULTS } from "../../api/prefetch.js";
import { useAuth } from "../../auth/useAuth.js";
import FilterSelect, { parseSort } from "./FilterSelect.jsx";
import { withCrm } from "../leads/CrmColumns.jsx";
import {
  countdown,
  dateTime,
  dayDate,
  fmt,
  inr,
  LeadTable,
  Pagination,
  SearchBox,
  SectionShell,
  SyncButton,
  Tabs,
  timeAgo,
  useDebounced,
  useSheetSync,
} from "../leads/LeadKit.jsx";

// Wedding & event photography leads from the Wedding Google Sheet.

const SOURCE = "wedding";
const PAGE_SIZE = 8; // same as TAB_DEFAULTS.wedding
const NOT_SHARED = "__none__";

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
  const { isAdmin } = useAuth();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput.trim());
  const [occasion, setOccasion] = useState("");
  const [sharedWith, setSharedWith] = useState("");
  const [hideRepeats, setHideRepeats] = useState(false);
  const [sortValue, setSortValue] = useState(SORTS[0].value);
  const [data, setData] = useState(
    () => listWeddingLeads.peek(TAB_DEFAULTS.wedding) ?? null,
  );
  const [stats, setStats] = useState(() => getWeddingLeadStats.peek() ?? null);
  const [loading, setLoading] = useState(
    () => !listWeddingLeads.peek(TAB_DEFAULTS.wedding),
  );
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const { lastSync, syncing, message, sync } = useSheetSync(SOURCE, reload);

  useEffect(
    () => setPage(1),
    [search, occasion, sharedWith, hideRepeats, sortValue],
  );

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    const params = {
      page,
      pageSize: PAGE_SIZE,
      search,
      occasion: occasion || undefined,
      sharedWith: sharedWith || undefined,
      hideRepeats,
      ...parseSort(sortValue),
    };
    const cached = listWeddingLeads.peek(params);
    if (cached) setData(cached);
    setLoading(!cached);
    listWeddingLeads(params)
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
    getWeddingLeadStats()
      .then((s) => !cancelled && setStats(s))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [
    isAdmin,
    page,
    search,
    occasion,
    sharedWith,
    hideRepeats,
    sortValue,
    reloadKey,
  ]);

  if (!isAdmin) return null;
  const items = data?.items ?? [];

  return (
    <SectionShell
      theme="wedding"
      icon={Camera}
      title="Wedding & event photography leads"
      subtitle={`Wedding sheet · last synced ${timeAgo(lastSync?.last_success?.finished_at)}${lastSync?.latest_sync?.status === "failed" ? " · last attempt failed" : ""}`}
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
        {
          label: "Not shared in sheet",
          value: fmt(stats?.not_shared),
          tone: stats?.not_shared ? "amber" : undefined,
        },
      ]}
      toolbar={
        <>
          <SearchBox
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search name, phone, city…"
          />
          <Tabs
            label="Occasion"
            value={occasion}
            onChange={setOccasion}
            options={[
              { value: "", label: "All" },
              ...(stats?.occasions ?? []).map((o) => ({
                value: o.value,
                label: o.value,
                count: o.count,
              })),
            ]}
          />
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <FilterSelect
              label="Sheet partner"
              value={sharedWith}
              onChange={setSharedWith}
              options={[
                { value: "", label: "Anyone" },
                { value: NOT_SHARED, label: "Not shared yet" },
                ...(stats?.shared_with ?? []).map((s) => ({
                  value: s.value,
                  label: `${s.value} (${s.count})`,
                })),
              ]}
            />
            <FilterSelect
              label="Sort"
              value={sortValue}
              onChange={setSortValue}
              options={SORTS}
            />
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={hideRepeats}
                onChange={(e) => setHideRepeats(e.target.checked)}
                className="h-4 w-4 accent-brand-600"
              />
              Hide repeats{stats?.repeats ? ` (${stats.repeats})` : ""}
            </label>
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
        theme="wedding"
        rows={items}
        rowKey={(l) => l.id}
        loading={loading && !data}
        dimmed={loading && Boolean(data)}
        identity={(l) => ({
          name: l.name ?? l.phone_display ?? "Unnamed",
          subtitle: l.email ?? l.city,
          badge: l.is_repeat ? (
            <span
              title="This contact submitted the form earlier too"
              className="rounded bg-gray-100 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-gray-500"
            >
              Repeat
            </span>
          ) : null,
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
          search || occasion || sharedWith || hideRepeats
            ? "No leads match these filters."
            : "No leads yet. Click “Sync now” to copy them from the sheet."
        }
      />
    </SectionShell>
  );
}
