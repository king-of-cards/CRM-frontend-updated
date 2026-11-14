import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router";
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
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarHeart,
  Camera,
  ClipboardList,
  Globe,
  Handshake,
  Inbox,
  IndianRupee,
  MapPin,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import DashboardLayout from "../components/layout/DashboardLayout.jsx";
import WelcomeIntro from "../components/layout/WelcomeIntro.jsx";
import { useAuth } from "../auth/useAuth.js";
import { getAnalyticsOverview } from "../api/analytics.js";
import { listSheetSources } from "../api/sheets.js";
import { listSpinLeads } from "../api/spinLeads.js";
import { listWeddingLeads } from "../api/weddingLeads.js";
import { listWeddingPlans } from "../api/weddingPlans.js";
import { listWhatsAppLeads } from "../api/whatsappLeads.js";
import { prefetchTabs } from "../api/prefetch.js";

// Overview of every lead source, built from GET /analytics/overview.
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

// % change vs last week; null when there's nothing to compare
function change(now, before) {
  if (!before) return now ? null : 0;
  return Math.round(((now - before) / before) * 100);
}

const valueOf = (r) => (r.status === "fulfilled" ? r.value : null);

// The dashboard's requests (the same params are used to read the browser cache)
const REQUESTS = {
  overview: [getAnalyticsOverview, {}],
  sources: [listSheetSources, undefined],
  spin: [listSpinLeads, { page: 1, pageSize: 1 }],
  waList: [listWhatsAppLeads, { pageSize: 6 }],
  wdList: [listWeddingLeads, { pageSize: 6 }],
  wpList: [listWeddingPlans, { pageSize: 6 }],
};

// Everything from the last visit in this tab, or null
function cachedDashboard() {
  const data = Object.fromEntries(
    Object.entries(REQUESTS).map(([k, [fn, params]]) => [k, fn.peek(params) ?? null]),
  );
  return data.overview ? data : null;
}

// ── Building blocks ────────────────────────────────────────────────────
// flush: the body runs edge to edge (for lists with their own row padding)
function Panel({ title, subtitle, icon: Icon, right, flush = false, children }) {
  return (
    <section
      className={`rounded-2xl bg-white ring-1 ring-gray-100 shadow-sm shadow-gray-200/60 ${flush ? "pt-5" : "p-5"}`}
    >
      <div className={`flex items-start justify-between gap-3 ${flush ? "px-5" : ""}`}>
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
            {Icon && <Icon size={16} className="text-brand-600" aria-hidden="true" />}
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
        </div>
        {right}
      </div>
      <div className={flush ? "mt-3" : "mt-4"}>{children}</div>
    </section>
  );
}

