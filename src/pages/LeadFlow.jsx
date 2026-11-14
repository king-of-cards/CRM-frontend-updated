import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  FileText,
  Handshake,
  IndianRupee,
  Inbox,
  MapPin,
  RefreshCw,
  Send,
  Store,
  UserX,
} from "lucide-react";
import { useNavigate } from "react-router";
import DashboardLayout from "../components/layout/DashboardLayout.jsx";
import { getVendorStats } from "../api/vendors.js";

// Which way leads travel between KOC and partner vendors.
//   koc-to-vendors: KOC passes a lead to a vendor (from the vendor assignment data)
//   vendors-to-koc: a vendor sends their customer to KOC (needs its own data source)

const FLOWS = {
  "koc-to-vendors": {
    title: "KOC → Vendors",
    description: "Leads KOC passes on to partner vendors, and how each vendor is doing with them.",
    icon: ArrowUpRight,
  },
  "vendors-to-koc": {
    title: "Vendors → KOC",
    description: "Customers that partner vendors send to KOC.",
    icon: ArrowDownLeft,
  },
};

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const fmt = (n) => (n == null ? "—" : n.toLocaleString("en-IN"));
function short(amount) {
  if (amount == null) return "—";
  if (amount >= 1e7) return `₹${+(amount / 1e7).toFixed(2)} Cr`;
  if (amount >= 1e5) return `₹${+(amount / 1e5).toFixed(1)} L`;
  return inr.format(amount);
}
const pct = (part, total) => (total ? Math.round((part / total) * 100) : 0);

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
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br text-white shadow-sm ${gradient}`}
        >
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

// Passed → Interested → Quoted → Converted, as shrinking bars
function Funnel({ stages }) {
  const max = Math.max(1, stages[0]?.value ?? 0);
  return (
    <ol className="space-y-3">
      {stages.map((s, i) => (
        <li key={s.label}>
          <div className="flex items-baseline justify-between text-sm">
            <span className="flex items-center gap-2 text-gray-700">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold text-white bg-linear-to-br ${s.gradient}`}
              >
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

// Switch between the two directions, shown under the page heading
function FlowSwitch({ current, onChange }) {
  return (
    <div
      role="tablist"
      aria-label="Lead direction"
      className="mt-6 inline-flex rounded-full bg-gray-100 p-1 ring-1 ring-gray-200/70"
    >
      {Object.entries(FLOWS).map(([id, f]) => {
        const Icon = f.icon;
        const active = id === current;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(id)}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
              active
                ? "bg-linear-to-r from-brand-600 to-brand-800 text-white shadow-md shadow-brand-700/25"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Icon size={15} aria-hidden="true" />
            {f.title}
          </button>
        );
      })}
    </div>
  );
}

