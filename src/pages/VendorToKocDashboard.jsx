import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlarmClock,
  BadgeCheck,
  Calculator,
  Clock,
  Filter as FunnelIcon,
  Handshake,
  Inbox,
  Flame,
  Send,
  PieChart as PieIcon,
  ThumbsUp,
  Wallet,
  IndianRupee,
  Sparkles,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import { getKocDashboard } from "../api/vendorToKoc.js";
import { Kpi, Panel, SeriesToggles, toggled } from "../components/dashboard/DashboardParts.jsx";
import FollowUpsCard from "../components/dashboard/FollowUpsCard.jsx";
import TopCities from "../components/dashboard/TopCities.jsx";
import { dateTimeText, dayText, kocErrors, kocListLink, phoneText, statusLabel } from "../components/vendorToKoc/kocUtils.js";
import { periodLabel } from "./dashboardPeriod.js";
import { shortRupees } from "./dashboardOutcomes.js";
import { aovOf } from "./aov.js";
import {
  daysText,
  dashboardKpiLinks,
  funnelRows,
  inflowPoints,
  linkFor,
  num,
  pctText,
  sourceRows,
  statusRows,
  VENDOR_COLORS,
  vendorCells,
  vendorTiles,
  dhruvaTile,
} from "./vendorToKocDashboard.js";
import { useVendors } from "../components/leads/InlineCrm.jsx";

// Vendors → KOC dashboard (GET /analytics/vendor-to-koc), in the style of the KOC → Vendors one.
// Admins: every card. Vendor logins: what the API returns for them, over their own leads (the
// numbers, update breakdown, funnel, follow-ups); never the per-vendor cards, top cities, by source
// or latest leads. Every number links to the list with the same filters and
// period; "—" for empty values.

const STATUS_COLORS = ["#9ca3af", "#10b981", "#f43f5e", "#f97316", "#0ea5e9", "#8b5cf6", "#22c55e", "#64748b"];
// A number that links to the list, or a grey "—"
function N({ count, filters, period, className = "" }) {
  const to = linkFor(count, filters, period);
  if (!to) return <span className="text-gray-300">—</span>;
  return (
    <Link to={to} className={`hover:text-brand-700 hover:underline ${className}`}>
      {num(count)}
    </Link>
  );
}

const shortDay = (d) => {
  const [, m, day] = /^(\d{4})-(\d{2})-(\d{2})/.exec(d) ?? [];
  return m ? `${Number(day)} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m) - 1]}` : d;
};
const monthText = (d) => dayText(d).replace(/^\d+ /, "");

function InflowTooltip({ active, payload, granularity, vendors }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const title =
    granularity === "month" ? monthText(p.date) : granularity === "week" ? periodLabel(p.date, p.end) : dayText(p.date);
  return (
    <div className="rounded-xl bg-white/95 px-3 py-2 text-xs shadow-lg ring-1 ring-gray-100 backdrop-blur">
      <p className="mb-1 font-semibold text-gray-900">{title}</p>
      {/* Only the ticked vendors (vendors) are shown */}
      {!vendors.some((v) => p[`v${v.id}`]) && <p className="text-gray-500">No leads</p>}
      {vendors
        .filter((v) => p[`v${v.id}`])
        .map((v) => (
          <p key={v.id} className="flex items-center gap-2 text-gray-600">
            <span className="h-2 w-2 rounded-full" style={{ background: v.color }} />
            {v.name}
            <span className="ml-auto pl-3 font-semibold tabular-nums text-gray-900">{p[`v${v.id}`]}</span>
          </p>
        ))}
    </div>
  );
}

