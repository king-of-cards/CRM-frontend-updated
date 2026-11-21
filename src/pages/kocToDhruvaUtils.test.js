import { describe, expect, test } from "bun:test";
import {
  branchRows,
  budgetBandRows,
  budgetQuantityText,
  budgetText,
  crmChanges,
  crmFormOf,
  dashboardKpiCards,
  daysSince,
  entryStatus,
  funnelRows,
  kocToDhruvaListLink,
  leadLink,
  monthlyPoints,
  potentialText,
  quantityText,
  spinField,
} from "./kocToDhruvaUtils.js";
import { TOP_CITIES_DEFAULTS } from "./topCities.js";
import { branchOf, branchText } from "../components/leads/stores.js";

describe("KOC → Dhruva labels", () => {
  test("estimated budget per card, quantity and potential value", () => {
    expect(budgetText("70-100")).toBe("₹70–100");
    expect(budgetText("70_100")).toBe("₹70–100");
    expect(budgetText("500_PLUS")).toBe("₹500+");
    expect(budgetText("500+")).toBe("₹500+");
    expect(budgetText("UNDER_50")).toBe("Under ₹50");
    expect(budgetText("400")).toBe("₹400");
    expect(budgetText("")).toBe("—");
    expect(quantityText(1500)).toBe("1,500");
    expect(quantityText(null)).toBe("—");
    expect(potentialText(84000)).toBe("₹84,000");
    expect(potentialText(0)).toBe("₹0"); // UNDER_… budgets count as 0
    expect(potentialText(null)).toBe("—");
    expect(budgetQuantityText({ budget: "70-100", quantity: 1200 })).toBe("₹70–100 × 1,200");
  });
  test("a list entry's status: the API's label, else ours (null = Pending)", () => {
    expect(entryStatus({ update_status: "interested", status_label: "Interested" })).toBe("Interested");
    expect(entryStatus({ update_status: null })).toBe("Pending");
  });
  test("Spin's raw fields are found whatever their case or prefix", () => {
    const lead = { fullName: "Asha", "additional_details.phoneNumber": "9800000000", branch_id: 4 };
    expect(spinField(lead, "name")).toBe("Asha");
    expect(spinField(lead, "phone")).toBe("9800000000");
    expect(spinField(lead, "branch")).toBe(4);
    expect(spinField(lead, "email")).toBeNull();
  });
  test("the dashboard no longer has Top cities", () => {
    expect(TOP_CITIES_DEFAULTS.koc_to_dhruva).toBeUndefined();
  });
});

describe("KOC → Dhruva KPI cards", () => {
  const kpis = {
    shared: 120, total: 120, pending: 70, interested: 14, quotes_count: 11, quoted_count: 11, quoted_total: 1650000,
    converted: 6, converted_pct: 5, conversion_count: 5, conversion_total: 720000,
    conversion_amount_count: 4, conversion_amount_total: 600000, potential_value: 2520000, follow_ups_due: 3,
  };
  const period = { from: "2026-11-01", to: "2026-11-21" };
  const cards = dashboardKpiCards(kpis, period);
  const by = Object.fromEntries(cards.map((c) => [c.key, c]));
  const dates = "date_from=2026-11-01&date_to=2026-11-21";

  test("the ten cards, in order", () => {
    expect(cards.map((c) => c.label)).toEqual([
      "Leads shared", "Not contacted yet", "Interested", "Quotes sent", "Quoted amount",
      "Converted", "Conversion amount", "AOV", "Potential value", "Follow-ups due",
    ]);
    expect(by.shared.value).toBe("120");
    expect(by.converted.value).toBe("6 · 5%");
    expect(by.aov.value).toBe("₹1.5 L");
    expect(by.potential_value.value).toBe("₹25.2 L");
    expect(by.follow_ups_due.value).toBe("3");
  });
  test("each opens the list with its exact filter and the period", () => {
    expect(by.shared.to).toBe(`/koc-to-dhruva?${dates}`);
    expect(by.pending.to).toBe(`/koc-to-dhruva?update_status=pending&${dates}`);
    expect(by.interested.to).toBe(`/koc-to-dhruva?update_status=interested&${dates}`);
    expect(by.quotes_sent.to).toBe(`/koc-to-dhruva?quote=has&${dates}`);
    expect(by.quoted_amount.to).toBe(`/koc-to-dhruva?quote=has&${dates}`);
    expect(by.converted.to).toBe(`/koc-to-dhruva?update_status=converted&${dates}`);
    expect(by.conversion_amount.to).toBe(`/koc-to-dhruva?conversion=has&${dates}`);
    expect(by.aov.to).toBe(`/koc-to-dhruva?update_status=converted&conversion=has&${dates}`);
  });
  test("Potential value: the period's open leads, highest first; Follow-ups due: every due lead, no period", () => {
    expect(by.potential_value.to).toBe(
      `/koc-to-dhruva?update_status=pending&update_status=interested&update_status=will_call_back&sort=potential_value%3Adesc&${dates}`,
    );
    expect(by.follow_ups_due.to).toBe("/koc-to-dhruva?follow_up=due");
  });
  test("Leads shared falls back to total; empty values show —", () => {
    expect(dashboardKpiCards({ total: 7 }, { all: true })[0].value).toBe("7");
    expect(dashboardKpiCards(null, { all: true }).every((c) => c.value === "—")).toBe(true);
  });
});

