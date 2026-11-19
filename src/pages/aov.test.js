import { describe, expect, test } from "bun:test";
import { AOV_FILTERS, aov, aovOf } from "./aov.js";

describe("aov", () => {
  test("total divided by count", () => {
    expect(aov(4, 180000)).toBe(45000);
    expect(aov(3, 100000)).toBeCloseTo(33333.33, 2);
  });
  test("null without converted leads with an amount", () => {
    expect(aov(0, 0)).toBeNull();
    expect(aov(0, 5000)).toBeNull();
    expect(aov(null, null)).toBeNull();
    expect(aov(undefined, 100)).toBeNull();
  });
  test("numbers sent as strings still work", () => {
    expect(aov("2", "90000")).toBe(45000);
  });
  test("a bad total gives null", () => {
    expect(aov(2, "abc")).toBeNull();
  });
});

describe("aovOf", () => {
  test("one kpis object", () => {
    expect(aovOf({ conversion_amount_count: 2, conversion_amount_total: 100000 })).toEqual({ value: 50000, count: 2 });
  });
  test("Wedding + Wedding planner outcomes are summed before dividing", () => {
    const wedding = { conversion_amount_count: 1, conversion_amount_total: 30000 };
    const planner = { conversion_amount_count: 3, conversion_amount_total: 170000 };
    expect(aovOf(wedding, planner)).toEqual({ value: 50000, count: 4 });
  });
  test("ignores the older conversion_count / conversion_total", () => {
    expect(aovOf({ conversion_count: 5, conversion_total: 500000 })).toEqual({ value: null, count: 0 });
  });
  test("missing or null parts", () => {
    expect(aovOf(null, undefined)).toEqual({ value: null, count: 0 });
    expect(aovOf(null, { conversion_amount_count: 1, conversion_amount_total: 20000 })).toEqual({ value: 20000, count: 1 });
  });
});

describe("AOV_FILTERS", () => {
  test("converted leads with a conversion amount", () => {
    expect(AOV_FILTERS).toEqual({ update_status: "converted", conversion: "has" });
  });
});
