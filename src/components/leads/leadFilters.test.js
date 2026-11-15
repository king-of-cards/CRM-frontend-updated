import { describe, expect, test } from "bun:test";
import {
  activeCount,
  buildQuote,
  clearedParams,
  filtersOfPeriod,
  parseQuote,
  periodOfFilters,
  readFilters,
  toApiQuery,
  toQueryString,
  withFilters,
} from "./leadFilters.js";
import { listQuery } from "../../api/leadLists.js";

const q = (s) => new URLSearchParams(s);

describe("URL <-> filters", () => {
  test("reads common, repeated and per-source keys; ignores other sources' keys", () => {
    const f = readFilters(
      q("search=asha&interest=interested&interest=not_set&vendor_id=2&unassigned=true&branch=4&country=UAE&sort=created:desc"),
      "spin",
    );
    expect(f.search).toBe("asha");
    expect(f.interest).toEqual(["interested", "not_set"]);
    expect(f.vendor_id).toEqual(["2"]);
    expect(f.unassigned).toBe("true");
    expect(f.branch).toBe("4");
    expect(f.country).toBeUndefined(); // not a spin filter
    expect(f.sort).toBe("created:desc");
  });

  test("API query: only filters in use, sort not included", () => {
    const f = readFilters(q("search=&interest=other&quote=gt:50000&budget_min=100000&sort=name:asc"), "wedding");
    expect(toApiQuery(f, "wedding")).toEqual({ interest: ["other"], quote: "gt:50000", budget_min: "100000" });
  });

  test("query string repeats arrays and keeps key order", () => {
    expect(toQueryString({ page: 1, page_size: 8, interest: ["interested", "not_set"], search: "", sort: "x", order: "desc" })).toBe(
      "page=1&page_size=8&interest=interested&interest=not_set&sort=x&order=desc",
    );
  });

  test("no filters: the same URL as the prefetched first page", () => {
    // prefetch.js uses the old wrappers: page, page_size, sort, order
    expect(toQueryString(listQuery({ page: 1, pageSize: 8, filters: {}, sort: "submitted_at", order: "desc" }))).toBe(
      "page=1&page_size=8&sort=submitted_at&order=desc",
    );
  });

  test("withFilters changes and removes keys; clearedParams keeps only the sort", () => {
    const next = withFilters(q("search=a&interest=other&sort=name:asc"), { interest: ["interested", "not_set"], search: "" });
    expect(next.getAll("interest")).toEqual(["interested", "not_set"]);
    expect(next.has("search")).toBe(false);
    expect(clearedParams(q("search=a&date_from=2026-11-01&interest=other&sort=name:asc")).toString()).toBe("sort=name%3Aasc");
  });
});

describe("active-filter count", () => {
  test("search and sort aren't counted; ranges and date pairs count once", () => {
    const f = readFilters(
      q("search=x&sort=a:b&date_from=2026-11-01&date_to=2026-11-05&budget_min=1&budget_max=9&guests_min=10&interest=other&city=Goa"),
      "wedding_planner",
    );
    expect(activeCount(f, "wedding_planner")).toBe(5); // date, interest, city, guests, budget
  });
  test("Assigned to counts once for vendors + unassigned", () => {
    expect(activeCount(readFilters(q("vendor_id=1&vendor_id=2&unassigned=true"), "spin"), "spin")).toBe(1);
  });
  test("nothing set", () => {
    expect(activeCount(readFilters(q(""), "whatsapp"), "whatsapp")).toBe(0);
  });
});

describe("quote", () => {
  test("parse and build", () => {
    expect(parseQuote("gt:50000")).toEqual({ op: "gt", amount: "50000" });
    expect(parseQuote("has")).toEqual({ op: "has", amount: "" });
    expect(parseQuote("bad")).toEqual({ op: "", amount: "" });
    expect(buildQuote("lt", "1,00,000")).toBe("lt:100000");
    expect(buildQuote("gt", "")).toBe("");
    expect(buildQuote("none", "5")).toBe("none");
    expect(buildQuote("", "5")).toBe("");
  });
});

describe("arrival date <-> period", () => {
  test("no dates = All time (the default for lists)", () => {
    expect(periodOfFilters({ date_from: "", date_to: "" })).toEqual({ all: true });
    expect(filtersOfPeriod({ all: true })).toEqual({ date_from: "", date_to: "" });
  });
  test("dates", () => {
    expect(periodOfFilters({ date_from: "2026-11-01", date_to: "" })).toEqual({ from: "2026-11-01", to: "2026-11-01" });
    expect(filtersOfPeriod({ from: "2026-11-01", to: "2026-11-05" })).toEqual({ date_from: "2026-11-01", date_to: "2026-11-05" });
  });
});
