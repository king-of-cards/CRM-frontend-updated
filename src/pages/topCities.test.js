import { describe, expect, test } from "bun:test";
import { TOP_CITIES_DEFAULTS, topCitiesSubtitle, topCitiesSubtitleFor, topCityRows, topCityTooltipData } from "./topCities.js";

describe("Top cities tooltip data", () => {
  test("keeps the API per-source counts and labels", () => {
    expect(topCityTooltipData({ count: 6, by_source: { wedding: 2, wedding_planner: 3, vendor_to_koc: 1 } }).map((part) => part.count)).toEqual([1, 2, 3]);
    const labels = topCityTooltipData({ by_source: { wedding: 2, wedding_planner: 3, vendor_to_koc: 1 } }).map((part) => part.label);
    expect(labels[0].startsWith("Vendors")).toBe(true);
    expect(labels.slice(1)).toEqual(["Wedding", "Wedding planner"]);
  });
  test("includes Spin's count in the tooltip", () => {
    expect(topCityTooltipData({ count: 5, by_source: { spin: 3, wedding: 2 } })).toEqual([
      { source: "spin", label: "Spin", count: 3 },
      { source: "wedding", label: "Wedding", count: 2 },
    ]);
  });
  test("supports the KOC dashboard's source-specific rows", () => {
    expect(topCityRows([{ value: "Mysuru", count: 4 }], "vendor_to_koc")[0].bySource).toEqual([
      { source: "vendor_to_koc", label: "Vendors → KOC", count: 4 },
    ]);
  });
});

describe("Top cities subtitle (top_cities_sources)", () => {
  test("lists the included sources in the API's order", () => {
    expect(topCitiesSubtitle(["spin", "wedding", "wedding_planner", "vendor_to_koc"])).toBe(
      "Spin, Wedding, Wedding planner, Vendors → KOC",
    );
  });
  test("spin left out when the workflow database can't be read", () => {
    expect(topCitiesSubtitle(["wedding", "wedding_planner", "vendor_to_koc"])).toBe("Wedding, Wedding planner, Vendors → KOC");
  });
  test("falls back when there's no list", () => {
    expect(topCitiesSubtitle(undefined)).toBe("All sources");
    expect(topCitiesSubtitle([], "Vendors → KOC leads")).toBe("Vendors → KOC leads");
  });
});

describe("Top cities per Lead flow (API defaults)", () => {
  test("the defaults match the API's per-flow defaults", () => {
    expect(TOP_CITIES_DEFAULTS[""]).toEqual(["spin", "wedding", "wedding_planner"]);
    expect(TOP_CITIES_DEFAULTS.vendors).toEqual(["vendor_to_koc"]);
  });
  test("top_cities_sources wins when the API sends it", () => {
    expect(topCitiesSubtitleFor(["wedding", "wedding_planner"], "")).toBe("Wedding, Wedding planner");
    expect(topCitiesSubtitleFor(["vendor_to_koc"], "vendors")).toBe("Vendors → KOC");
  });
  test("without a list the flow's own defaults are named, never 'All sources'", () => {
    expect(topCitiesSubtitleFor(undefined, "")).toBe("Spin, Wedding, Wedding planner");
    expect(topCitiesSubtitleFor([], "vendors")).toBe("Vendors → KOC");
    expect(topCitiesSubtitleFor(null)).toBe("Spin, Wedding, Wedding planner");
  });
  test("Wedding gifts is no longer a place: an old key is left out of the tooltip", () => {
    expect(topCityTooltipData({ count: 3, by_source: { spin: 1, wedding_gifts: 2 } })).toEqual([
      { source: "spin", label: "Spin", count: 1 },
    ]);
    expect(topCitiesSubtitle(["spin", "wedding"])).toBe("Spin, Wedding");
  });
});
