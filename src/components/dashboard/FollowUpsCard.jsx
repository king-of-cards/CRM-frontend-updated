import { AlarmClock, Loader2, RefreshCw } from "lucide-react";
import { Link } from "react-router";
import { useState } from "react";
import { Panel } from "./DashboardParts.jsx";
import useFollowUpReminders from "./useFollowUpReminders.js";
import { reminderDate, reminderLeadDestination, reminderListDestination, reminderPhone, reminderRequestFor, reminderSourceLabel, reminderTag } from "./reminderUtils.js";

const tones = { red: "bg-rose-50 text-rose-700 ring-rose-200", amber: "bg-amber-50 text-amber-800 ring-amber-200", neutral: "bg-gray-100 text-gray-600 ring-gray-200" };

// One Lead flow's follow-ups only: flow "" = KOC → Vendors, "vendors" = Vendors → KOC, "dhruva"
export default function FollowUpsCard({ flow = "" }) {
  const { data, loading, error, refresh } = useFollowUpReminders({ flow });
  const [showSources, setShowSources] = useState(false);
  const request = reminderRequestFor(flow);
  const rows = (data?.items ?? []).slice(0, 8);
  const counts = data?.counts ?? {};
  const sources = [...new Set((data?.items ?? []).map((item) => item.source))];
  // A flow with a single list (Vendors → KOC, Dhruva): "View all" opens it directly
  const singleList = request.dhruva ? "dhruva" : request.sources.length === 1 ? request.sources[0] : null;
  return (
    <Panel title="Follow-ups" subtitle={request.label} icon={AlarmClock} right={
      singleList ? <Link id="follow-ups-view-all" to={reminderListDestination(singleList)} className="text-xs font-semibold text-brand-700 hover:underline">View all</Link> : (
        <div className="relative">
          <button type="button" aria-expanded={showSources} onClick={() => setShowSources((open) => !open)} disabled={!sources.length} className="text-xs font-semibold text-brand-700 hover:underline disabled:text-gray-400">View all</button>
          {showSources && <div className="absolute right-0 top-full z-20 mt-2 w-52 rounded-xl bg-white p-2 shadow-xl ring-1 ring-gray-200">
            {sources.map((source) => <Link key={source} to={reminderListDestination(source)} onClick={() => setShowSources(false)} className="block rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-brand-50">{reminderSourceLabel(source)}</Link>)}
          </div>}
        </div>
      )
    } flush>
      <div id="follow-ups" className="scroll-mt-24">
        <div className="flex flex-wrap gap-2 px-5 pb-2 text-xs">
          <span className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-700 ring-1 ring-rose-100">Overdue {counts.overdue ?? 0}</span>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-800 ring-1 ring-amber-100">Today {counts.today ?? 0}</span>
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-600 ring-1 ring-gray-200">Upcoming {counts.upcoming ?? 0}</span>
        </div>
        {error && <div className="px-5 py-2 text-xs text-gray-500">Couldn’t refresh follow-ups. <button type="button" onClick={refresh} className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline"><RefreshCw size={11} />Retry</button></div>}
        {loading && !data ? <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-gray-400" /></div> : rows.length ? (
          <ul className="divide-y divide-gray-100">
            {rows.map((item, index) => {
              const tag = reminderTag(item.days_overdue);
              const to = reminderLeadDestination(item);
              return (
                <li key={`${item.source}-${item.lead_key}-${index}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-gray-50">
                  <Link to={to} className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-medium text-gray-900">{item.name || reminderPhone(item.phone)}</span>
                      <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">{reminderSourceLabel(item.source)}</span>
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <span>{reminderDate(item.follow_up_date)}</span>
                      <span className={`rounded-full px-2 py-0.5 font-medium ring-1 ${tones[tag.tone]}`}>{tag.label}</span>
                    </span>
                  </Link>
                  {item.phone && <a href={`tel:${item.phone}`} aria-label={`Call ${item.name || reminderPhone(item.phone)}`} onClick={(event) => event.stopPropagation()} className="shrink-0 rounded-full bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-100">{reminderPhone(item.phone)}</a>}
                </li>
              );
            })}
          </ul>
        ) : !loading ? <p className="px-5 py-8 text-center text-sm text-gray-500">Nothing to follow up</p> : null}
      </div>
    </Panel>
  );
}
