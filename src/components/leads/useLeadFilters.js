import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import {
  activeCount,
  clearedParams,
  PAGE_SIZES,
  pageSizeOf,
  readFilters,
  toApiQuery,
  toQueryString,
  withFilters,
} from "./leadFilters.js";

// A source page's filters, kept in the URL (?search=…&interest=…&sort=…).
//   filters:  { key: "" | value | [values], sort }
//   query:    the API query for the list, stats and export (no paging / sort)
//   queryKey: the same as a string, for effect dependencies (changes reset the page to 1)
//   update({ key: value }): change filters ("" / [] removes one); clear(): all but the sort
//   apply(draft): compatibility helper for callers that still provide a URL draft
//   clearFilters(): clear every filter, preserving sort and page size
//   pageSize / setPageSize(n): rows per page, kept in the URL (?page_size=25; 10 = not written)
export function useLeadFilters(source) {
  const [params, setParams] = useSearchParams();
  const raw = params.toString();
  const filters = useMemo(
    () => readFilters(new URLSearchParams(raw), source),
    [raw, source],
  );
  const query = useMemo(() => toApiQuery(filters, source), [filters, source]);
  const queryKey = toQueryString(query);
  const update = useCallback(
    (updates) => setParams((prev) => withFilters(prev, updates), { replace: true }),
    [setParams],
  );
  const clear = useCallback(
    () => setParams((prev) => clearedParams(prev), { replace: true }),
    [setParams],
  );
  const keepSearchAndSort = (prev, next) => {
    for (const k of ["search", "sort", "date_from", "date_to", "page_size"]) {
      const v = prev.get(k);
      if (v) next.set(k, v);
      else next.delete(k);
    }
    return next;
  };
  const apply = useCallback(
    (draft) => setParams((prev) => keepSearchAndSort(prev, new URLSearchParams(draft)), { replace: true }),
    [setParams],
  );
  const clearFilters = clear;
  const pageSize = pageSizeOf(new URLSearchParams(raw));
  const setPageSize = useCallback(
    (n) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (n === PAGE_SIZES[0]) next.delete("page_size");
          else next.set("page_size", String(n));
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );
  return {
    filters,
    pageSize,
    setPageSize,
    query,
    queryKey,
    update,
    clear,
    apply,
    clearFilters,
    count: activeCount(filters, source),
  };
}
