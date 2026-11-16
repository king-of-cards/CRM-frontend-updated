import { describe, expect, test } from "bun:test";
import { outcomeCells, outcomeLink, shortRupees } from "./dashboardOutcomes.js";

const texts = (o) => outcomeCells(o).map((c) => c.text);

describe("outcome values", () => {
  test("normal values", () => {
    expect(
      texts({ leads: 60, interested: 12, converted: 5, converted_pct: 8.3, quoted_count: 6, quoted_total: 240000 }),
    ).toEqual(["12", "5 · 8.3%", "₹2.4 L · 6 quotes"]);
  });
  test("one quote; % hidden when null", () => {
    expect(texts({ interested: 1, converted: 1, converted_pct: null, quoted_count: 1, quoted_total: 45000 })).toEqual([
      "1",
      "1",
      "₹45,000 · 1 quote",
    ]);
  });
  test("zeros and a missing source show — and aren't links", () => {
    const zero = outcomeCells({ leads: 3, interested: 0, converted: 0, converted_pct: 0, quoted_count: 0, quoted_total: 0 });
    expect(zero.map((c) => c.text)).toEqual(["—", "—", "—"]);
    expect(zero.every((c) => c.filter === null)).toBe(true);
    expect(texts(null)).toEqual(["—", "—", "—"]);
  });
  test("labels", () => {
    expect(outcomeCells({}).map((c) => c.label)).toEqual(["INTERESTED", "CONVERTED", "QUOTATION AMOUNT"]);
  });
  test("short Indian amounts", () => {
    expect(shortRupees(45000)).toBe("₹45,000");
    expect(shortRupees(150000)).toBe("₹1.5 L");
    expect(shortRupees(12000000)).toBe("₹1.2 Cr");
  });
});

describe("links", () => {
  const cells = outcomeCells({ interested: 2, converted: 1, quoted_count: 1, quoted_total: 5000 });
  test("filter + the Dashboard's dates", () => {
    const period = { from: "2026-10-18", to: "2026-11-16" };
    expect(cells.map((c) => outcomeLink("/leads/wedding", c.filter, period))).toEqual([
      "/leads/wedding?update_status=interested&date_from=2026-10-18&date_to=2026-11-16",
      "/leads/wedding?update_status=converted&date_from=2026-10-18&date_to=2026-11-16",
      "/leads/wedding?quote=has&date_from=2026-10-18&date_to=2026-11-16",
    ]);
  });
  test("All time: no dates", () => {
    expect(outcomeLink("/leads/spin", cells[0].filter, { all: true })).toBe("/leads/spin?update_status=interested");
  });
});
