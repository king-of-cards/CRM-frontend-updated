import { lazy, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BadgeCheck,
  ThumbsDown,
  ThumbsUp,
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  CalendarHeart,
  Camera,
  ClipboardList,
  Globe,
  Handshake,
  Inbox,
  IndianRupee,
  Flame,
  Send,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import DashboardLayout from "../components/layout/DashboardLayout.jsx";
import WelcomeIntro from "../components/layout/WelcomeIntro.jsx";
import { useAuth } from "../auth/useAuth.js";
import { getDashboardOverview, listLatest } from "../api/dashboard.js";
import { listSheetSources } from "../api/sheets.js";
import { prefetchTabs } from "../api/prefetch.js";
import NotLinkedVendor from "../components/leads/NotLinkedVendor.jsx";
import PeriodFilter from "../components/dashboard/PeriodFilter.jsx";
import { BarList, Kpi, Panel, SeriesToggles, toggled } from "../components/dashboard/DashboardParts.jsx";
import FollowUpsCard from "../components/dashboard/FollowUpsCard.jsx";
import TopCities from "../components/dashboard/TopCities.jsx";
import { periodFromSearch, periodLabel, periodText, todayIst } from "./dashboardPeriod.js";
import { outcomeCells, outcomeLink, sourceKpiDestinations } from "./dashboardOutcomes.js";
import VendorToKocDashboard from "./VendorToKocDashboard.jsx";
const DhruvaLeadsDashboard = lazy(() => import("./DhruvaLeadsDashboard.jsx"));

// Overview of every lead source, built from GET /analytics/overview, for a period
// (?from=YYYY-MM-DD&to=YYYY-MM-DD; default the last 30 days). See dashboardPeriod.js.
// Each source also has its own tab in the top bar for the full list.

const SOURCES = {
  spin: {
    label: "Spin leads",
    to: "/leads/spin",
    icon: Target,
    color: "#0ea5e9",
    tint: "bg-sky-50 text-sky-600",
    tag: "bg-sky-50 text-sky-700 ring-sky-200",
  },
  whatsapp: {
    label: "International",
    to: "/leads/international",
    icon: Globe,
    color: "#8b5cf6",
    tint: "bg-violet-50 text-violet-600",
    tag: "bg-violet-50 text-violet-700 ring-violet-200",
  },
  wedding: {
    label: "Wedding",
    to: "/leads/wedding",
    icon: Camera,
    color: "#f43f5e",
    tint: "bg-rose-50 text-rose-600",
    tag: "bg-rose-50 text-rose-700 ring-rose-200",
  },
  wedding_planner: {
    label: "Wedding planner",
    to: "/leads/wedding-planner",
    icon: ClipboardList,
    color: "#f59e0b",
    tint: "bg-amber-50 text-amber-600",
    tag: "bg-amber-50 text-amber-700 ring-amber-200",
  },
};
const SOURCE_KEYS = Object.keys(SOURCES);

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const fmt = (n) => (n == null ? "—" : n.toLocaleString("en-IN"));
function short(amount) {
  if (amount == null) return "—";
  if (amount >= 1e7) return `₹${+(amount / 1e7).toFixed(2)} Cr`;
  if (amount >= 1e5) return `₹${+(amount / 1e5).toFixed(1)} L`;
  return inr.format(amount);
}

// Leads per day (1 decimal from the API)

// A money figure only when the period has values for it, else "—" (not ₹0)
const money = (stats, key) => (stats?.count ? short(stats[key]) : "—");

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function timeAgo(iso) {
  if (!iso) return "never";
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

const valueOf = (r) => (r.status === "fulfilled" ? r.value : null);

// The dashboard's requests for a period: load(refresh) and peek() (the browser cache).
// The overview and the "Latest leads" lists take the period; the sheet sync status doesn't.
function requestsFor({ all, from, to }) {
  // All time: period=all for the overview; the lists need no dates for it
  const p = all ? {} : { dateFrom: from, dateTo: to };
  const o = all ? { period: "all" } : p;
  return {
    overview: {
      load: (refresh) => getDashboardOverview({ ...o, refresh }),
      peek: () => getDashboardOverview.peek(o),
    },
    sources: { load: () => listSheetSources(), peek: () => listSheetSources.peek() },
    waList: { load: () => listLatest("whatsapp", p), peek: () => listLatest.peek("whatsapp", p) },
    wdList: { load: () => listLatest("wedding", p), peek: () => listLatest.peek("wedding", p) },
    wpList: {
      load: () => listLatest("wedding_planner", p),
      peek: () => listLatest.peek("wedding_planner", p),
    },
  };
}

// Everything this tab has seen for the period, or null
function cachedDashboard(period) {
  const data = Object.fromEntries(
    Object.entries(requestsFor(period)).map(([k, r]) => [k, r.peek() ?? null]),
  );
  return data.overview ? data : null;
}


// ── Building blocks ────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, labelFormat }) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => p.value);
  return (
    <div className="rounded-xl bg-white/95 px-3 py-2 text-xs shadow-lg ring-1 ring-gray-100 backdrop-blur">
      <p className="mb-1 font-semibold text-gray-900">
        {labelFormat ? labelFormat(label, payload[0]?.payload) : label}
      </p>
      {rows.length === 0 && <p className="text-gray-500">No leads</p>}
      {rows.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-gray-600">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: p.color }}
          />
          {SOURCES[p.dataKey]?.label ?? p.dataKey}
          <span className="ml-auto pl-3 font-semibold tabular-nums text-gray-900">
            {p.value}
          </span>
        </p>
      ))}
    </div>
  );
}

