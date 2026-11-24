// Loading placeholders shaped like the content they stand in for (no spinners).
// Each group says "Loading" to screen readers once; the shapes themselves are hidden from them.

const pulse = "animate-pulse motion-reduce:animate-none bg-gray-100";

// One grey shape. className sets its size and rounding (default: a text line).
export function Bone({ className = "h-3 w-full rounded" }) {
  return <span aria-hidden="true" className={`block ${pulse} ${className}`} />;
}

function Loading({ label = "Loading" }) {
  return <span className="sr-only">{label}</span>;
}

// Widths that vary row to row so the placeholder reads like real text
const WIDTHS = ["w-3/4", "w-1/2", "w-2/3", "w-5/6", "w-2/5", "w-3/5"];

// Table body rows: cols cells per row (use inside <tbody>)
export function SkeletonRows({ rows = 6, cols = 5, label = "Loading rows" }) {
  return Array.from({ length: rows }, (_, r) => (
    <tr key={`skeleton-${r}`} className="border-b border-gray-50" aria-hidden={r > 0 ? "true" : undefined}>
      {Array.from({ length: cols }, (_, c) => (
        <td key={c} className="px-4 py-3.5 sm:px-6">
          {r === 0 && c === 0 && <Loading label={label} />}
          {c === 0 ? (
            <span className="block space-y-1.5">
              <Bone className={`h-3.5 rounded ${WIDTHS[r % WIDTHS.length]} min-w-24`} />
              <Bone className="h-2.5 w-24 rounded" />
            </span>
          ) : (
            <Bone className={`h-3 rounded ${WIDTHS[(r + c) % WIDTHS.length]} min-w-12`} />
          )}
        </td>
      ))}
    </tr>
  ));
}

// A chart area: bars along a baseline, filling the parent's height
export function ChartSkeleton({ className = "h-full", label = "Loading chart" }) {
  const bars = [45, 70, 55, 85, 40, 65, 90, 50, 75, 60, 35, 80];
  return (
    <div role="status" className={`flex w-full flex-col ${className}`}>
      <Loading label={label} />
      <div aria-hidden="true" className="flex min-h-24 flex-1 items-end gap-2 border-b border-l border-gray-100 px-2 pt-4">
        {bars.map((h, i) => (
          <span key={i} className={`flex-1 rounded-t-md ${pulse}`} style={{ height: `${h}%` }} />
        ))}
      </div>
      <div aria-hidden="true" className="mt-2 flex justify-between px-2">
        {[0, 1, 2, 3].map((i) => <Bone key={i} className="h-2 w-10 rounded" />)}
      </div>
    </div>
  );
}

// A list of items: optional round icon, a title line and a detail line
export function ListSkeleton({ rows = 4, avatar = true, className = "", label = "Loading" }) {
  return (
    <ul role="status" className={`divide-y divide-gray-100 ${className}`}>
      <Loading label={label} />
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} aria-hidden="true" className="flex items-center gap-3 px-5 py-3">
          {avatar && <Bone className="h-8 w-8 shrink-0 rounded-full" />}
          <span className="min-w-0 flex-1 space-y-1.5">
            <Bone className={`h-3 rounded ${WIDTHS[i % WIDTHS.length]}`} />
            <Bone className="h-2.5 w-1/3 rounded" />
          </span>
        </li>
      ))}
    </ul>
  );
}

// A ranked list of bars (label, count, bar)
export function BarListSkeleton({ rows = 5, label = "Loading" }) {
  return (
    <ul role="status" className="space-y-3">
      <Loading label={label} />
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} aria-hidden="true">
          <div className="flex items-center justify-between">
            <Bone className={`h-3 rounded ${WIDTHS[i % WIDTHS.length]} max-w-40`} />
            <Bone className="h-3 w-8 rounded" />
          </div>
          <Bone className="mt-1.5 h-1.5 w-full rounded-full" />
        </li>
      ))}
    </ul>
  );
}

// A KPI card: label, icon square, big number
export function KpiSkeleton() {
  return (
    <div aria-hidden="true" className="rounded-2xl bg-white p-5 ring-1 ring-gray-100 shadow-sm shadow-gray-200/60">
      <div className="flex items-start justify-between">
        <Bone className="h-3.5 w-24 rounded" />
        <Bone className="h-9 w-9 rounded-xl" />
      </div>
      <Bone className="mt-3 h-8 w-24 rounded-lg" />
    </div>
  );
}

// A dashboard panel: title, subtitle and a chart
export function PanelSkeleton({ chart = "h-64" }) {
  return (
    <div aria-hidden="true" className="rounded-2xl bg-white p-5 ring-1 ring-gray-100 shadow-sm shadow-gray-200/60">
      <Bone className="h-4 w-40 rounded" />
      <Bone className="mt-2 h-3 w-56 rounded" />
      <div className={`mt-5 ${chart}`}>
        <ChartSkeleton label="" />
      </div>
    </div>
  );
}

// A dashboard body: KPI cards, then chart panels
export function DashboardSkeleton({ kpis = 6, panels = 4, label = "Loading dashboard" }) {
  return (
    <div role="status">
      <Loading label={label} />
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: kpis }, (_, i) => <KpiSkeleton key={i} />)}
      </div>
      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {Array.from({ length: panels }, (_, i) => <PanelSkeleton key={i} />)}
      </div>
    </div>
  );
}

// A form in a drawer or dialog: label + field pairs
export function FormSkeleton({ fields = 6, label = "Loading form" }) {
  return (
    <div role="status" className="space-y-4 py-2">
      <Loading label={label} />
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} aria-hidden="true" className="space-y-1.5">
          <Bone className={`h-3 rounded ${i % 2 ? "w-24" : "w-32"}`} />
          <Bone className="h-10 w-full rounded-xl" />
        </div>
      ))}
    </div>
  );
}

// The whole frame while a page's code or the session loads: sidebar, top bar, dashboard body.
// Replaces the old full-page spinner.
export function PageSkeleton({ label = "Loading" }) {
  return (
    <div role="status" className="flex min-h-screen bg-gray-50">
      <Loading label={label} />
      <aside aria-hidden="true" className="hidden w-64 shrink-0 flex-col gap-2 bg-linear-to-b from-brand-800 to-brand-700 p-4 md:flex">
        <span className="mb-6 block h-8 w-28 rounded-lg bg-white/15" />
        {[0, 1, 2, 3].map((i) => <span key={i} className="block h-10 rounded-xl bg-white/10" />)}
      </aside>
      <main aria-hidden="true" className="min-w-0 flex-1 px-3 pt-3 sm:px-6 sm:pt-4">
        <div className="mx-auto h-14 max-w-4xl rounded-full bg-linear-to-r from-brand-800 via-brand-700 to-brand-600 opacity-90" />
        <div className="mt-6 space-y-2">
          <Bone className="h-6 w-48 rounded-lg" />
          <Bone className="h-3.5 w-72 max-w-full rounded" />
        </div>
        <DashboardSkeleton kpis={3} panels={2} label="" />
      </main>
    </div>
  );
}