function LinkedBars({ rows, period, color = "from-brand-600 to-brand-800", empty = "No data yet" }) {
  const shown = rows.filter((r) => r.count);
  if (!shown.length) return <p className="text-sm text-gray-500">{empty}</p>;
  const max = Math.max(...shown.map((r) => r.count));
  return (
    <ul className="space-y-3">
      {shown.map((r) => (
        <li key={r.key}>
          <div className="flex items-center justify-between text-sm">
            <span className="truncate pr-3 text-gray-700">{r.label}</span>
            <span className="tabular-nums font-medium text-gray-900">
              <N count={r.count} filters={r.filters} period={period} />
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
            <div className={`h-full rounded-full bg-linear-to-r ${color}`} style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

const tableTh = "whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500";

export default function VendorToKocDashboard({ period, refreshKey, isAdmin }) {
  const query = period.all ? { period: "all" } : { dateFrom: period.from, dateTo: period.to };
  const [data, setData] = useState(() => getKocDashboard.peek(query) ?? null);
  const [loading, setLoading] = useState(() => !getKocDashboard.peek(query));
  const [error, setError] = useState("");
  const [hiddenVendors, setHiddenVendors] = useState(() => new Set()); // Lead inflow: unticked vendors
  const allVendors = useVendors(); // admins: every vendor (active ones always get a tile)

  useEffect(() => {
    let cancelled = false;
    const q = period.all ? { period: "all" } : { dateFrom: period.from, dateTo: period.to };
    const cached = getKocDashboard.peek(q);
    if (cached) setData(cached);
    setLoading(!cached);
    getKocDashboard({ ...q, refresh: refreshKey > 0 })
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setError("");
        }
      })
      .catch((err) => !cancelled && setError(kocErrors(err).message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [period.all, period.from, period.to, refreshKey]);

  const d = data;
  const kpiLoading = loading && !d;
  const granularity = d?.period?.granularity ?? "day";
  const vendors = (d?.inflow_vendors ?? []).map((v, i) => ({ ...v, color: VENDOR_COLORS[i % VENDOR_COLORS.length] }));
  const shownVendors = vendors.filter((v) => !hiddenVendors.has(String(v.id)));
  const points = inflowPoints(d?.inflow);
  const statuses = statusRows(d?.by_status);
  // Admin tiles: every active vendor (also any the answer leaves out), and Dhruva as a partner
  const tiles = isAdmin ? vendorTiles(d?.per_vendor, allVendors) : [];
  const dhruva = isAdmin ? dhruvaTile(d?.dhruva, period) : null;
  const all = { all: true };
  const kpiLinks = dashboardKpiLinks(period);
  const aovValue = aovOf(d?.kpis).value;
  // The outcome cards: admins, and vendor logins once the API sends them (pending, funnel…)
  const outcomes = isAdmin || d?.pending !== undefined;

  return (
    <>
      {error && (
        <p role="alert" className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </p>
      )}
      {!loading && !d ? null : (
        <>
          {/* ── KPIs ── */}
          <section
            className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            aria-label="Key numbers"
          >
            <Kpi
              icon={Inbox}
              label="Total leads"
              value={num(d?.received)}
              to={kpiLinks.total}
              delta={d?.change_pct ?? null}
              gradient="from-brand-600 to-brand-800"
              loading={kpiLoading}
            />
            {/* The six KPIs (kpis, docs section 9) over the period's leads; vendors: their own */}
            <Kpi
              icon={ThumbsUp}
              label="Interested"
              value={num(d?.kpis?.interested)}
              to={kpiLinks.interested}
              gradient="from-violet-500 to-violet-700"
              loading={kpiLoading}
            />
            <Kpi
              icon={IndianRupee}
              label="Quoted amount"
              value={d?.kpis?.quoted_count ? shortRupees(d.kpis.quoted_total) : "—"}
              to={kpiLinks.quoted_amount}
              gradient="from-indigo-500 to-indigo-700"
              loading={kpiLoading}
            />
            <Kpi
              icon={Wallet}
              label="Conversion amount"
              value={d?.kpis?.conversion_count ? shortRupees(d.kpis.conversion_total) : "—"}
              to={kpiLinks.conversion_amount}
              gradient="from-teal-500 to-teal-700"
              loading={kpiLoading}
            />
            <Kpi
              icon={Calculator}
              label="AOV"
              value={aovValue == null ? "—" : shortRupees(Math.round(aovValue))}
              to={kpiLinks.aov}
              gradient="from-sky-500 to-brand-700"
              loading={kpiLoading}
            />
            <Kpi
              icon={Send}
              label="Quotes sent"
              value={num(d?.kpis?.quotes_count)}
              to={kpiLinks.quotes_sent}
              gradient="from-indigo-500 to-indigo-700"
              loading={kpiLoading}
            />
            <Kpi
              icon={Flame}
              label="Hot leads"
              value={num(d?.kpis?.hot_count)}
              to={kpiLinks.hot_leads}
              gradient="from-amber-500 to-orange-600"
              loading={kpiLoading}
            />
            {outcomes && (
              <>
                <Kpi
                  icon={Clock}
                  label="Pending"
                  value={num(d?.pending)}
                  to={kpiLinks.pending}
                  gradient="from-amber-400 to-amber-600"
                  loading={kpiLoading}
                />
                <Kpi
                  icon={AlarmClock}
                  label="Follow-ups due"
                  value={num(d?.follow_ups_due)}
                  to={kpiLinks.follow_ups_due}
                  gradient="from-rose-500 to-rose-700"
                  loading={kpiLoading}
                />
                <Kpi
                  icon={BadgeCheck}
                  label="Converted"
                  value={num(d?.kpis?.converted ?? d?.converted)}
                  to={kpiLinks.converted}
                  gradient="from-emerald-500 to-brand-700"
                  loading={kpiLoading}
                />
              </>
            )}
          </section>

          {/* ── Per vendor (admin): every active vendor (zeros as "—"), inactive ones with leads
              (badge), and Dhruva as a partner ── */}
          {isAdmin && (tiles.length > 0 || dhruva) && (
            <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-label="Vendors">
              {tiles.map((v) => (
                <div key={v.vendor_id} className={`rounded-2xl bg-white p-4 ring-1 ring-gray-100 shadow-sm shadow-gray-200/60 ${v.is_active ? "" : "opacity-80"}`}>
                  {/* The name opens this vendor's leads for the period (the count does too) */}
                  <span className="flex items-center justify-between gap-2">
                    <Link
                      to={kocListLink({ vendor_id: [String(v.vendor_id)] }, period)}
                      className="flex min-w-0 items-center gap-2 text-sm font-semibold text-gray-900 hover:text-brand-700 hover:underline"
                    >
                      <Users size={15} className="shrink-0 text-brand-600" aria-hidden="true" />
                      <span className="truncate">{v.vendor_name}</span>
                    </Link>
                    {!v.is_active && <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 ring-1 ring-gray-200">Inactive</span>}
                  </span>
                  <p className="mt-0.5 text-xl font-bold tabular-nums text-gray-900">
                    <N count={v.leads} filters={{ vendor_id: [String(v.vendor_id)] }} period={period} />
                    <span className="ml-1.5 text-xs font-normal text-gray-400">leads</span>
                  </p>
                  <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-gray-100 pt-3">
                    {vendorCells(v).map((c) => (
                      <div key={c.key} className="min-w-0">
                        <dt className="truncate text-[10px] font-semibold uppercase tracking-wider text-gray-400">{c.label}</dt>
                        <dd className="mt-0.5 text-sm font-semibold tabular-nums text-gray-900">
                          <N count={c.count} filters={c.filters} period={period} />
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
              {dhruva && (
                <div className="rounded-2xl bg-white p-4 ring-1 ring-gray-100 shadow-sm shadow-gray-200/60">
                  <span className="flex items-center justify-between gap-2">
                    <Link to={dhruva.to} className="flex items-center gap-2 text-sm font-semibold text-gray-900 hover:text-brand-700 hover:underline">
                      <Star size={15} className="text-amber-500" aria-hidden="true" />
                      {dhruva.name}
                    </Link>
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-amber-200">Partner</span>
                  </span>
                  <p className="mt-0.5 text-xl font-bold tabular-nums text-gray-900">
                    {dhruva.leadsTo ? <Link to={dhruva.leadsTo} className="hover:text-brand-700 hover:underline">{num(dhruva.leads)}</Link> : <span className="text-gray-300">—</span>}
                    <span className="ml-1.5 text-xs font-normal text-gray-400">leads</span>
                  </p>
                  <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-gray-100 pt-3">
                    {dhruva.cells.map((c) => (
                      <div key={c.key} className="min-w-0">
                        <dt className="truncate text-[10px] font-semibold uppercase tracking-wider text-gray-400">{c.label}</dt>
                        <dd className="mt-0.5 text-sm font-semibold tabular-nums text-gray-900">
                          {c.to ? <Link to={c.to} className="hover:text-brand-700 hover:underline">{num(c.count)}</Link> : <span className="text-gray-300">—</span>}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </section>
          )}

          {/* ── Inflow + breakdown ── */}
          <div className={`mt-6 grid gap-4 ${outcomes ? "xl:grid-cols-[2fr_1fr]" : ""}`}>
            <Panel
              title="Lead inflow"
              subtitle={`Leads received per ${granularity === "month" ? "month" : granularity === "week" ? "week (7-day buckets)" : "day"}${isAdmin ? ", per vendor" : ""}`}
              icon={TrendingUp}
            >
              {vendors.length > 0 && (
                <SeriesToggles
                  series={vendors.map((v) => ({ key: String(v.id), label: v.name, color: v.color }))}
                  hidden={hiddenVendors}
                  onToggle={(k) => setHiddenVendors((h) => toggled(h, k))}
                />
              )}
              <div className="h-64">
                {d && vendors.length > 0 && !shownVendors.length ? (
                  <p className="flex h-full items-center justify-center text-sm text-gray-500">Select at least one source</p>
                ) : d && (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={points} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(v) => (granularity === "month" ? monthText(v) : shortDay(v))}
                        tick={{ fontSize: 11, fill: "#9ca3af" }}
                        axisLine={false}
                        tickLine={false}
                        minTickGap={24}
                      />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                      <Tooltip content={<InflowTooltip granularity={granularity} vendors={shownVendors} />} />
                      {shownVendors.map((v) => (
                        <Line
                          key={v.id}
                          type="monotone"
                          dataKey={(p) => p[`v${v.id}`] ?? 0}
                          name={v.name}
                          stroke={v.color}
                          strokeWidth={2}
                          dot={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Panel>

            {outcomes && (
              <Panel title="Update breakdown" subtitle="Leads received in the period" icon={PieIcon}>
                <div className="h-44">
                  {d && d.received > 0 && (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statuses.filter((s) => s.count)}
                          dataKey="count"
                          nameKey="label"
                          innerRadius="62%"
                          outerRadius="90%"
                          paddingAngle={3}
                          stroke="none"
                        >
                          {statuses
                            .filter((s) => s.count)
                            .map((s) => (
                              <Cell key={s.key} fill={STATUS_COLORS[statuses.indexOf(s)]} />
                            ))}
                        </Pie>
                        <Tooltip formatter={(v, n) => [num(v), n]} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <ul className="mt-3 space-y-1.5">
                  {statuses.map((s, i) => (
                    <li key={s.key} className="flex items-center gap-2 text-sm">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLORS[i] }} />
                      <span className="truncate text-gray-600">{s.label}</span>
                      <span className="ml-auto tabular-nums font-medium text-gray-900">
                        <N count={s.count} filters={s.filters} period={period} />
                      </span>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </div>

          {outcomes && (
            <>
              {/* ── Funnel (everyone), cities and sources (admins) ── */}
              <div className={`mt-6 grid gap-4 ${isAdmin ? "md:grid-cols-2 xl:grid-cols-3" : ""}`}>
                <Panel title="Funnel" subtitle="Received → updated → engaged → converted" icon={FunnelIcon}>
                  <LinkedBars rows={funnelRows(d?.funnel)} period={period} />
                </Panel>
                {isAdmin && (
                <>
                <TopCities rows={d?.top_cities} sources={d?.top_cities_sources} defaultSource="vendor_to_koc" flow="vendors" />
                <Panel title="By source" subtitle="How the leads were added" icon={Sparkles}>
                  <LinkedBars rows={sourceRows(d?.by_source)} period={period} color="from-rose-400 to-rose-600" />
                </Panel>
                </>
                )}
              </div>

              {/* ── Vendor comparison (admins) ── */}
              {isAdmin && (
              <div className="mt-6">
                <Panel title="Vendor comparison" subtitle="Leads received in the period" icon={Handshake} flush>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-y border-gray-100 bg-gray-50/80">
                        <tr>
                          {["Vendor", "Leads", "Converted %", "Pending", "Avg days to first update"].map((h) => (
                            <th key={h} className={tableTh}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(d?.per_vendor ?? []).map((v) => (
                          <tr key={v.vendor_id} className="border-b border-gray-50">
                            <td className="px-4 py-2.5 font-medium text-gray-900">{v.vendor_name}</td>
                            <td className="px-4 py-2.5 tabular-nums">
                              <N count={v.leads} filters={{ vendor_id: [String(v.vendor_id)] }} period={period} />
                            </td>
                            <td className="px-4 py-2.5 tabular-nums">{v.converted ? pctText(v.converted_pct) : "—"}</td>
                            <td className="px-4 py-2.5 tabular-nums">
                              <N
                                count={v.pending}
                                filters={{ vendor_id: [String(v.vendor_id)], update_status: ["pending"] }}
                                period={period}
                              />
                            </td>
                            <td className="px-4 py-2.5 tabular-nums text-gray-700">{daysText(v.average_days_to_update)}</td>
                          </tr>
                        ))}
                        {!(d?.per_vendor ?? []).length && (
                          <tr>
                            <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">
                              No leads in this period.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              </div>
              )}

              {/* ── Follow-ups (everyone) + latest (admins) ── */}
              <div className={`mt-6 grid gap-4 ${isAdmin ? "xl:grid-cols-2" : ""}`}>
                <FollowUpsCard flow="vendors" />
                {isAdmin && (
                <Panel title="Latest leads" subtitle="The newest leads of the period" icon={Inbox} flush>
                  <ul className="divide-y divide-gray-100">
                    {(d?.latest ?? []).map((l) => (
                      <li key={l.id}>
                        <Link
                          to={linkFor(1, { search: l.phone }, period)}
                          className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-gray-50"
                        >
                          <span className="w-[118px] shrink-0 truncate rounded-full bg-gray-50 px-2.5 py-0.5 text-center text-xs font-medium text-gray-700 ring-1 ring-gray-200">
                            {l.vendor_name}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-gray-900">{l.name || phoneText(l.phone)}</span>
                            <span className="block truncate text-xs text-gray-500">
                              {[l.city, statusLabel(l.update_status)].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs text-gray-400">{dateTimeText(l.created_at)}</span>
                        </Link>
                      </li>
                    ))}
                    {!(d?.latest ?? []).length && <li className="px-5 py-8 text-center text-sm text-gray-500">No leads in this period.</li>}
                  </ul>
                </Panel>
                )}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
