import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  FileText,
  Globe,
  Handshake,
  IndianRupee,
  Inbox,
  MapPin,
  RefreshCw,
  Send,
  Store,
  Target,
  Camera,
  ClipboardList,
  UserX,
  Users,
  Wallet,
} from "lucide-react";
import DashboardLayout from "../components/layout/DashboardLayout.jsx";
import { getVendorReferrals, getVendorStats, listFlowLeads } from "../api/vendors.js";

// One page, two directions. Both use the same layout; only the data and labels change.
//   koc-to-vendors: leads KOC passed to vendors   (GET /vendors/stats + /vendors/leads)
//   vendors-to-koc: leads vendors sent to KOC     (GET /vendors/referrals + /vendors/leads)

const FLOWS = {
  "koc-to-vendors": {
    title: "KOC → Vendors",
    description: "Leads KOC passes on to partner vendors, and how each vendor is doing with them.",
    fetcher: getVendorStats,
    labels: {
      leads: "Leads passed",
      leadsCaption: (n) => `To ${n} vendors`,
      journeyFirst: "Passed to vendor",
      journeyTitle: "Lead journey",
      statusSubtitle: "Where passed leads stand right now",
      tableSubtitle: "Sorted by leads passed",
      listTitle: "Leads we passed",
      listSubtitle: "Every lead KOC handed to a vendor",
      dateHeader: "Passed",
      Icon: ArrowUpRight,
    },
  },
  "vendors-to-koc": {
    title: "Vendors → KOC",
    description: "Customers that partner vendors send to KOC, and the commission KOC owes them.",
    fetcher: getVendorReferrals,
    labels: {
      leads: "Leads received",
      leadsCaption: (n) => `From ${n} vendors`,
      journeyFirst: "Received from vendor",
      journeyTitle: "Referral journey",
      statusSubtitle: "Where received leads stand right now",
      tableSubtitle: "Sorted by leads received",
      listTitle: "Leads vendors sent us",
      listSubtitle: "Every customer a vendor referred to KOC",
      dateHeader: "Received",
      Icon: ArrowDownLeft,
    },
  },
};

const SOURCES = {
  spin: { label: "Spin leads", icon: Target, color: "#0ea5e9", tint: "bg-sky-50 text-sky-600" },
  whatsapp: { label: "International", icon: Globe, color: "#8b5cf6", tint: "bg-violet-50 text-violet-600" },
  wedding: { label: "Wedding", icon: Camera, color: "#f43f5e", tint: "bg-rose-50 text-rose-600" },
  wedding_planner: { label: "Wedding planner", icon: ClipboardList, color: "#f59e0b", tint: "bg-amber-50 text-amber-600" },
};

const STATUSES = {
  interested: { label: "Interested", tag: "bg-sky-50 text-sky-700 ring-sky-200" },
  follow_up: { label: "Follow-up", tag: "bg-amber-50 text-amber-700 ring-amber-200" },
  not_interested: { label: "Not interested", tag: "bg-rose-50 text-rose-700 ring-rose-200" },
  quoted: { label: "Quoted", tag: "bg-violet-50 text-violet-700 ring-violet-200" },
  converted: { label: "Converted", tag: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  no_response: { label: "No response", tag: "bg-gray-50 text-gray-600 ring-gray-200" },
};

const PAGE_SIZE = 15;

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const fmt = (n) => (n == null ? "—" : n.toLocaleString("en-IN"));
function short(amount) {
  if (amount == null) return "—";
  if (amount >= 1e7) return `₹${+(amount / 1e7).toFixed(2)} Cr`;
  if (amount >= 1e5) return `₹${+(amount / 1e5).toFixed(1)} L`;
  return inr.format(amount);
}
const pct = (part, total) => (total ? Math.round((part / total) * 100) : 0);
const sum = (rows, key) => rows.reduce((t, r) => t + (r[key] ?? 0), 0);
const shortDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" }) : "—";

// by_source can be { spin: 12, ... } or [{ source: "spin", count: 12 }]; turn either into [[key, count]]
function sourceEntries(bySource) {
  if (!bySource) return [];
  if (Array.isArray(bySource)) {
    return bySource.map((s) => [s.source ?? s.value, s.count ?? s.leads ?? 0]);
  }
  return Object.entries(bySource);
}

// ── Data hook: shows the cached value first, then refreshes ─────────────
function useRemote(fetcher) {
  const [data, setData] = useState(() => fetcher.peek?.() ?? null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    setRefreshing(true);
    setError("");
    fetcher()
      .then(setData)
      .catch((err) => setError(err.message || "Couldn't load the numbers."))
      .finally(() => setRefreshing(false));
  }, [fetcher]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, error, refreshing, load, loading: !data && !error };
}

