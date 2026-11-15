import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import {
  activeCount,
  clearedParams,
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
  return {
    filters,
    query,
    queryKey,
    update,
    clear,
    count: activeCount(filters, source),
  };
}