function Legend({ keys }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {keys.map((k) => (
        <span
          key={k}
          className="flex items-center gap-1.5 text-xs text-gray-500"
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: SOURCES[k].color }}
          />
          {SOURCES[k].label}
        </span>
      ))}
    </div>
  );
}

const dayLabel = (d) =>
  new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
// "2026-11-01" -> "Nov 2026" (monthly Lead inflow tooltip)
const monthName = (d) =>
  new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
  });
const monthLabel = (m) =>
  new Date(`${m}-01T00:00:00`).toLocaleDateString("en-IN", {
    month: "short",
    year: "2-digit",
  });

// ── Page ───────────────────────────────────────────────────────────────
export default function Dashboard() {
  const location = useLocation();
  const { user, isAdmin, canSeeLeads, isDhruva } = useAuth();
  const firstName = user?.name?.split(" ")[0];
  const [showIntro, setShowIntro] = useState(
    Boolean(location.state?.fromLogin),
  );
  const hideIntro = useCallback(() => setShowIntro(false), []);

  // The period, kept in the URL (?from=&to=) so a reload or a shared link keeps it
  const [searchParams, setSearchParams] = useSearchParams();
  const todayDate = todayIst();
  const periodParam = searchParams.get("period") ?? "";
  const fromParam = searchParams.get("from") ?? "";
  const toParam = searchParams.get("to") ?? "";
  const period = useMemo(
    () =>
      periodFromSearch(
        new URLSearchParams({ period: periodParam, from: fromParam, to: toParam }),
        todayDate,
      ),
    [periodParam, fromParam, toParam, todayDate],
  );
  // Lead flow: kept in the URL with the period (switched from the top bar, see DashboardLayout)
  // Dhruva logins always stay on the Dhruva flow
  const rawFlow = searchParams.get("flow");
  const flow = isDhruva ? "dhruva" : rawFlow === "vendors" ? "vendors" : rawFlow === "dhruva" ? "dhruva" : "";
  useEffect(() => {
    if (!isDhruva || rawFlow === "dhruva") return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("flow", "dhruva");
      return next;
    }, { replace: true });
  }, [isDhruva, rawFlow, setSearchParams]);
  const setPeriod = useCallback(
    (next) =>
      setSearchParams({
        ...(next.all ? { period: "all" } : { from: next.from, to: next.to }),
        ...(flow ? { flow } : {}),
      }),
    [setSearchParams, flow],
  );
  // Show the last numbers instantly (if this tab has seen them), then refresh in the background
  const [state, setState] = useState(() => {
    const data = cachedDashboard(period);
    return { loading: !data, refreshing: Boolean(data), data, error: null };
  });
  const [refreshKey, setRefreshKey] = useState(0);
  // Lead inflow: unticked sources (not kept in the URL)
  const [hiddenSources, setHiddenSources] = useState(() => new Set());
  const [kpiChooser, setKpiChooser] = useState(null);

  useEffect(() => {
    if (!canSeeLeads && !isDhruva) {
      setState({ loading: false, data: null });
      return;
    }
    if (flow) return; // Vendor and Dhruva dashboards load their own data.
    let cancelled = false;
    const requests = requestsFor(period);
    const cached = cachedDashboard(period);
    setState((s) => ({
      ...s,
      data: cached ?? s.data,
      loading: !(cached ?? s.data),
      refreshing: true,
    }));
    // Vendor logins: no sheet sync status (admin only), so it isn't requested
    const keys = Object.keys(requests).filter((k) => isAdmin || k !== "sources");
    Promise.allSettled(
      keys.map((k) => requests[k].load(refreshKey > 0)),
    ).then((results) => {
      if (cancelled) return;
      const fresh = Object.fromEntries(
        keys.map((k, i) => [k, valueOf(results[i])]),
      );
      // A period the API rejects (400): show its reason
      const failed = results[keys.indexOf("overview")];
      const error =
        failed.status === "rejected" && failed.reason?.status === 400
          ? failed.reason.message
          : null;
      setState((prev) => ({
        loading: false,
        refreshing: false,
        error,
        // keep an older value if one request failed this time
        data: Object.fromEntries(
          keys.map((k) => [k, fresh[k] ?? prev.data?.[k] ?? null]),
        ),
      }));
      prefetchTabs({ sheets: isAdmin }); // get the other tabs ready while the user looks at the dashboard
    });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, canSeeLeads, isDhruva, refreshKey, period, flow]);

  const { loading, refreshing, data } = state;
  const o = data?.overview;

  const view = useMemo(() => {
    if (!o) return null;
    // Leads that arrived in the period (spin is null when its dates couldn't be read)
    const totals = o.totals;
    const all = o.totals.all;
    const trendKeys = o.spin_available
      ? SOURCE_KEYS
      : SOURCE_KEYS.filter((k) => k !== "spin");
    // Source mix and the tiles' % bar: leads that arrived in the period
    const mixAll = (o.source_mix ?? []).filter((m) => SOURCES[m.source]);
    return {
      totals,
      all,
      trendKeys,
      share: Object.fromEntries(mixAll.map((m) => [m.source, m.pct ?? 0])),
      mix: mixAll
        .map((m) => ({
          key: m.source,
          name: SOURCES[m.source].label,
          value: m.count ?? 0,
          pct: m.pct ?? 0,
        }))
        .filter((x) => x.value > 0),
      weekly: o.period?.granularity === "week",
      monthly: o.period?.granularity === "month",
    };
  }, [o]);

  const feed = useMemo(() => {
    const items = [
      ...(data?.waList?.items ?? []).map((l) => ({
        key: `wa-${l.id}`,
        source: "whatsapp",
        title: l.phone_display,
        detail: l.country,
        at: l.submitted_at,
      })),
      ...(data?.wdList?.items ?? []).map((l) => ({
        key: `wd-${l.id}`,
        source: "wedding",
        title: l.name ?? l.phone_display,
        detail: [l.occasion, l.city].filter(Boolean).join(" · "),
        at: l.submitted_at,
      })),
      ...(data?.wpList?.items ?? []).map((l) => ({
        key: `wp-${l.id}`,
        source: "wedding_planner",
        title: l.name ?? l.plan_id,
        detail: [l.city, l.wedding_month].filter(Boolean).join(" · "),
        at: l.updated_at,
      })),
    ];
    return items
      .filter((i) => i.at)
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, 7);
  }, [data]);

  const kpiLoading = loading && !o;
  const label = periodText(period);
  const quoteChoices = sourceKpiDestinations(o?.outcomes, "quotes", period);
  const hotChoices = sourceKpiDestinations(o?.outcomes, "hot", period);
  const chooserAction = (title, choices) => choices.length === 1
    ? { to: choices[0].to }
    : choices.length > 1
      ? { onClick: () => setKpiChooser({ title, choices }) }
      : {};

  return (
    <>
      {showIntro && <WelcomeIntro onDone={hideIntro} />}
      <DashboardLayout
        title={`${greeting()}${firstName ? `, ${firstName}` : ""}`}
        description={`${label} · here's how your leads are doing`}
        actions={
          (canSeeLeads || isDhruva) && (
            <div className="flex flex-wrap items-start gap-2">
              <PeriodFilter
                period={period}
                today={todayDate}
                onChange={setPeriod}
              />
              <button
                type="button"
                onClick={() => setRefreshKey((k) => k + 1)}
                disabled={refreshing}
                className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-200 transition-colors hover:bg-gray-50 disabled:opacity-60"
              >
                <RefreshCw
                  size={14}
                  className={refreshing ? "animate-spin" : ""}
                />
                Refresh
              </button>
            </div>
          )
        }
      >
        {flow === "dhruva" && (canSeeLeads || isDhruva) && (
          <DhruvaLeadsDashboard period={period} refreshKey={refreshKey} />
        )}
        {flow === "vendors" && canSeeLeads && (
          <VendorToKocDashboard period={period} refreshKey={refreshKey} isAdmin={isAdmin} />
        )}
        {canSeeLeads && !flow && state.error && (
          <p
            role="alert"
            className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200"
          >
            {state.error}
          </p>
        )}
        {!canSeeLeads && !isDhruva ? (
          <NotLinkedVendor />
        ) : flow ? null : !loading && !o && state.error ? null : !loading && !o ? (
          <p
            role="alert"
            className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200"
          >
            Couldn't load the analytics. Check that the backend is running and
            has the /analytics endpoint.
          </p>
        ) : (
          <>
            {/* ── KPIs ── */}
            <section
              className={`mt-6 grid gap-4 sm:grid-cols-2 ${isAdmin ? "xl:grid-cols-4" : "xl:grid-cols-6"}`}
              aria-label="Key numbers"
            >
              <Kpi
                icon={Inbox}
                label="Total leads"
                value={fmt(o?.kpis?.total ?? view?.all)}
                delta={o?.change_pct?.all ?? null}
                gradient="from-brand-600 to-brand-800"
                loading={kpiLoading}
              />
              {/* The six KPIs (kpis, docs section 9): every source's leads of the period */}
              <Kpi
                icon={ThumbsUp}
                label="Interested"
                value={fmt(o?.kpis?.interested)}
                gradient="from-emerald-500 to-emerald-700"
                loading={kpiLoading}
              />
              <Kpi
                icon={ThumbsDown}
                label="Not interested"
                value={fmt(o?.kpis?.not_interested)}
                gradient="from-rose-500 to-rose-700"
                loading={kpiLoading}
              />
              <Kpi
                icon={IndianRupee}
                label="Quoted amount"
                value={o?.kpis?.quoted_count ? short(o.kpis.quoted_total) : "—"}
                gradient="from-violet-500 to-violet-700"
                loading={kpiLoading}
              />
              <Kpi
                icon={BadgeCheck}
                label="Converted"
                value={fmt(o?.kpis?.converted)}
                gradient="from-emerald-500 to-brand-700"
                loading={kpiLoading}
              />
              <Kpi
                icon={Wallet}
                label="Conversion amount"
                value={o?.kpis?.conversion_count ? short(o.kpis.conversion_total) : "—"}
                gradient="from-sky-500 to-brand-700"
                loading={kpiLoading}
              />
              {isAdmin && <Kpi
                icon={Send}
                label="Quotes sent"
                value={fmt(o?.kpis?.quotes_count)}
                {...chooserAction("Quotes sent", quoteChoices)}
                gradient="from-indigo-500 to-indigo-700"
                loading={kpiLoading}
              />}
              {isAdmin && <Kpi
                icon={Flame}
                label="Hot leads"
                value={fmt(o?.kpis?.hot_count)}
                {...chooserAction("Hot leads", hotChoices)}
                gradient="from-amber-500 to-orange-600"
                loading={kpiLoading}
              />}
            </section>

            <div className="mt-6">
              <FollowUpsCard />
            </div>

            {/* ── Sources ── */}
            <section
              className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
              aria-label="Lead sources"
            >
              {SOURCE_KEYS.map((k) => {
                const s = SOURCES[k];
                const Icon = s.icon;
                const total = view?.totals[k];
                const delta = o?.change_pct?.[k];
                const share = view?.share[k] ?? 0;
                return (
                  // The tile: its top links to the list; the outcomes row below has its own
                  // links (links can't be nested), so the tile itself is a box
                  <div
                    key={k}
                    className="group rounded-2xl bg-white p-4 ring-1 ring-gray-100 shadow-sm shadow-gray-200/60 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-gray-200/80"
                  >
                  <Link to={s.to} className="flex items-center gap-4">
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${s.tint}`}
                    >
                      <Icon size={20} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center justify-between text-sm font-semibold text-gray-900">
                        {s.label}
                        <ArrowUpRight
                          size={15}
                          className="text-gray-300 transition-colors group-hover:text-gray-900"
                          aria-hidden="true"
                        />
                      </p>
                      <p className="mt-0.5 flex items-baseline gap-2">
                        <span className="text-xl font-bold tabular-nums text-gray-900">
                          {fmt(total)}
                        </span>
                        {delta != null && (k !== "spin" || o?.spin_available) ? (
                          <span
                            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                              delta >= 0
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-rose-50 text-rose-700"
                            }`}
                          >
                            {delta >= 0 ? (
                              <ArrowUpRight size={12} />
                            ) : (
                              <ArrowDownRight size={12} />
                            )}
                            {Math.abs(delta)}%
                          </span>
                        ) : null}
                      </p>
                      <div
                        className="mt-2 h-1 overflow-hidden rounded-full bg-gray-100"
                        aria-hidden="true"
                      >
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${share}%`, background: s.color }}
                        />
                      </div>
                    </div>
                  </Link>

                  {/* CRM outcomes of the period's leads; each value opens the filtered list */}
                  <dl className="mt-3 grid grid-cols-2 gap-x-2 gap-y-2.5 border-t border-gray-100 pt-3">
                    {outcomeCells(o?.outcomes?.[k]).map((c) => (
                      <div key={c.key} className="min-w-0">
                        <dt className="truncate text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                          {c.label}
                        </dt>
                        <dd className="mt-0.5 truncate text-sm font-semibold tabular-nums text-gray-900">
                          {c.filter ? (
                            <Link
                              to={outcomeLink(s.to, c.filter, period)}
                              title={`Open these ${s.label} leads`}
                              className="hover:text-brand-700 hover:underline"
                            >
                              {c.text}
                            </Link>
                          ) : (
                            <span className="text-gray-300">{c.text}</span>
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  </div>
                );
              })}
            </section>

            {/* ── Inflow + mix ── */}
            <div className="mt-6 grid gap-4 xl:grid-cols-[2fr_1fr]">
              <Panel
                title="Lead inflow"
                subtitle={`New leads per ${view?.monthly ? "month" : view?.weekly ? "week (7-day buckets)" : "day"} · ${label}`}
                icon={TrendingUp}
              >
                {view && (
                  <SeriesToggles
                    series={view.trendKeys.map((k) => ({ key: k, label: SOURCES[k].label, color: SOURCES[k].color }))}
                    hidden={hiddenSources}
                    onToggle={(k) => setHiddenSources((h) => toggled(h, k))}
                  />
                )}
                <div className="h-64">
                  {o && !view.trendKeys.some((k) => !hiddenSources.has(k)) ? (
                    <p className="flex h-full items-center justify-center text-sm text-gray-500">
                      Select at least one source
                    </p>
                  ) : o && (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={o.trend}
                        margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
                      >
                        <defs>
                          {view.trendKeys.map((k) => (
                            <linearGradient
                              key={k}
                              id={`fill-${k}`}
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="0%"
                                stopColor={SOURCES[k].color}
                                stopOpacity={0.35}
                              />
                              <stop
                                offset="100%"
                                stopColor={SOURCES[k].color}
                                stopOpacity={0.02}
                              />
                            </linearGradient>
                          ))}
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#f1f5f9"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(d) =>
                            view.monthly ? monthLabel(String(d).slice(0, 7)) : dayLabel(d)
                          }
                          tick={{ fontSize: 11, fill: "#9ca3af" }}
                          axisLine={false}
                          tickLine={false}
                          minTickGap={24}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 11, fill: "#9ca3af" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          content={
                            <ChartTooltip
                              labelFormat={(d, point) =>
                                view.monthly
                                  ? monthName(d)
                                  : view.weekly
                                    ? periodLabel(d, point?.end ?? d)
                                    : dayLabel(d)
                              }
                            />
                          }
                        />
                        {view.trendKeys.filter((k) => !hiddenSources.has(k)).map((k) => (
                          <Area
                            key={k}
                            type="monotone"
                            dataKey={k}
                            stackId="1"
                            stroke={SOURCES[k].color}
                            strokeWidth={2}
                            fill={`url(#fill-${k})`}
                          />
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Panel>

              <Panel
                title="Source mix"
                subtitle="Share of the period's leads"
                icon={Sparkles}
              >
                <div className="relative h-52">
                  {view && (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={view.mix}
                          dataKey="value"
                          nameKey="name"
                          innerRadius="62%"
                          outerRadius="90%"
                          paddingAngle={3}
                          stroke="none"
                        >
                          {view.mix.map((m) => (
                            <Cell key={m.key} fill={SOURCES[m.key].color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v, n) => [fmt(v), n]} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold tabular-nums text-gray-900">
                      {fmt(view?.all)}
                    </span>
                    <span className="text-xs text-gray-500">in period</span>
                  </div>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {view?.mix.map((m) => (
                    <li key={m.key} className="flex items-center gap-2 text-sm">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: SOURCES[m.key].color }}
                      />
                      <span className="text-gray-600">{m.name}</span>
                      <span className="ml-auto tabular-nums font-medium text-gray-900">
                        {fmt(m.value)}
                      </span>
                      <span className="w-10 text-right tabular-nums text-xs text-gray-400">
                        {m.pct}%
                      </span>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>

            {/* ── Upcoming + budgets ── */}
            <div className="mt-6 grid gap-4 xl:grid-cols-[2fr_1fr]">
              <Panel
                title="Upcoming events by month"
                subtitle="When your leads' weddings and events happen"
                icon={CalendarHeart}
                right={
                  o && (
                    <Legend
                      keys={SOURCE_KEYS.filter(
                        (k) => k !== "spin" || o.spin_available,
                      )}
                    />
                  )
                }
              >
                <div className="h-64">
                  {o && (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={o.upcoming_by_month}
                        margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#f1f5f9"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="month"
                          tickFormatter={monthLabel}
                          tick={{ fontSize: 11, fill: "#9ca3af" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 11, fill: "#9ca3af" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          content={<ChartTooltip labelFormat={monthLabel} />}
                          cursor={{ fill: "#f8fafc" }}
                        />
                        {SOURCE_KEYS.filter(
                          (k) => k !== "spin" || o.spin_available,
                        ).map((k, i, arr) => (
                          <Bar
                            key={k}
                            dataKey={k}
                            stackId="a"
                            fill={SOURCES[k].color}
                            radius={i === arr.length - 1 ? [6, 6, 0, 0] : 0}
                            maxBarSize={36}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Panel>

              <Panel
                title="Budgets & size"
                subtitle="Wedding and Wedding planner leads"
                icon={IndianRupee}
              >
                <dl className="grid grid-cols-2 gap-3">
                  {[
                    {
                      label: "Avg photography budget",
                      value: money(o?.photography_budget, "average"),
                      sub: `${fmt(o?.photography_budget.count)} leads gave one`,
                    },
                    {
                      // wedding_budget is no longer returned; budget_fit is
                      label: "Plans over budget",
                      value: fmt(o?.budget_fit?.over ?? null),
                      sub: `of ${fmt((o?.budget_fit?.fits ?? 0) + (o?.budget_fit?.over ?? 0))} estimated plans`,
                    },
                    {
                      label: "Avg guests per wedding",
                      value: fmt(o?.guests?.average ?? null),
                      sub: `${fmt(o?.guests.total)} guests in all`,
                    },
                    {
                      label: "Repeat enquiries",
                      value: fmt(o?.repeats),
                      sub: "Same contact again",
                    },
                  ].map((x) => (
                    <div
                      key={x.label}
                      className="rounded-xl bg-gray-50 px-3 py-3"
                    >
                      <dt className="text-[11px] text-gray-500">{x.label}</dt>
                      <dd className="mt-1 text-lg font-bold tabular-nums text-gray-900">
                        {x.value}
                      </dd>
                      <dd className="text-[11px] text-gray-400">{x.sub}</dd>
                    </div>
                  ))}
                </dl>
                {o && (o.budget_fit.fits || o.budget_fit.over) ? (
                  <div className="mt-4">
                    <p className="text-xs font-medium text-gray-600">
                      Plans vs budget
                    </p>
                    <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="bg-emerald-500"
                        style={{ flex: o.budget_fit.fits ?? 0 }}
                      />
                      <div
                        className="bg-rose-500"
                        style={{ flex: o.budget_fit.over ?? 0 }}
                      />
                      <div
                        className="bg-gray-200"
                        style={{ flex: o.budget_fit.unknown ?? 0 }}
                      />
                    </div>
                    <p className="mt-1.5 flex gap-4 text-[11px] text-gray-500">
                      <span className="text-emerald-600">
                        {fmt(o.budget_fit.fits ?? 0)} fit
                      </span>
                      <span className="text-rose-600">
                        {fmt(o.budget_fit.over ?? 0)} over
                      </span>
                      {o.budget_fit.unknown ? (
                        <span>{fmt(o.budget_fit.unknown)} not estimated</span>
                      ) : null}
                    </p>
                  </div>
                ) : null}
              </Panel>
            </div>

            {/* ── Where and what ── */}
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <TopCities rows={o?.top_cities} sources={o?.top_cities_sources} />
              <Panel
                title="Top countries"
                subtitle="International leads"
                icon={Globe}
              >
                <BarList
                  items={o?.top_countries}
                  color="from-violet-400 to-violet-600"
                />
              </Panel>
              <Panel
                title="Occasions"
                subtitle="What leads are planning"
                icon={CalendarHeart}
              >
                <BarList
                  items={o?.occasions}
                  color="from-rose-400 to-rose-600"
                />
              </Panel>
            </div>

            {/* ── Latest + partners ── */}
            <div className="mt-6 grid gap-4 xl:grid-cols-[2fr_1fr]">
              <Panel
                title="Latest leads"
                subtitle="International · Wedding · Wedding planner"
                icon={Sparkles}
                flush
              >
                <ul className="divide-y divide-gray-100">
                  {feed.map((item) => {
                    const s = SOURCES[item.source];
                    return (
                      <li key={item.key}>
                        <Link
                          to={s.to}
                          className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-gray-50"
                        >
                          <span
                            className={`w-[118px] shrink-0 rounded-full px-2.5 py-0.5 text-center text-xs font-medium ring-1 ${s.tag}`}
                          >
                            {s.label}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-gray-900">
                              {item.title}
                            </span>
                            {item.detail && (
                              <span className="block truncate text-xs text-gray-500">
                                {item.detail}
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 text-xs text-gray-400">
                            {timeAgo(item.at)}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                  {!loading && feed.length === 0 && (
                    <li className="px-5 py-8 text-center text-sm text-gray-500">
                      No leads yet.
                    </li>
                  )}
                </ul>
              </Panel>

              <Panel
                title="Partners"
                subtitle="Who your wedding leads went to"
                icon={Handshake}
              >
                <BarList items={o?.partners} empty="Nothing shared yet" />
                {o?.sharing.not_shared ? (
                  <div className="mt-4 flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2.5 text-sm">
                    <span className="font-medium text-amber-800">
                      Not shared yet
                    </span>
                    <span className="tabular-nums font-semibold text-amber-800">
                      {fmt(o.sharing.not_shared)}
                    </span>
                  </div>
                ) : null}
              </Panel>
            </div>

            {o && (
              <p className="mt-6 text-center text-xs text-gray-400">
                Updated {timeAgo(o.generated_at)}
                {!o.spin_available &&
                  " · spin leads are counted, but their dates couldn't be read for the charts"}
              </p>
            )}
          </>
        )}
        {kpiChooser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`${kpiChooser.title} source choices`}>
            <button type="button" aria-label="Close" onClick={() => setKpiChooser(null)} className="absolute inset-0 bg-gray-900/35 backdrop-blur-sm" />
            <section className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-gray-200">
              <div className="mb-3 flex items-center justify-between"><h2 className="text-base font-semibold text-gray-900">{kpiChooser.title}</h2><button type="button" onClick={() => setKpiChooser(null)} className="rounded-full px-2 py-1 text-sm text-gray-500 hover:bg-gray-100">Close</button></div>
              <ul className="divide-y divide-gray-100">
                {kpiChooser.choices.map((choice) => <li key={choice.source}><Link onClick={() => setKpiChooser(null)} to={choice.to} className="flex items-center justify-between py-3 text-sm hover:text-brand-700"><span>{choice.label}</span><span className="font-semibold tabular-nums">{fmt(choice.count)}</span></Link></li>)}
              </ul>
            </section>
          </div>
        )}
      </DashboardLayout>
    </>
  );
}
