import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { getLeadActivity } from "../../api/leadActivity.js";
import { activityActorRole, activityDescription, activityTime, groupActivityByDay } from "./activityUtils.js";

const PAGE_SIZE = 25;

// The entries, grouped by day. vendorName(id) -> name turns vendor ids into names (optional).
export function ActivityList({ items, vendorName }) {
  const groups = groupActivityByDay(items ?? []);
  return (
    <>
      {groups.map((group) => (
        <div key={group.key}>
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">{group.title}</h4>
          <ol className="space-y-3 border-l border-gray-200 pl-4">
            {group.items.map((item, index) => {
              const time = activityTime(item.created_at);
              return (
                <li key={`${item.created_at}-${item.field}-${index}`} className="relative">
                  <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand-500 ring-4 ring-white" aria-hidden="true" />
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                    <span className="font-medium text-gray-700">{item.actor_name || "Unknown"}</span>
                    {item.actor_role && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">{activityActorRole(item.actor_role)}</span>}
                    <time className="ml-auto" dateTime={item.created_at} title={time.exact}>{time.relative}</time>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-800">{activityDescription(item, vendorName)}</p>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </>
  );
}

export default function LeadActivity({ source, leadKey, refreshKey = 0, vendorName }) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async (nextPage = 1) => {
    if (leadKey == null) return;
    setLoading(true);
    setError(false);
    try {
      const result = await getLeadActivity({ source, leadKey, page: nextPage, pageSize: PAGE_SIZE });
      setItems((current) => nextPage === 1 ? result.items ?? [] : [...current, ...(result.items ?? [])]);
      setPage(result.page ?? nextPage);
      setPages(result.pages ?? 0);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [source, leadKey]);

  useEffect(() => { setItems([]); setPage(0); setPages(0); load(1); }, [load, refreshKey]);

  return (
    <section aria-label="Activity" className="rounded-3xl bg-white/80 p-5 ring-1 ring-gray-100 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-900">Activity</h3>
        {loading && <Loader2 size={15} className="animate-spin text-gray-400" aria-label="Loading activity" />}
      </div>
      {error ? (
        <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
          <span>Activity couldn’t be loaded.</span>
          <button type="button" onClick={() => load(1)} className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"><RefreshCw size={12} />Retry</button>
        </div>
      ) : !loading && !items.length ? (
        <p className="mt-3 text-sm text-gray-500">No changes recorded yet</p>
      ) : (
        <div className="mt-4 space-y-5">
          <ActivityList items={items} vendorName={vendorName} />
          {page < pages && <button type="button" onClick={() => load(page + 1)} disabled={loading} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50">Load more</button>}
        </div>
      )}
    </section>
  );
}
