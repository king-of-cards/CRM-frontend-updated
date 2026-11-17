import { describe, expect, test } from "bun:test";
import { dashboardKpiCards, num, statusRows } from "./dhruvaDashboard.js";

describe("num", () => {
  test("formats numbers with Indian grouping", () => {
    expect(num(1000)).toBe("1,000");
    expect(num(100000)).toBe("1,00,000");
  });
  test("returns — for 0 or null", () => {
    expect(num(0)).toBe("—");
    expect(num(null)).toBe("—");
    expect(num(undefined)).toBe("—");
  });
});

describe("statusRows", () => {
  test("starts with Pending, then the 7 statuses", () => {
    const rows = statusRows({ pending: 5, converted: 2 });
    expect(rows[0].key).toBe("pending");
    expect(rows[0].count).toBe(5);
    expect(rows[1].key).toBe("converted");
    expect(rows[1].count).toBe(2);
    expect(rows.length).toBe(8); // 1 pending + 7 statuses
  });
  test("fills zeros for missing statuses", () => {
    const rows = statusRows({});
    expect(rows.every((r) => r.count === 0)).toBe(true);
  });
  test("each row has filters", () => {
    const rows = statusRows({ pending: 1 });
    expect(rows[0].filters).toEqual({ update_status: ["pending"] });
  });
});

describe("dashboardKpiCards", () => {
  test("produces 8 cards", () => {
    const cards = dashboardKpiCards({}, null);
    expect(cards.length).toBe(8);
  });
  test("Total leads opens the period list and every filtered card links even at zero", () => {
    const cards = dashboardKpiCards({ total: 10, pending: 0 }, { from: "2026-11-01", to: "2026-11-05" });
    expect(cards[0].label).toBe("Total leads");
    expect(cards[0].to).toBe("/dhruva-leads?date_from=2026-11-01&date_to=2026-11-05");
    expect(cards[1].to).toBe("/dhruva-leads?update_status=pending&date_from=2026-11-01&date_to=2026-11-05");
  });
  test("Pending card links to the matching filter", () => {
    const cards = dashboardKpiCards({ pending: 3 }, null);
    expect(cards[1].to).toContain("update_status=pending");
  });
  test("Quoted amount shows count and total", () => {
    const cards = dashboardKpiCards({ quoted_count: 2, quoted_total: 90000 }, null);
    const card = cards[4];
    expect(card.label).toBe("Quoted amount");
    expect(card.value).toBe("₹90,000");
    expect(card.caption).toBe("₹ · 2 quotes");
    expect(card.to).toContain("quote=has");
  });
  test("the Dhruva KPI labels and captions use the standard names", () => {
    const cards = dashboardKpiCards({ total: 10, pending: 2, interested: 3, not_interested: 1, quoted_count: 2, quoted_total: 90000, converted: 4, converted_pct: 40, conversion_count: 1, conversion_total: 25000, upcoming_30_days: 5 }, null);
    expect(cards.map((card) => card.label)).toEqual([
      "Total leads", "Pending", "Interested", "Not interested", "Quoted amount", "Converted", "Conversion amount", "Upcoming events (30 days)",
    ]);
    expect(cards[5]).toMatchObject({ value: "4", caption: "4 · 40% conversion rate" });
    expect(cards[6]).toMatchObject({ value: "₹25,000", caption: "1 with conversion amount" });
    expect(cards[7].label).toBe("Upcoming events (30 days)");
  });
  test("each filtered KPI uses the requested list filter", () => {
    const cards = dashboardKpiCards({ total: 0, pending: 0, interested: 0, not_interested: 0, quoted_count: 0, converted: 0, conversion_count: 0, upcoming_30_days: 0 }, null);
    expect(cards.map((card) => card.to)).toEqual([
      "/dhruva-leads",
      "/dhruva-leads?update_status=pending",
      "/dhruva-leads?update_status=interested",
      "/dhruva-leads?update_status=not_interested",
      "/dhruva-leads?quote=has",
      "/dhruva-leads?update_status=converted",
      "/dhruva-leads?update_status=converted",
      "/dhruva-leads?upcoming_days=30",
    ]);
  });
  test("Upcoming events links to list with upcoming_days=30", () => {
    const cards = dashboardKpiCards({ upcoming_30_days: 5 }, { from: "2026-11-01", to: "2026-11-05" });
    expect(cards[7].to).toContain("upcoming_days=30");
    expect(cards[7].to).toContain("date_from=2026-11-01");
    expect(cards[7].to).toContain("date_to=2026-11-05");
    expect(cards[6].to).toContain("update_status=converted");
  });
});
