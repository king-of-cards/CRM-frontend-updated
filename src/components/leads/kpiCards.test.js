import { describe, expect, test } from "bun:test";
import { kpiCards } from "./kpiCards.js";

const values = (k) => kpiCards(k).map((c) => [c.label, c.value]);

describe("KPI cards (stats.kpis)", () => {
  test("the six cards, in order, with their formats", () => {
    expect(
      values({
        total: 120,
        interested: 14,
        not_interested: 9,
        quoted_count: 11,
        quoted_total: 1650000,
        converted: 6,
        converted_pct: 5.0,
        conversion_count: 5,
        conversion_total: 720000,
      }),
    ).toEqual([
      ["Total leads", "120"],
      ["Interested", "14"],
      ["Not interested", "9"],
      ["Quoted amount", "₹16.5 L · 11 quotes"],
      ["Converted", "6 · 5%"],
      ["Conversion amount", "₹7.2 L · 5"],
    ]);
  });
  test("— for zero or missing values (and while loading)", () => {
    const zero = { total: 0, interested: 0, not_interested: 0, quoted_count: 0, quoted_total: 0, converted: 0, converted_pct: null, conversion_count: 0, conversion_total: 0 };
    expect(kpiCards(zero).map((c) => c.value)).toEqual(["—", "—", "—", "—", "—", "—"]);
    expect(kpiCards(undefined).map((c) => c.value)).toEqual(["—", "—", "—", "—", "—", "—"]);
  });
  test("one quote; % hidden when null", () => {
    expect(values({ total: 3, quoted_count: 1, quoted_total: 45000, converted: 1, converted_pct: null })).toEqual([
      ["Total leads", "3"],
      ["Interested", "—"],
      ["Not interested", "—"],
      ["Quoted amount", "₹45,000 · 1 quote"],
      ["Converted", "1"],
      ["Conversion amount", "—"],
    ]);
  });
});
