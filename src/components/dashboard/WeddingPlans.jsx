import { useCallback, useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
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
  shortMoney,
  SyncButton,
  timeAgo,
  useSheetSync,
} from "../leads/LeadKit.jsx";
import CrmLeadActions from "../crmLeads/CrmLeadActions.jsx";
import CrmRowBadge from "../crmLeads/CrmRowBadge.jsx";
import LeadFilterBar from "../leads/LeadFilterBar.jsx";
import { useLeadFilters } from "../leads/useLeadFilters.js";

// Wedding plans from the Wedding planner Google Sheet (latest save per Plan ID).

const SOURCE = "wedding_planner";
const PAGE_SIZE = 8; // same as TAB_DEFAULTS.planner

const SORTS = [
  { value: "updated:desc", label: "Recently updated" },
  { value: "wedding_date:asc", label: "Wedding date (soonest)" },
  { value: "total_budget:desc", label: "Budget (highest)" },
  { value: "plan_estimate:desc", label: "Estimate (highest)" },
  { value: "total_guests:desc", label: "Guests (most)" },
];

const STEP_STYLES = {
  pdf: "bg-sky-50 text-sky-700 ring-sky-200",
  whatsapp: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

const yesNo = (v) => (v == null ? null : v ? "Yes" : "No");

// The plan's events, shown in the side panel above the other details
function PlanEvents({ plan }) {
  return (
    <section>
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-brand-700">
        Events ({plan.events.length})
      </h3>
      {plan.events.length ? (
        <ol className="mt-2 space-y-1.5">
          {plan.events.map((ev, i) => (
            <li
              key={i}
              className="rounded-2xl bg-white/80 px-4 py-2.5 text-sm ring-1 ring-gray-100"
            >
              <p className="flex items-center justify-between gap-3">
                <span className="font-semibold text-gray-900">{ev.event}</span>
                <span className="text-xs tabular-nums text-gray-600">
                  {ev.guest_count != null
                    ? `${fmt(ev.guest_count)} guests`
                    : ev.guests}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                {[ev.day, ev.time, ev.meal, ev.decor, ev.setting]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 text-sm text-gray-500">No events added yet.</p>
      )}
    </section>
  );
}

export default function WeddingPlans() {
  const { isAdmin, canSeeLeads } = useAuth();
  const [page, setPage] = useState(1);
  // Filters, kept in the URL; the same for the list, its stats and the export
  const { filters, query, queryKey, update, clear, count } = useLeadFilters(SOURCE);
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
      theme="wedding_planner"
      icon={ClipboardList}
      title="Wedding planner leads"
      subtitle={`Wedding planner sheet${isAdmin ? ` · last synced ${timeAgo(lastSync?.last_success?.finished_at)}` : ""}${
        stats?.total_budget
          ? ` · ${shortMoney(stats.total_budget)} in budgets`
          : ""
      }${isAdmin && lastSync?.latest_sync?.status === "failed" ? " · last attempt failed" : ""}`}
      action={
        <div className="flex items-center gap-2">
          {isAdmin && <SyncButton syncing={syncing} onClick={sync} />}
          <CrmLeadActions
            source="wedding_planner"
            exportParams={{ ...query, ...parseSort(sortValue) }}
            onChanged={reload}
          />
        </div>
      }
      message={message ?? error}
      stats={[
        { label: "Wedding plans", value: fmt(stats?.total) },
        {
          label: "Last 7 days",
          value: fmt(stats?.last_7_days),
          tone: stats?.last_7_days ? "emerald" : undefined,
        },
        { label: "Upcoming weddings", value: fmt(stats?.upcoming_weddings) },
        {
          label: "Over budget",
          value: fmt(stats?.over_budget),
          tone: stats?.over_budget ? "rose" : undefined,
        },
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
          count={count}
          options={options}
          isAdmin={isAdmin}
          sorts={SORTS}
          sortValue={sortValue}
          placeholder="Search name, phone, city, plan ID…"
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
        theme="wedding_planner"
        rows={items}
        rowKey={(p) => p.id}
        loading={loading && !data}
        dimmed={loading && Boolean(data)}
        identity={(p) => ({
          name: p.name ?? p.plan_id,
          subtitle: [p.role, p.email].filter(Boolean).join(" · ") || p.plan_id,
          badge: <CrmRowBadge source="wedding_planner" lead={p} leadKey={p.plan_id} />,
        })}
        contact={(p) => ({ phone: p.phone, email: p.email })}
        columns={[
          {
            id: "wedding",
            header: "Wedding",
            render: (p) => {
              const when = p.first_day ? dayDate(p.first_day) : p.wedding_month;
              if (!when && !p.city) return null;
              const cd = countdown(p.wedding_date);
              return (
                <span className="block leading-tight">
                  <span className="text-gray-800">{when ?? "—"}</span>
                  {cd && (
                    <span className={`ml-1.5 text-xs ${cd.tone}`}>
                      {cd.text}
                    </span>
                  )}
                  <span className="block text-xs text-gray-500">
                    {p.city ?? p.wedding_type ?? ""}
                  </span>
                </span>
              );
            },
          },
          {
            id: "guests",
            header: "Guests",
            align: "right",
            render: (p) =>
              p.total_guests != null && (
                <span className="block leading-tight tabular-nums">
                  <span className="text-gray-900">{fmt(p.total_guests)}</span>
                  {p.guests_staying ? (
                    <span className="block text-xs text-gray-500">
                      {p.guests_staying} staying
                    </span>
                  ) : null}
                </span>
              ),
          },
          {
            id: "budget",
            header: "Budget",
            align: "right",
            render: (p) =>
              (p.total_budget != null || p.budget_range) && (
                <span className="block leading-tight">
                  <span className="font-semibold tabular-nums text-gray-900">
                    {shortMoney(p.total_budget) ?? "—"}
                  </span>
                  {p.budget_range && (
                    <span className="block text-xs text-gray-500">
                      {p.budget_range}
                    </span>
                  )}
                </span>
              ),
          },
          {
            id: "estimate",
            header: "Estimate",
            align: "right",
            render: (p) =>
              p.plan_estimate != null && (
                <span className="block leading-tight">
                  <span className="tabular-nums text-gray-800">
                    {shortMoney(p.plan_estimate)}
                  </span>
                  {p.fits_budget != null && (
                    <span
                      className={`block text-xs font-medium ${p.fits_budget ? "text-emerald-600" : "text-rose-600"}`}
                    >
                      {p.fits_budget ? "Fits budget" : "Over budget"}
                    </span>
                  )}
                </span>
              ),
          },
        ]}
        trailing={[
          {
            id: "updated",
            header: "Updated",
            render: (p) => (
              <span className="flex items-center gap-2">
                <span className="text-gray-500">{dateTime(p.updated_at)}</span>
                {p.last_step && (
                  <span
                    className={`rounded-full px-2 py-px text-[11px] font-medium capitalize ring-1 ${STEP_STYLES[p.last_step] ?? "bg-gray-100 text-gray-600 ring-gray-200"}`}
                  >
                    {p.last_step}
                  </span>
                )}
              </span>
            ),
          },
        ]}
        source="wedding_planner"
        crm={(p) => p.crm}
        crmKey={(p) => p.plan_id}
        context={(p) => ({
          location: p.city || p.home_city,
          sheet_vendor: p.shared_with,
        })}
        onCrmSaved={(key, crm) => setData((d) => withCrm(d, key, crm))}
        panel={(p) => ({
          sourceLabel: "Wedding planner lead",
          title: p.name ?? p.plan_id,
          subtitle: [
            p.plan_id,
            p.city,
            p.first_day ? dayDate(p.first_day) : p.wedding_month,
          ]
            .filter(Boolean)
            .join(" · "),
          extra: <PlanEvents plan={p} />,
          sections: [
            {
              title: "Wedding",
              rows: [
                ["Plan ID", p.plan_id],
                ["You are the", p.role],
                ["Wedding type", p.wedding_type],
                ["Wedding city", p.city],
                ["Family home city", p.home_city],
                ["Kind of place", p.place_kind],
                ["Wedding month", p.wedding_month],
                ["First day", p.first_day ? dayDate(p.first_day) : null],
                [
                  "Total guests",
                  p.total_guests != null ? fmt(p.total_guests) : null,
                ],
                [
                  "Guests needing rooms",
                  p.guests_staying != null ? fmt(p.guests_staying) : null,
                ],
                ["Traditions", p.traditions],
                ["Food", p.food],
                ["Alcohol", p.alcohol],
                [
                  "Events",
                  p.events
                    .map((ev) =>
                      [ev.day, ev.time, ev.event, ev.guests]
                        .filter(Boolean)
                        .join(" · "),
                    )
                    .join("\n"),
                ],
              ],
            },
            {
              title: "Budget",
              rows: [
                ["Budget range", p.budget_range],
                [
                  "Total budget",
                  p.total_budget != null ? inr.format(p.total_budget) : null,
                ],
                [
                  "Plan estimate",
                  p.plan_estimate != null ? inr.format(p.plan_estimate) : null,
                ],
                ["Fits budget", yesNo(p.fits_budget)],
                [
                  "Includes jewellery & outfits",
                  yesNo(p.budget_includes_jewellery),
                ],
                [
                  "Jewellery & outfits",
                  p.jewellery_outfits != null
                    ? inr.format(p.jewellery_outfits)
                    : null,
                ],
                [
                  "Priorities",
                  p.priorities.map((x, i) => `${i + 1}. ${x}`).join("  "),
                ],
              ],
            },
            {
              title: "From the sheet",
              rows: [
                ["Step reached", p.last_step],
                ["Saves in sheet", p.versions],
                ["Last updated", dateTime(p.updated_at)],
                ["Share plan with KOC", yesNo(p.consent_share)],
                ["Offers on WhatsApp", yesNo(p.consent_offers)],
                ["Leads shared", p.shared_with ?? "Not shared"],
                ["Shortlisted vendors", p.shortlisted_vendors],
              ],
            },
          ],
        })}
        empty={
          count || filters.search
            ? "No plans match these filters."
            : "No plans yet. Click “Sync now” to copy them from the sheet."
        }
      />
    </SectionShell>
  );
}
