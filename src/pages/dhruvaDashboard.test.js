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
  test("Total leads card has no link", () => {
    const cards = dashboardKpiCards({ total: 10 }, null);
    expect(cards[0].label).toBe("Total leads");
    expect(cards[0].to).toBeNull();
  });
  test("Pending card links to list when non-zero", () => {
    const cards = dashboardKpiCards({ pending: 3 }, null);
    expect(cards[1].to).toContain("update_status=pending");
  });
  test("Pending card has no link when zero", () => {
    const cards = dashboardKpiCards({ pending: 0 }, null);
    expect(cards[1].to).toBeNull();
  });
  test("Quoted amount shows count and total", () => {
    const cards = dashboardKpiCards({ quoted_count: 2, quoted_total: 90000 }, null);
    const card = cards[4];
    expect(card.value).toContain("2 quotes");
    expect(card.to).toContain("quote=has");
  });
  test("Upcoming events links to list with upcoming_days=30", () => {
    const cards = dashboardKpiCards({ upcoming_30_days: 5 }, null);
    expect(cards[7].to).toContain("upcoming_days=30");
  });
});
