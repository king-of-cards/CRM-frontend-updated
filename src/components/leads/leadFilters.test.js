import { describe, expect, test } from "bun:test";
import {
  activeCount,
  buildQuote,
  keysFor,
  clearedParams,
  filtersOfPeriod,
  pageSizeOf,
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
      q("search=asha&update_status=interested&update_status=pending&vendor_id=2&unassigned=true&branch=4&country=UAE&sort=created:desc"),
      "spin",
    );
    expect(f.search).toBe("asha");
    expect(f.update_status).toEqual(["interested", "pending"]);
    expect(f.vendor_id).toEqual(["2"]);
    expect(f.unassigned).toBe("true");
    expect(f.branch).toBe("4");
    expect(f.country).toBeUndefined(); // not a spin filter
    expect(f.sort).toBe("created:desc");
  });

  test("API query: only filters in use, sort not included", () => {
    const f = readFilters(q("search=&update_status=will_call_back&quote=gt:50000&conversion=none&budget_min=100000&sort=name:asc"), "wedding");
    expect(toApiQuery(f, "wedding")).toEqual({
      update_status: ["will_call_back"],
      quote: "gt:50000",
      conversion: "none",
      budget_min: "100000",
    });
  });

  test("query string repeats arrays and keeps key order", () => {
    expect(toQueryString({ page: 1, page_size: 10, update_status: ["interested", "pending"], search: "", sort: "x", order: "desc" })).toBe(
      "page=1&page_size=10&update_status=interested&update_status=pending&sort=x&order=desc",
    );
  });

  test("Update is a repeatable API filter on every lead list and round-trips in the URL", () => {
    for (const source of ["spin", "whatsapp", "wedding", "wedding_planner", "vendor_to_koc", "dhruva"]) {
      const filters = readFilters(q("update_status=interested&update_status=pending"), source);
      expect(filters.update_status).toEqual(["interested", "pending"]);
      expect(toApiQuery(filters, source).update_status).toEqual(["interested", "pending"]);
      expect(readFilters(q(toQueryString(toApiQuery(filters, source))), source).update_status).toEqual(["interested", "pending"]);
      expect(activeCount(filters, source)).toBe(1);
    }
    expect(clearedParams(q("update_status=interested&sort=name:asc")).has("update_status")).toBe(false);
  });

  test("Hot only is kept as a scalar API filter on the five supported lists", () => {
    for (const source of ["spin", "whatsapp", "wedding", "wedding_planner", "vendor_to_koc", "dhruva"]) {
      const filters = readFilters(q("hot=yes"), source);
      expect(filters.hot).toBe("yes");
      expect(toApiQuery(filters, source).hot).toBe("yes");
      expect(readFilters(q(toQueryString(toApiQuery(filters, source))), source).hot).toBe("yes");
      expect(activeCount(filters, source)).toBe(1);
    }
  });

  test("no filters: the same URL as the prefetched first page", () => {
    // prefetch.js uses the old wrappers: page, page_size, sort, order
    expect(toQueryString(listQuery({ page: 1, pageSize: 8, filters: {}, sort: "submitted_at", order: "desc" }))).toBe(
      "page=1&page_size=8&sort=submitted_at&order=desc",
    );
  });

  test("withFilters changes and removes keys; clearedParams keeps only the sort", () => {
    const next = withFilters(q("search=a&update_status=converted&sort=name:asc"), { update_status: ["interested", "pending"], search: "" });
    expect(next.getAll("update_status")).toEqual(["interested", "pending"]);
    expect(next.has("search")).toBe(false);
    expect(clearedParams(q("search=a&date_from=2026-11-01&update_status=interested&sort=name:asc")).toString()).toBe("sort=name%3Aasc");
  });
});

describe("active-filter count", () => {
  test("search and sort aren't counted; ranges and date pairs count once", () => {
    const f = readFilters(
      q("search=x&sort=a:b&date_from=2026-11-01&date_to=2026-11-05&budget_min=1&budget_max=9&guests_min=10&update_status=converted&city=Goa"),
      "wedding_planner",
    );
    expect(activeCount(f, "wedding_planner")).toBe(5); // date, update, city, guests, budget
  });
  test("Assigned to counts once for vendors + unassigned", () => {
    expect(activeCount(readFilters(q("vendor_id=1&vendor_id=2&unassigned=true"), "spin"), "spin")).toBe(1);
  });
  test("nothing set", () => {
    expect(activeCount(readFilters(q(""), "whatsapp"), "whatsapp")).toBe(0);
  });
  test("Dhruva filters count date and event ranges once, plus each active filter group", () => {
    const f = readFilters(q("date_from=2026-11-01&date_to=2026-11-05&event_from=2026-12-01&event_to=2026-12-31&event_type=wedding&event_type=engagement&update_status=pending&has_phone=no"), "dhruva");
    expect(activeCount(f, "dhruva")).toBe(5);
  });
  test("Dhruva keeps only its API filters and repeats event types", () => {
    const f = readFilters(q("venue=Palace&event_type=wedding&event_type=engagement&also_in=yes&vendor_id=2&sort=name:asc"), "dhruva");
    expect(toApiQuery(f, "dhruva")).toEqual({ venue: "Palace", event_type: ["wedding", "engagement"], also_in: "yes" });
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

describe("rows per page in the URL", () => {
  test("?page_size: 10 / 25 / 50 / 100, anything else = 10", () => {
    expect(pageSizeOf(q("page_size=25"))).toBe(25);
    expect(pageSizeOf(q("page_size=100"))).toBe(100);
    expect(pageSizeOf(q(""))).toBe(10);
    expect(pageSizeOf(q("page_size=8"))).toBe(10);
    expect(pageSizeOf(q("page_size=abc"))).toBe(10);
  });
  test("not a filter: not in the API query, the badge or the export filters", () => {
    const f = readFilters(q("page_size=50&update_status=interested"), "wedding");
    expect(toApiQuery(f, "wedding")).toEqual({ update_status: ["interested"] });
    expect(activeCount(f, "wedding")).toBe(1);
  });
  test("Clear filters keeps it, with the sort", () => {
    expect(clearedParams(q("page_size=50&search=a&update_status=interested&sort=name:asc")).toString()).toBe(
      "sort=name%3Aasc&page_size=50",
    );
  });
});

describe("Vendors → KOC quote and conversion filters", () => {
  test("kept in the URL and sent to the list, stats and export", () => {
    const f = readFilters(q("quote=has&conversion=gt:50000&city=Goa"), "vendor_to_koc");
    expect(toApiQuery(f, "vendor_to_koc")).toEqual({ quote: "has", conversion: "gt:50000", city: "Goa" });
  });
  test("each counts once on the Filters badge", () => {
    expect(activeCount(readFilters(q("quote=has&conversion=none"), "vendor_to_koc"), "vendor_to_koc")).toBe(2);
  });
});

describe("Wedding gifts filters", () => {
  test("the same URL keys as Spin: branch, pincode, budget and the common filters", () => {
    expect(keysFor("wedding_gifts")).toEqual(keysFor("spin"));
    const f = readFilters(q("branch=4&pincode=560&budget=10-20&hot=yes&also_in=yes&update_status=pending"), "wedding_gifts");
    expect(toApiQuery(f, "wedding_gifts")).toEqual({ branch: "4", pincode: "560", budget: "10-20", hot: "yes", also_in: "yes", update_status: ["pending"] });
  });
});