describe("KOC → Dhruva dashboard panels", () => {
  test("funnel: % of shared; only Shared and Converted link", () => {
    const rows = funnelRows([{ stage: "shared", count: 120 }, { stage: "contacted", count: 60 }, { stage: "interested", count: 30 }, { stage: "quoted", count: 12 }, { stage: "converted", count: 6 }], { all: true });
    expect(rows.map((r) => [r.label, r.count, r.pct])).toEqual([["Shared", 120, 100], ["Contacted", 60, 50], ["Interested", 30, 25], ["Quoted", 12, 10], ["Converted", 6, 5]]);
    expect(rows.map((r) => r.to)).toEqual(["/koc-to-dhruva", null, null, null, "/koc-to-dhruva?update_status=converted"]);
    expect(funnelRows(undefined)).toEqual([]);
  });
  test("monthly points with month names", () => {
    expect(monthlyPoints([{ month: "2026-11", shared: 5, converted: 1 }])).toEqual([{ month: "2026-11", label: "Nov 2026", shared: 5, converted: 1 }]);
  });
  test("by branch: leads open the list for that branch; the No branch row doesn't", () => {
    const rows = branchRows([
      { branch_id: 1, name: "Chamrajpet", code: "CHA-001 · Bangalore", leads: 9, converted: 2, conversion_amount: 90000 },
      { branch_id: null, name: null, code: null, leads: 3, converted: 0, conversion_amount: null },
    ], { all: true });
    expect(rows[0]).toMatchObject({ name: "Chamrajpet", code: "CHA-001 · Bangalore", leads: 9, to: "/koc-to-dhruva?branch=1" });
    expect(rows[1]).toMatchObject({ name: "No branch", to: null });
  });
  test("budget bands: the API's new shape, in band order", () => {
    const rows = budgetBandRows([
      { band: "not_given", leads: 1, converted: 0, converted_pct: 0 },
      { band: "70-100", leads: 4, converted: 1, converted_pct: 25 },
      { band: "under_70", leads: 3, converted: 0, converted_pct: null },
    ]);
    expect(rows.map((b) => [b.label, b.leads, b.converted, b.pct])).toEqual([
      ["₹70–100", 4, 1, 25], ["Under ₹70 (quantity only)", 3, 0, null], ["Not given", 1, 0, 0],
    ]);
  });
  test("lead links and days untouched", () => {
    expect(leadLink({ lead_key: "crm-7", name: "Meera" })).toBe("/koc-to-dhruva?search=Meera&notification_lead_key=crm-7");
    const now = new Date("2026-11-21T12:00:00Z").getTime();
    expect(daysSince("2026-11-11T12:00:00Z", now)).toBe(10);
    expect(daysSince(null, now)).toBeNull();
    expect(kocToDhruvaListLink({}, { all: true })).toBe("/koc-to-dhruva");
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

describe("KOC → Dhruva branch (as spin items)", () => {
  test("item.branch from the API, else item.branch_id, else none", () => {
    const branch = { id: 11, name: "Chitradurga", code: "CTRD-011", city: "Chitradurga" };
    expect(branchOf({ branch, branch_id: 11 })).toEqual(branch);
    expect(branchOf({ branch: null, branch_id: 11 })).toMatchObject({ name: "Chitradurga", code: "CTRD-011" });
    expect(branchOf({ branch_id: 4 }, [{ id: 4, name: "Jayanagar (renamed)", code: "JNG-004" }])).toMatchObject({ name: "Jayanagar (renamed)" });
    expect(branchOf({ branch: null, branch_id: null })).toBeNull();
  });
  test("one line for the panel and PDF: name · code, or —", () => {
    expect(branchText({ name: "Chitradurga", code: "CTRD-011", city: "Chitradurga" })).toBe("Chitradurga · CTRD-011");
    expect(branchText({ name: "HSR Layout", code: null })).toBe("HSR Layout");
    expect(branchText(null)).toBe("—");
  });
});
