import { describe, expect, test } from "bun:test";
import {
  budgetBandRows,
  budgetText,
  crmChanges,
  crmFormOf,
  dashboardKpiCards,
  kocToDhruvaListLink,
  occasionRows,
  quantityText,
  reasonLabel,
  reasonRows,
  spinField,
} from "./kocToDhruvaUtils.js";
import { topCitiesSubtitleFor } from "./topCities.js";

describe("KOC → Dhruva labels", () => {
  test("Reason badge: the API's label, else ours", () => {
    expect(reasonLabel("budget")).toBe("Budget ≥ ₹70");
    expect(reasonLabel("quantity")).toBe("Quantity ≥ 1000");
    expect(reasonLabel("budget", "Budget ≥ ₹70 (API)")).toBe("Budget ≥ ₹70 (API)");
    expect(reasonLabel(null)).toBe("");
  });
  test("estimated budget per card and quantity", () => {
    expect(budgetText("70-100")).toBe("₹70–100");
    expect(budgetText("70_100")).toBe("₹70–100");
    expect(budgetText("500_PLUS")).toBe("₹500+");
    expect(budgetText("500+")).toBe("₹500+");
    expect(budgetText("UNDER_50")).toBe("Under ₹50");
    expect(budgetText("400")).toBe("₹400");
    expect(budgetText("")).toBe("—");
    expect(quantityText(1500)).toBe("1,500");
    expect(quantityText(null)).toBe("—");
  });
  test("Spin's raw fields are found whatever their case or prefix", () => {
    const lead = { fullName: "Asha", "additional_details.phoneNumber": "9800000000", branch_id: 4 };
    expect(spinField(lead, "name")).toBe("Asha");
    expect(spinField(lead, "phone")).toBe("9800000000");
    expect(spinField(lead, "branch")).toBe(4);
    expect(spinField(lead, "email")).toBeNull();
  });
  test("Top cities names the section", () => {
    expect(topCitiesSubtitleFor([], "koc_to_dhruva")).toBe("KOC → Dhruva");
  });
});

describe("KOC → Dhruva links", () => {
  test("list link with filters and the period (All time adds no dates)", () => {
    expect(kocToDhruvaListLink({}, { all: true })).toBe("/koc-to-dhruva");
    expect(kocToDhruvaListLink({ update_status: ["converted"] }, { from: "2026-11-01", to: "2026-11-21" })).toBe(
      "/koc-to-dhruva?update_status=converted&date_from=2026-11-01&date_to=2026-11-21",
    );
  });
  test("the KPI cards: the other dashboards' set, each opening the filtered list", () => {
    const kpis = {
      total: 120, interested: 14, not_interested: 9, quotes_count: 11, quoted_count: 11, quoted_total: 1650000,
      converted: 6, converted_pct: 5, conversion_count: 5, conversion_total: 720000,
      conversion_amount_count: 4, conversion_amount_total: 600000, hot_count: 3, pending: 70,
    };
    const cards = dashboardKpiCards(kpis, { all: true });
    expect(cards.map((c) => c.label)).toEqual([
      "Total leads", "Interested", "Not interested", "Quotes sent", "Quoted amount",
      "Converted", "Conversion amount", "AOV", "Hot leads", "Pending",
    ]);
    const by = Object.fromEntries(cards.map((c) => [c.key, c]));
    expect(by.converted.value).toBe("6 · 5%");
    expect(by.aov.value).toBe("₹1.5 L");
    expect(by.total.to).toBe("/koc-to-dhruva");
    expect(by.interested.to).toBe("/koc-to-dhruva?update_status=interested");
    expect(by.quotes_sent.to).toBe("/koc-to-dhruva?quote=has");
    expect(by.conversion_amount.to).toBe("/koc-to-dhruva?conversion=has");
    expect(by.aov.to).toBe("/koc-to-dhruva?update_status=converted&conversion=has");
    expect(by.hot.to).toBe("/koc-to-dhruva?hot=yes");
    expect(by.pending.to).toBe("/koc-to-dhruva?update_status=pending");
  });
  test("chart rows: reason and occasion open the list; budget bands in order", () => {
    expect(reasonRows([{ reason: "budget", label: "Budget ≥ ₹70", count: 8 }])).toEqual([
      { key: "budget", label: "Budget ≥ ₹70", count: 8, filters: { reason: "budget" } },
    ]);
    expect(occasionRows([{ value: "Wedding", count: 5 }])[0].filters).toEqual({ occasion: "Wedding" });
    expect(budgetBandRows({ not_given: 1, "500+": 2, "70-100": 4, under_70: 3 }).map((b) => b.label)).toEqual([
      "₹70–100", "₹500+", "Under ₹70 (quantity only)", "Not given",
    ]);
  });
});

describe("KOC → Dhruva CRM edits", () => {
  test("only changed fields are sent; empty values clear", () => {
    const crm = { update_status: null, notes: "Call back", quoted_amount: 50000, quoted_date: "2026-11-10", conversion_amount: null, follow_up_date: null };
    const form = { ...crmFormOf(crm), update_status: "interested", notes: "", follow_up_date: "2026-12-01" };
    expect(crmChanges(form, crm)).toEqual({ update_status: "interested", notes: null, follow_up_date: "2026-12-01" });
    expect(crmChanges(crmFormOf(crm), crm)).toEqual({});
  });
});
