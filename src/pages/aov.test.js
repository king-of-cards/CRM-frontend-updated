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
  test("a dashboard's kpis", () => {
    expect(aovOf({ conversion_amount_count: 2, conversion_amount_total: 100000 })).toEqual({ value: 50000, count: 2 });
  });
  test("ignores the older conversion_count / conversion_total", () => {
    expect(aovOf({ conversion_count: 5, conversion_total: 500000 })).toEqual({ value: null, count: 0 });
  });
  test("missing or null kpis", () => {
    expect(aovOf(null)).toEqual({ value: null, count: 0 });
    expect(aovOf(undefined)).toEqual({ value: null, count: 0 });
    expect(aovOf({})).toEqual({ value: null, count: 0 });
  });
});

describe("AOV_FILTERS", () => {
  test("converted leads with a conversion amount", () => {
    expect(AOV_FILTERS).toEqual({ update_status: "converted", conversion: "has" });
  });
});