// ── KOC → Vendors ───────────────────────────────────────────────────────
function KocToVendors() {
  const [stats, setStats] = useState(() => getVendorStats.peek?.() ?? null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    setRefreshing(true);
    setError("");
    getVendorStats()
      .then(setStats)
      .catch((err) => setError(err.message || "Couldn't load vendor numbers."))
      .finally(() => setRefreshing(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(
    () => [...(stats?.vendors ?? [])].sort((a, b) => (b.leads ?? 0) - (a.leads ?? 0)),
    [stats],
  );
  const totals = rows.reduce(
    (t, s) => ({
      leads: t.leads + (s.leads ?? 0),
      interested: t.interested + (s.interested ?? 0),
      quoted: t.quoted + (s.quoted ?? 0),
      converted: t.converted + (s.converted ?? 0),
      quoted_value: t.quoted_value + (s.quoted_value ?? 0),
      converted_value: t.converted_value + (s.converted_value ?? 0),
    }),
    { leads: 0, interested: 0, quoted: 0, converted: 0, quoted_value: 0, converted_value: 0 },
  );
  const loading = !stats && !error;

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
          {error}
        </p>
      )}

      {/* KPIs */}
      <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="Key numbers">
        <Kpi
          icon={Send}
          label="Leads passed"
          value={fmt(totals.leads)}
          caption={`To ${fmt(rows.length)} vendors`}
          gradient="from-brand-600 to-brand-800"
          loading={loading}
        />
        <Kpi
          icon={BadgeCheck}
          label="Converted"
          value={fmt(totals.converted)}
          caption={`${pct(totals.converted, totals.leads)}% of leads passed`}
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
        <Kpi
          icon={UserX}
          label="Not passed yet"
          value={fmt(stats?.unassigned)}
          caption="Leads with no vendor"
          gradient="from-amber-400 to-amber-600"
          loading={loading}
        />
      </section>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_2fr]">
        {/* Funnel */}
        <Panel title="Lead journey" subtitle="All vendors together" icon={Handshake}>
          <Funnel
            stages={[
              { label: "Passed to vendor", value: totals.leads, gradient: "from-brand-600 to-brand-800" },
              { label: "Interested", value: totals.interested, gradient: "from-sky-500 to-sky-700" },
              { label: "Quotation given", value: totals.quoted, gradient: "from-violet-500 to-violet-700" },
              { label: "Converted", value: totals.converted, gradient: "from-emerald-500 to-emerald-700" },
            ]}
          />
        </Panel>

        {/* Per vendor */}
        <Panel title="By vendor" subtitle="Sorted by leads passed" icon={Store} flush>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-y border-gray-100 bg-gray-50/60 text-xs text-gray-500">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Vendor</th>
                  <th className="px-3 py-2.5 text-right font-medium">Leads</th>
                  <th className="px-3 py-2.5 text-right font-medium">Quoted</th>
                  <th className="px-3 py-2.5 text-right font-medium">Converted</th>
                  <th className="w-40 px-3 py-2.5 font-medium">Conversion</th>
                  <th className="px-5 py-2.5 text-right font-medium">Converted value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading &&
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={6} className="px-5 py-3.5">
                        <span className="block h-3 w-2/3 animate-pulse rounded bg-gray-100" />
                      </td>
                    </tr>
                  ))}
                {rows.map((s) => {
                  const rate = s.conversion_rate ?? pct(s.converted, s.leads);
                  return (
                    <tr key={s.vendor.id} className="transition-colors hover:bg-brand-50/40">
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-900">{s.vendor.name}</p>
                        <p className="flex items-center gap-1 text-xs text-gray-500">
                          <MapPin size={11} aria-hidden="true" />
                          <span className="truncate">{s.vendor.coverage || "No coverage set"}</span>
                        </p>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-gray-900">{fmt(s.leads)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-gray-700">{fmt(s.quoted)}</td>
                      <td className="px-3 py-3 text-right tabular-nums font-semibold text-emerald-700">
                        {fmt(s.converted)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
                            <div
                              className="h-full rounded-full bg-linear-to-r from-emerald-400 to-emerald-600"
                              style={{ width: `${Math.min(rate, 100)}%` }}
                            />
                          </div>
                          <span className="w-10 text-right text-xs tabular-nums text-gray-600">{rate}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-gray-900">{short(s.converted_value)}</td>
                    </tr>
                  );
                })}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-500">
                      No vendors yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </>
  );
}

// ── Vendors → KOC ───────────────────────────────────────────────────────
function VendorsToKoc() {
  return (
    <>
      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Key numbers">
        <Kpi icon={Inbox} label="Leads received" value="—" caption="From partner vendors" gradient="from-brand-600 to-brand-800" />
        <Kpi icon={BadgeCheck} label="Converted" value="—" caption="Became KOC orders" gradient="from-emerald-500 to-brand-700" />
        <Kpi icon={IndianRupee} label="Order value" value="—" caption="From converted leads" gradient="from-sky-500 to-sky-700" />
        <Kpi icon={Handshake} label="Commission payable" value="—" caption="KOC pays the referring vendor" gradient="from-amber-400 to-amber-600" />
      </section>

      <section className="mt-6 flex flex-col items-center rounded-2xl bg-white px-6 py-14 text-center ring-1 ring-gray-100 shadow-sm shadow-gray-200/60">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-brand-600 to-brand-800 text-white shadow-lg shadow-brand-700/25">
          <ArrowDownLeft size={24} aria-hidden="true" />
        </span>
        <h2 className="mt-5 text-lg font-semibold text-gray-900">No vendor referrals yet</h2>
        <p className="mt-2 max-w-md text-sm text-gray-500">
          When a partner vendor sends one of their customers to KOC, it will appear here with its status, quotation and
          the commission KOC owes that vendor.
        </p>
        <p className="mt-4 flex items-center gap-2 rounded-full bg-gray-50 px-4 py-2 text-xs text-gray-500 ring-1 ring-gray-100">
          Vendor <ArrowRight size={12} aria-hidden="true" /> KOC referrals need their own backend endpoint
        </p>
      </section>
    </>
  );
}

// ── Page ───────────────────────────────────────────────────────────────
// flow comes from the route: /flow/koc-to-vendors or /flow/vendors-to-koc
export default function LeadFlow({ flow }) {
  const navigate = useNavigate();
  const current = FLOWS[flow] ? flow : "koc-to-vendors";
  const f = FLOWS[current];
  return (
    <DashboardLayout title={f.title} description={f.description}>
      <FlowSwitch current={current} onChange={(id) => navigate(`/flow/${id}`)} />
      {current === "koc-to-vendors" ? <KocToVendors /> : <VendorsToKoc />}
    </DashboardLayout>
  );
}