// ── Building blocks (same look as the dashboard) ───────────────────────
function Kpi({ icon: Icon, label, value, caption, gradient, loading }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-white p-5 ring-1 ring-gray-100 shadow-sm shadow-gray-200/60 transition-shadow hover:shadow-lg hover:shadow-gray-200/80">
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-linear-to-br opacity-15 blur-xl ${gradient}`}
      />
      <div className="relative flex items-start justify-between">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br text-white shadow-sm ${gradient}`}>
          <Icon size={17} aria-hidden="true" />
        </span>
      </div>
      {loading ? (
        <span className="mt-3 block h-8 w-24 animate-pulse rounded-lg bg-gray-100" />
      ) : (
        <p className="relative mt-2 text-3xl font-bold tracking-tight tabular-nums text-gray-900">{value}</p>
      )}
      <p className="relative mt-1.5 text-xs text-gray-500">{caption}</p>
    </div>
  );
}

function Panel({ title, subtitle, icon: Icon, right, flush = false, children }) {
  return (
    <section className={`rounded-2xl bg-white ring-1 ring-gray-100 shadow-sm shadow-gray-200/60 ${flush ? "pt-5" : "p-5"}`}>
      <div className={`flex flex-wrap items-start justify-between gap-3 ${flush ? "px-5" : ""}`}>
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

function Funnel({ stages }) {
  const max = Math.max(1, stages[0]?.value ?? 0);
  return (
    <ol className="space-y-3">
      {stages.map((s, i) => (
        <li key={s.label}>
          <div className="flex items-baseline justify-between text-sm">
            <span className="flex items-center gap-2 text-gray-700">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold text-white bg-linear-to-br ${s.gradient}`}>
                {i + 1}
              </span>
              {s.label}
            </span>
            <span className="tabular-nums">
              <span className="font-semibold text-gray-900">{fmt(s.value)}</span>
              {i > 0 && <span className="ml-2 text-xs text-gray-400">{pct(s.value, max)}%</span>}
            </span>
          </div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
            <div
              className={`h-full rounded-full bg-linear-to-r ${s.gradient} transition-all duration-700`}
              style={{ width: `${Math.max(pct(s.value, max), s.value ? 2 : 0)}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

function StatusList({ items, total }) {
  return (
    <ul className="space-y-2.5">
      {items.map((x) => (
        <li key={x.label} className="flex items-center gap-2 text-sm">
          <span className={`h-2.5 w-2.5 rounded-full ${x.dot}`} aria-hidden="true" />
          <span className="text-gray-600">{x.label}</span>
          <span className="ml-auto font-medium tabular-nums text-gray-900">{fmt(x.value)}</span>
          <span className="w-10 text-right text-xs tabular-nums text-gray-400">{pct(x.value, total)}%</span>
        </li>
      ))}
    </ul>
  );
}

function ConversionBar({ rate }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
        <div className="h-full rounded-full bg-linear-to-r from-emerald-400 to-emerald-600" style={{ width: `${Math.min(rate, 100)}%` }} />
      </div>
      <span className="w-10 text-right text-xs tabular-nums text-gray-600">{rate}%</span>
    </div>
  );
}

function SkeletonRows({ cols, count = 3 }) {
  return Array.from({ length: count }).map((_, i) => (
    <tr key={i}>
      <td colSpan={cols} className="px-5 py-3.5">
        <span className="block h-3 w-2/3 animate-pulse rounded bg-gray-100" />
      </td>
    </tr>
  ));
}

const selectClass =
  "rounded-full bg-white px-3 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200 focus:outline-2 focus:outline-brand-600";

// ── Leads list (what we passed / what they sent) ───────────────────────
function LeadsList({ direction, labels, vendors }) {
  const [page, setPage] = useState(1);
  const [vendorId, setVendorId] = useState("");
  const [status, setStatus] = useState("");
  const [state, setState] = useState({ items: [], total: 0, loading: true, error: "" });

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: "" }));
    listFlowLeads({ direction, vendorId, status, page, pageSize: PAGE_SIZE })
      .then((r) => {
        if (!cancelled) setState({ items: r.items ?? [], total: r.total ?? 0, loading: false, error: "" });
      })
      .catch((err) => {
        if (!cancelled) setState({ items: [], total: 0, loading: false, error: err.message || "Couldn't load leads." });
      });
    return () => {
      cancelled = true;
    };
  }, [direction, vendorId, status, page]);

  const pages = Math.max(1, Math.ceil(state.total / PAGE_SIZE));
  const from = state.total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(page * PAGE_SIZE, state.total);

  const filters = (
    <div className="flex flex-wrap gap-2">
      <select
        aria-label="Filter by vendor"
        value={vendorId}
        onChange={(e) => {
          setVendorId(e.target.value);
          setPage(1);
        }}
        className={selectClass}
      >
        <option value="">All vendors</option>
        {vendors.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>
      <select
        aria-label="Filter by status"
        value={status}
        onChange={(e) => {
          setStatus(e.target.value);
          setPage(1);
        }}
        className={selectClass}
      >
        <option value="">All statuses</option>
        {Object.entries(STATUSES).map(([k, s]) => (
          <option key={k} value={k}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <Panel title={labels.listTitle} subtitle={labels.listSubtitle} icon={Users} right={filters} flush>
      {state.error && (
        <p role="alert" className="mx-5 mb-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          {state.error}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-y border-gray-100 bg-gray-50/60 text-xs text-gray-500">
            <tr>
              <th className="px-5 py-2.5 font-medium">Lead</th>
              <th className="px-3 py-2.5 font-medium">Source</th>
              <th className="px-3 py-2.5 font-medium">Vendor</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 text-right font-medium">Quote</th>
              <th className="px-5 py-2.5 text-right font-medium">{labels.dateHeader}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {state.loading && <SkeletonRows cols={6} count={5} />}
            {!state.loading &&
              state.items.map((l) => {
                const src = SOURCES[l.source];
                const st = STATUSES[l.status] ?? STATUSES.no_response;
                return (
                  <tr key={l.id} className="transition-colors hover:bg-brand-50/40">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900">{l.name || l.phone_display || `#${l.id}`}</p>
                      {(l.city || (l.name && l.phone_display)) && (
                        <p className="flex items-center gap-1 text-xs text-gray-500">
                          {l.city && <MapPin size={11} aria-hidden="true" />}
                          {[l.city, l.name ? l.phone_display : null].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-gray-700">
                      {src ? (
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ background: src.color }} aria-hidden="true" />
                          {src.label}
                        </span>
                      ) : (
                        l.source || "—"
                      )}
                    </td>
                    <td className="px-3 py-3 text-gray-900">{l.vendor?.name ?? "—"}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${st.tag}`}>{st.label}</span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-gray-900">
                      {l.quote_value ? short(l.quote_value) : "—"}
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-gray-500">{shortDate(l.at)}</td>
                  </tr>
                );
              })}
            {!state.loading && !state.error && state.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-500">
                  No leads found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3 text-xs text-gray-500">
        <span className="tabular-nums">
          {from}–{to} of {fmt(state.total)}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || state.loading}
            aria-label="Previous page"
            className="rounded-full p-1.5 ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-40"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="px-2 tabular-nums">
            Page {page} / {pages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page >= pages || state.loading}
            aria-label="Next page"
            className="rounded-full p-1.5 ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-40"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </Panel>
  );
}

// ── The shared dashboard, used by both directions ──────────────────────
function FlowDashboard({ flow }) {
  const cfg = FLOWS[flow];
  const L = cfg.labels;
  const received = flow === "vendors-to-koc";
  const { data, error, refreshing, load, loading } = useRemote(cfg.fetcher);

  const rows = useMemo(
    () => [...(data?.vendors ?? [])].sort((a, b) => (b.leads ?? 0) - (a.leads ?? 0)),
    [data],
  );

  const totals = useMemo(
    () => ({
      leads: sum(rows, "leads"),
      interested: sum(rows, "interested"),
      follow_up: sum(rows, "follow_up"),
      not_interested: sum(rows, "not_interested"),
      quoted: sum(rows, "quoted"),
      quoted_value: sum(rows, "quoted_value"),
      converted: sum(rows, "converted"),
      converted_value: sum(rows, "converted_value"),
      commission: sum(rows, "commission_payable"),
    }),
    [rows],
  );
  const noResponse = Math.max(0, totals.leads - totals.interested - totals.follow_up - totals.not_interested);

  // Leads per source across all vendors
  const bySource = useMemo(() => {
    const acc = {};
    rows.forEach((r) => sourceEntries(r.by_source).forEach(([k, n]) => (acc[k] = (acc[k] ?? 0) + (n ?? 0))));
    return Object.entries(acc).filter(([, n]) => n > 0);
  }, [rows]);

  return (
    <>
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={load}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-200 transition-colors hover:bg-gray-50 disabled:opacity-60"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          {received ? "Couldn't load vendor referrals. This direction needs the backend endpoint GET /vendors/referrals. " : ""}
          ({error})
        </p>
      )}

      {/* KPIs: same five cards in both directions */}
      <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="Key numbers">
        <Kpi
          icon={received ? Inbox : Send}
          label={L.leads}
          value={fmt(totals.leads)}
          caption={L.leadsCaption(fmt(rows.length))}
          gradient="from-brand-600 to-brand-800"
          loading={loading}
        />
        <Kpi
          icon={BadgeCheck}
          label="Converted"
          value={fmt(totals.converted)}
          caption={`${pct(totals.converted, totals.leads)}% of ${L.leads.toLowerCase()}`}
          gradient="from-emerald-500 to-brand-700"
          loading={loading}
        />
        <Kpi
          icon={FileText}
          label="Quoted value"
          value={short(totals.quoted_value)}
          caption={`${fmt(totals.quoted)} quotes given`}
          gradient="from-violet-500 to-violet-700"
          loading={loading}
        />
        <Kpi
          icon={IndianRupee}
          label="Converted value"
          value={short(totals.converted_value)}
          caption="Quotes of converted leads"
          gradient="from-sky-500 to-sky-700"
          loading={loading}
        />
        {received ? (
          <Kpi
            icon={Wallet}
            label="Commission payable"
            value={short(totals.commission)}
            caption="KOC pays the referring vendor"
            gradient="from-amber-400 to-amber-600"
            loading={loading}
          />
        ) : (
          <Kpi
            icon={UserX}
            label="Not passed yet"
            value={fmt(data?.unassigned)}
            caption="Leads with no vendor"
            gradient="from-amber-400 to-amber-600"
            loading={loading}
          />
        )}
      </section>

      {/* Lead source cards (only when the API sends by_source) */}
      {bySource.length > 0 && (
        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Lead sources">
          {bySource.map(([key, n]) => {
            const s = SOURCES[key];
            const Icon = s?.icon ?? Target;
            const share = pct(n, totals.leads);
            return (
              <div key={key} className="flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-gray-100 shadow-sm shadow-gray-200/60">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${s?.tint ?? "bg-gray-50 text-gray-600"}`}>
                  <Icon size={20} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900">{s?.label ?? key}</p>
                  <p className="mt-0.5 text-xl font-bold tabular-nums text-gray-900">{fmt(n)}</p>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
                    <div className="h-full rounded-full" style={{ width: `${share}%`, background: s?.color ?? "#9ca3af" }} />
                  </div>
                  <p className="mt-1 text-[11px] text-gray-400">{share}% of {L.leads.toLowerCase()}</p>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Journey + status */}
      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Panel title={L.journeyTitle} subtitle="All vendors together" icon={Handshake}>
          <Funnel
            stages={[
              { label: L.journeyFirst, value: totals.leads, gradient: "from-brand-600 to-brand-800" },
              { label: "Interested", value: totals.interested, gradient: "from-sky-500 to-sky-700" },
              { label: "Quotation given", value: totals.quoted, gradient: "from-violet-500 to-violet-700" },
              { label: "Converted", value: totals.converted, gradient: "from-emerald-500 to-emerald-700" },
            ]}
          />
        </Panel>
        <Panel title="Lead status" subtitle={L.statusSubtitle} icon={Handshake}>
          <StatusList
            total={totals.leads}
            items={[
              { label: "Interested", value: totals.interested, dot: "bg-sky-500" },
              { label: "Follow-up", value: totals.follow_up, dot: "bg-amber-500" },
              { label: "Not interested", value: totals.not_interested, dot: "bg-rose-500" },
              { label: "No response yet", value: noResponse, dot: "bg-gray-300" },
            ]}
          />
        </Panel>
      </div>

      {/* Per vendor */}
      <div className="mt-4">
        <Panel title="By vendor" subtitle={L.tableSubtitle} icon={Store} flush>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-y border-gray-100 bg-gray-50/60 text-xs text-gray-500">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Vendor</th>
                  <th className="px-3 py-2.5 text-right font-medium">Leads</th>
                  <th className="px-3 py-2.5 text-right font-medium">Interested</th>
                  <th className="px-3 py-2.5 text-right font-medium">Follow-up</th>
                  <th className="px-3 py-2.5 text-right font-medium">Not interested</th>
                  <th className="px-3 py-2.5 text-right font-medium">Quoted</th>
                  <th className="px-3 py-2.5 text-right font-medium">Converted</th>
                  <th className="w-40 px-3 py-2.5 font-medium">Conversion</th>
                  <th className="px-3 py-2.5 text-right font-medium">Converted value</th>
                  {received && <th className="px-5 py-2.5 text-right font-medium">Commission</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading && <SkeletonRows cols={received ? 10 : 9} />}
                {rows.map((s) => {
                  const rate = s.conversion_rate ?? pct(s.converted, s.leads);
                  return (
                    <tr key={s.vendor.id} className="transition-colors hover:bg-brand-50/40">
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-900">{s.vendor.name}</p>
                        <p className="flex items-center gap-1 text-xs text-gray-500">
                          <MapPin size={11} aria-hidden="true" />
                          <span className="truncate">{s.vendor.coverage || "No coverage set"}</span>
                          {received && s.commission_rate != null && <span>· {s.commission_rate}% commission</span>}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-gray-900">{fmt(s.leads)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-sky-700">{fmt(s.interested)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-amber-700">{fmt(s.follow_up)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-rose-700">{fmt(s.not_interested)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-gray-700">{fmt(s.quoted)}</td>
                      <td className="px-3 py-3 text-right tabular-nums font-semibold text-emerald-700">{fmt(s.converted)}</td>
                      <td className="px-3 py-3"><ConversionBar rate={rate} /></td>
                      <td className="px-3 py-3 text-right tabular-nums text-gray-900">{short(s.converted_value)}</td>
                      {received && (
                        <td className="px-5 py-3 text-right tabular-nums font-semibold text-amber-700">{short(s.commission_payable)}</td>
                      )}
                    </tr>
                  );
                })}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={received ? 10 : 9} className="px-5 py-10 text-center text-sm text-gray-500">
                      {received ? "No vendor referrals yet." : "No vendors yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* The actual leads */}
      <div className="mt-4">
        <LeadsList direction={flow} labels={L} vendors={rows.map((r) => r.vendor)} />
      </div>
    </>
  );
}

// ── Page ───────────────────────────────────────────────────────────────
// flow comes from the route: /flow/koc-to-vendors or /flow/vendors-to-koc
export default function LeadFlow({ flow }) {
  const current = FLOWS[flow] ? flow : "koc-to-vendors";
  const f = FLOWS[current];
  return (
    <DashboardLayout title={f.title} description={f.description}>
      {/* key remounts everything on switch, so each direction loads its own data and resets filters */}
      <FlowDashboard key={current} flow={current} />
    </DashboardLayout>
  );
}