function Kpi({ icon: Icon, label, value, caption, delta, gradient, loading }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-white p-5 ring-1 ring-gray-100 shadow-sm shadow-gray-200/60 transition-shadow hover:shadow-lg hover:shadow-gray-200/80">
      {/* Corner glow in the card's colour */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-linear-to-br opacity-15 blur-xl ${gradient}`}
      />
      <div className="relative flex items-start justify-between">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br text-white shadow-sm ${gradient}`}
        >
          <Icon size={17} aria-hidden="true" />
        </span>
      </div>
      {loading ? (
        <span className="mt-3 block h-8 w-24 animate-pulse rounded-lg bg-gray-100" />
      ) : (
        <div className="relative mt-2 flex items-baseline gap-2">
          <p className="text-3xl font-bold tracking-tight tabular-nums text-gray-900">{value}</p>
          {delta != null && (
            <span
              className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                delta >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
              }`}
            >
              {delta >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {Math.abs(delta)}%
            </span>
          )}
        </div>
      )}
      <p className="relative mt-1.5 text-xs text-gray-500">{caption}</p>
    </div>
  );
}

function BarList({ items, color = "from-brand-600 to-brand-800", empty = "No data yet" }) {
  if (!items?.length) return <p className="text-sm text-gray-500">{empty}</p>;
  const max = Math.max(...items.map((i) => i.count));
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.value}>
          <div className="flex items-center justify-between text-sm">
            <span className="truncate pr-3 text-gray-700">{i.value}</span>
            <span className="tabular-nums font-medium text-gray-900">{fmt(i.count)}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
            <div
              className={`h-full rounded-full bg-linear-to-r ${color} transition-all duration-700`}
              style={{ width: `${(i.count / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function ChartTooltip({ active, payload, label, labelFormat }) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => p.value);
  return (
    <div className="rounded-xl bg-white/95 px-3 py-2 text-xs shadow-lg ring-1 ring-gray-100 backdrop-blur">
      <p className="mb-1 font-semibold text-gray-900">{labelFormat ? labelFormat(label) : label}</p>
      {rows.length === 0 && <p className="text-gray-500">No leads</p>}
      {rows.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-gray-600">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          {SOURCES[p.dataKey]?.label ?? p.dataKey}
          <span className="ml-auto pl-3 font-semibold tabular-nums text-gray-900">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

function Legend({ keys }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {keys.map((k) => (
        <span key={k} className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="h-2 w-2 rounded-full" style={{ background: SOURCES[k].color }} />
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
const monthLabel = (m) =>
  new Date(`${m}-01T00:00:00`).toLocaleDateString("en-IN", {
    month: "short",
    year: "2-digit",
  });

// ── Page ───────────────────────────────────────────────────────────────
export default function Dashboard() {
  const location = useLocation();
  const { user, isAdmin } = useAuth();
  const firstName = user?.name?.split(" ")[0];

  // The intro plays only when coming from the login page
  const [showIntro, setShowIntro] = useState(Boolean(location.state?.fromLogin));
  const hideIntro = useCallback(() => setShowIntro(false), []);

  // Show the last numbers instantly (if this tab has seen them), then refresh in the background
  const [state, setState] = useState(() => {
    const data = cachedDashboard();
    return { loading: !data, refreshing: Boolean(data), data };
  });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!isAdmin) {
      setState({ loading: false, data: null });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: !s.data, refreshing: true }));
    const keys = Object.keys(REQUESTS);
    Promise.allSettled(
      keys.map((k) => {
        const [fn, params] = REQUESTS[k];
        return k === "overview" ? fn({ refresh: refreshKey > 0 }) : fn(params);
      }),
    ).then((results) => {
      if (cancelled) return;
      const fresh = Object.fromEntries(keys.map((k, i) => [k, valueOf(results[i])]));
      setState((prev) => ({
        loading: false,
        refreshing: false,
        // keep an older value if one request failed this time
        data: Object.fromEntries(keys.map((k) => [k, fresh[k] ?? prev.data?.[k] ?? null])),
      }));
      prefetchTabs(); // get the other tabs ready while the user looks at the dashboard
    });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, refreshKey]);

  const { loading, refreshing, data } = state;
  const o = data?.overview;

  const view = useMemo(() => {
    if (!o) return null;
    // Spin total: from analytics, or from the spin endpoint if the analytics couldn't read it
    const spinTotal = o.totals.spin ?? data?.spin?.total ?? 0;
    const totals = { ...o.totals, spin: spinTotal };
    const all = SOURCE_KEYS.reduce((sum, k) => sum + (totals[k] ?? 0), 0);
    const synced = Object.fromEntries(
      (data?.sources?.sources ?? []).map((s) => [s.source, s.last_success?.finished_at ?? null]),
    );
    const trendKeys = o.spin_available ? SOURCE_KEYS : SOURCE_KEYS.filter((k) => k !== "spin");
    return {
      totals,
      all,
      synced,
      trendKeys,
      mix: SOURCE_KEYS.map((k) => ({
        key: k,
        name: SOURCES[k].label,
        value: totals[k] ?? 0,
      })).filter((x) => x.value > 0),
      weekDelta: change(o.this_week.all, o.last_week.all),
      overBudget: o.budget_fit?.over ?? 0,
    };
  }, [o, data]);

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

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const kpiLoading = loading && !o;

  return (
    <>
      {showIntro && <WelcomeIntro onDone={hideIntro} />}
      <DashboardLayout
        title={`${greeting()}${firstName ? `, ${firstName}` : ""}`}
        description={`${today} · here's how your leads are doing`}
        actions={
          isAdmin && (
            <button
              type="button"
              onClick={() => setRefreshKey((k) => k + 1)}
              disabled={refreshing}
              className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-200 transition-colors hover:bg-gray-50 disabled:opacity-60"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
          )
        }
      >
        {!isAdmin ? (
          <div className="mt-6 rounded-2xl bg-white p-8 text-center ring-1 ring-gray-100">
            <p className="text-sm text-gray-600">Leads are visible to admins. Ask an admin if you need access.</p>
          </div>
        ) : !loading && !o ? (
          <p
            role="alert"
            className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200"
          >
            Couldn't load the analytics. Check that the backend is running and has the /analytics endpoint.
          </p>
        ) : (
          <>
            {/* ── KPIs ── */}
            <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6" aria-label="Key numbers">
              <Kpi
                icon={Inbox}
                label="Total leads"
                value={fmt(view?.all)}
                caption="Across all 4 sources"
                gradient="from-brand-600 to-brand-800"
                loading={kpiLoading}
              />
              <Kpi
                icon={TrendingUp}
                label="New this week"
                value={fmt(o?.this_week.all)}
                delta={view?.weekDelta}
                caption={`${fmt(o?.last_week.all)} the week before`}
                gradient="from-violet-500 to-violet-700"
                loading={kpiLoading}
              />
              <Kpi
                icon={CalendarHeart}
                label="Events in 30 days"
                value={fmt(o?.upcoming_30_days.all)}
                caption="Hot leads: their date is close"
                gradient="from-rose-500 to-rose-700"
                loading={kpiLoading}
              />
              <Kpi
                icon={IndianRupee}
                label="Wedding budgets"
                value={short(o?.wedding_budget.total)}
                caption={`Avg ${short(o?.wedding_budget.average)} per plan`}
                gradient="from-emerald-500 to-brand-700"
                loading={kpiLoading}
              />
              <Kpi
                icon={Handshake}
                label="Shared with partners"
                value={o?.sharing.rate != null ? `${o.sharing.rate}%` : "—"}
                caption={`${fmt(o?.sharing.shared)} of ${fmt(o?.sharing.shareable)} wedding leads`}
                gradient="from-sky-500 to-sky-700"
                loading={kpiLoading}
              />
              <Kpi
                icon={AlertCircle}
                label="Needs attention"
                value={fmt((o?.sharing.not_shared ?? 0) + (view?.overBudget ?? 0))}
                caption={`${fmt(o?.sharing.not_shared)} not shared · ${fmt(view?.overBudget)} over budget`}
                gradient="from-amber-400 to-amber-600"
                loading={kpiLoading}
              />
            </section>

            {/* ── Sources ── */}
            <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Lead sources">
              {SOURCE_KEYS.map((k) => {
                const s = SOURCES[k];
                const Icon = s.icon;
                const total = view?.totals[k];
                const week = o?.this_week[k];
                const share = view?.all ? Math.round(((total ?? 0) / view.all) * 100) : 0;
                return (
                  <Link
                    key={k}
                    to={s.to}
                    className="group flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-gray-100 shadow-sm shadow-gray-200/60 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-gray-200/80"
                  >
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${s.tint}`}>
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
                        <span className="text-xl font-bold tabular-nums text-gray-900">{fmt(total)}</span>
                        {k !== "spin" || o?.spin_available ? (
                          <span className={`text-xs ${week ? "font-medium text-emerald-600" : "text-gray-400"}`}>
                            +{fmt(week)} this week
                          </span>
                        ) : null}
                      </p>
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${share}%`, background: s.color }}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-gray-400">
                        {share}% of leads · {k === "spin" ? "live" : `synced ${timeAgo(view?.synced[k])}`}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </section>

            {/* ── Inflow + mix ── */}
            <div className="mt-6 grid gap-4 xl:grid-cols-[2fr_1fr]">
              <Panel
                title="Lead inflow"
                subtitle="New leads per day, last 30 days"
                icon={TrendingUp}
                right={view && <Legend keys={view.trendKeys} />}
              >
                <div className="h-64">
                  {o && (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={o.trend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <defs>
                          {view.trendKeys.map((k) => (
                            <linearGradient key={k} id={`fill-${k}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={SOURCES[k].color} stopOpacity={0.35} />
                              <stop offset="100%" stopColor={SOURCES[k].color} stopOpacity={0.02} />
                            </linearGradient>
                          ))}
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis
                          dataKey="date"
                          tickFormatter={dayLabel}
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
                        <Tooltip content={<ChartTooltip labelFormat={dayLabel} />} />
                        {view.trendKeys.map((k) => (
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

              <Panel title="Source mix" subtitle="Share of all leads" icon={Sparkles}>
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
                    <span className="text-2xl font-bold tabular-nums text-gray-900">{fmt(view?.all)}</span>
                    <span className="text-xs text-gray-500">leads</span>
                  </div>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {view?.mix.map((m) => (
                    <li key={m.key} className="flex items-center gap-2 text-sm">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: SOURCES[m.key].color }} />
                      <span className="text-gray-600">{m.name}</span>
                      <span className="ml-auto tabular-nums font-medium text-gray-900">{fmt(m.value)}</span>
                      <span className="w-10 text-right tabular-nums text-xs text-gray-400">
                        {Math.round((m.value / view.all) * 100)}%
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
                right={o && <Legend keys={SOURCE_KEYS.filter((k) => k !== "spin" || o.spin_available)} />}
              >
                <div className="h-64">
                  {o && (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={o.upcoming_by_month} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
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
                        <Tooltip content={<ChartTooltip labelFormat={monthLabel} />} cursor={{ fill: "#f8fafc" }} />
                        {SOURCE_KEYS.filter((k) => k !== "spin" || o.spin_available).map((k, i, arr) => (
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

              <Panel title="Budgets & size" subtitle="Wedding and Wedding planner leads" icon={IndianRupee}>
                <dl className="grid grid-cols-2 gap-3">
                  {[
                    {
                      label: "Avg photography budget",
                      value: short(o?.photography_budget.average),
                      sub: `${fmt(o?.photography_budget.count)} leads gave one`,
                    },
                    {
                      label: "Median wedding budget",
                      value: short(o?.wedding_budget.median),
                      sub: `${fmt(o?.wedding_budget.count)} plans`,
                    },
                    {
                      label: "Avg guests per wedding",
                      value: fmt(o?.guests.average),
                      sub: `${fmt(o?.guests.total)} guests in all`,
                    },
                    {
                      label: "Repeat enquiries",
                      value: fmt(o?.repeats),
                      sub: "Same contact again",
                    },
                  ].map((x) => (
                    <div key={x.label} className="rounded-xl bg-gray-50 px-3 py-3">
                      <dt className="text-[11px] text-gray-500">{x.label}</dt>
                      <dd className="mt-1 text-lg font-bold tabular-nums text-gray-900">{x.value}</dd>
                      <dd className="text-[11px] text-gray-400">{x.sub}</dd>
                    </div>
                  ))}
                </dl>
                {o && (o.budget_fit.fits || o.budget_fit.over) ? (
                  <div className="mt-4">
                    <p className="text-xs font-medium text-gray-600">Plans vs budget</p>
                    <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-gray-100">
                      <div className="bg-emerald-500" style={{ flex: o.budget_fit.fits ?? 0 }} />
                      <div className="bg-rose-500" style={{ flex: o.budget_fit.over ?? 0 }} />
                      <div className="bg-gray-200" style={{ flex: o.budget_fit.unknown ?? 0 }} />
                    </div>
                    <p className="mt-1.5 flex gap-4 text-[11px] text-gray-500">
                      <span className="text-emerald-600">{fmt(o.budget_fit.fits ?? 0)} fit</span>
                      <span className="text-rose-600">{fmt(o.budget_fit.over ?? 0)} over</span>
                      {o.budget_fit.unknown ? <span>{fmt(o.budget_fit.unknown)} not estimated</span> : null}
                    </p>
                  </div>
                ) : null}
              </Panel>
            </div>

            {/* ── Where and what ── */}
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Panel title="Top cities" subtitle="Wedding & Wedding planner leads" icon={MapPin}>
                <BarList items={o?.top_cities} />
              </Panel>
              <Panel title="Top countries" subtitle="International leads" icon={Globe}>
                <BarList items={o?.top_countries} color="from-violet-400 to-violet-600" />
              </Panel>
              <Panel title="Occasions" subtitle="What leads are planning" icon={CalendarHeart}>
                <BarList items={o?.occasions} color="from-rose-400 to-rose-600" />
              </Panel>
            </div>

            {/* ── Latest + partners ── */}
            <div className="mt-6 grid gap-4 xl:grid-cols-[2fr_1fr]">
              <Panel title="Latest leads" subtitle="International · Wedding · Wedding planner" icon={Sparkles} flush>
                <ul className="divide-y divide-gray-100">
                  {feed.map((item) => {
                    const s = SOURCES[item.source];
                    return (
                      <li key={item.key}>
                        <Link to={s.to} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-gray-50">
                          <span
                            className={`w-[118px] shrink-0 rounded-full px-2.5 py-0.5 text-center text-xs font-medium ring-1 ${s.tag}`}
                          >
                            {s.label}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-gray-900">{item.title}</span>
                            {item.detail && <span className="block truncate text-xs text-gray-500">{item.detail}</span>}
                          </span>
                          <span className="shrink-0 text-xs text-gray-400">{timeAgo(item.at)}</span>
                        </Link>
                      </li>
                    );
                  })}
                  {!loading && feed.length === 0 && (
                    <li className="px-5 py-8 text-center text-sm text-gray-500">No leads yet.</li>
                  )}
                </ul>
              </Panel>

              <Panel title="Partners" subtitle="Who your wedding leads went to" icon={Handshake}>
                <BarList items={o?.partners} empty="Nothing shared yet" />
                {o?.sharing.not_shared ? (
                  <div className="mt-4 flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2.5 text-sm">
                    <span className="font-medium text-amber-800">Not shared yet</span>
                    <span className="tabular-nums font-semibold text-amber-800">{fmt(o.sharing.not_shared)}</span>
                  </div>
                ) : null}
              </Panel>
            </div>

            {o && (
              <p className="mt-6 text-center text-xs text-gray-400">
                Updated {timeAgo(o.generated_at)}
                {!o.spin_available && " · spin leads are counted, but their dates couldn't be read for the charts"}
              </p>
            )}
          </>
        )}
      </DashboardLayout>
    </>
  );
}