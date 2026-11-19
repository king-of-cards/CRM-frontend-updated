import { describe, expect, test } from "bun:test";
import { topCityRows, topCityTooltipData } from "./topCities.js";

describe("Top cities tooltip data", () => {
  test("keeps the API per-source counts and labels", () => {
    expect(topCityTooltipData({ count: 6, by_source: { wedding: 2, wedding_planner: 3, vendor_to_koc: 1 } }).map((part) => part.count)).toEqual([1, 2, 3]);
    const labels = topCityTooltipData({ by_source: { wedding: 2, wedding_planner: 3, vendor_to_koc: 1 } }).map((part) => part.label);
    expect(labels[0].startsWith("Vendors")).toBe(true);
    expect(labels.slice(1)).toEqual(["Wedding", "Wedding planner"]);
  });
  test("supports the KOC dashboard's source-specific rows", () => {
    expect(topCityRows([{ value: "Mysuru", count: 4 }], "vendor_to_koc")[0].bySource).toEqual([
      { source: "vendor_to_koc", label: "Vendors → KOC", count: 4 },
    ]);
  });
});
