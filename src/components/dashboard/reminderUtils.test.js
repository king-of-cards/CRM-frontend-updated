import { describe, expect, test } from "bun:test";
import { FLOW_REMINDERS, reminderDashboardDestination, reminderDate, reminderLeadDestination, reminderListDestination, reminderPhone, reminderRequestFor, reminderScopeFor, reminderSourceLabel, reminderTag } from "./reminderUtils.js";

describe("follow-ups per Lead flow", () => {
  test("KOC → Vendors asks for its four sources only (gift leads are in Spin)", () => {
    expect(reminderRequestFor("")).toMatchObject({ dhruva: false, sources: ["spin", "whatsapp", "wedding", "wedding_planner"] });
  });
  test("wedding_gifts is no longer a reminder source", () => {
    expect(reminderSourceLabel("wedding_gifts")).toBe("Lead");
    expect(reminderListDestination("wedding_gifts")).toBe("/dashboard");
    expect(reminderLeadDestination({ source: "wedding_gifts", lead_key: "41" })).toBe("/dashboard");
  });
  test("Vendors → KOC asks for vendor_to_koc only", () => {
    expect(reminderRequestFor("vendors")).toMatchObject({ dhruva: false, sources: ["vendor_to_koc"] });
  });
  test("Dhruva → KOC: the Dhruva endpoint with sources=dhruva only", () => {
    expect(reminderRequestFor("dhruva")).toMatchObject({ dhruva: true, sources: ["dhruva"] });
  });
  test("KOC → Dhruva: the Dhruva endpoint with sources=koc_to_dhruva only", () => {
    expect(reminderRequestFor("koc_to_dhruva")).toMatchObject({ dhruva: true, sources: ["koc_to_dhruva"], label: "KOC → Dhruva leads" });
  });
  test("the Dhruva flow's scope follows the direction; other flows ignore it", () => {
    expect(reminderScopeFor("dhruva", "dhruva")).toBe("dhruva");
    expect(reminderScopeFor("dhruva", "koc_to_dhruva")).toBe("koc_to_dhruva");
    expect(reminderScopeFor("dhruva")).toBe("dhruva");
    expect(reminderScopeFor("", "koc_to_dhruva")).toBe("");
    expect(reminderScopeFor("vendors", "koc_to_dhruva")).toBe("vendors");
  });
  test("KOC → Dhruva reminders: label, list, lead and dashboard links", () => {
    expect(reminderSourceLabel("koc_to_dhruva")).toBe("KOC → Dhruva");
    expect(reminderSourceLabel("dhruva")).toBe("Dhruva → KOC");
    expect(reminderListDestination("koc_to_dhruva")).toBe("/koc-to-dhruva?follow_up=due");
    const url = new URL(reminderLeadDestination({ source: "koc_to_dhruva", lead_key: "crm-7", name: "Meera" }), "https://crm.local");
    expect(url.pathname).toBe("/koc-to-dhruva");
    expect(url.searchParams.get("notification_lead_key")).toBe("crm-7");
    expect(url.searchParams.get("search")).toBe("Meera");
    expect(reminderDashboardDestination("koc_to_dhruva")).toBe("/dashboard?flow=dhruva&direction=koc_to_dhruva#follow-ups");
    expect(reminderDashboardDestination("dhruva")).toBe("/dashboard?flow=dhruva#follow-ups");
  });
  test("an unknown flow falls back to KOC → Vendors", () => {
    expect(reminderRequestFor()).toBe(FLOW_REMINDERS[""]);
    expect(reminderRequestFor("other")).toBe(FLOW_REMINDERS[""]);
  });
  test("no flow mixes in another flow's sources", () => {
    const koc = reminderRequestFor("").sources;
    expect(koc).not.toContain("vendor_to_koc");
    expect(koc).not.toContain("dhruva");
    expect(koc).not.toContain("koc_to_dhruva");
    expect(reminderRequestFor("vendors").sources).not.toContain("dhruva");
    expect(reminderRequestFor("dhruva").sources).not.toContain("koc_to_dhruva");
    expect(reminderRequestFor("koc_to_dhruva").sources).not.toContain("dhruva");
  });
  test("each flow names its own leads", () => {
    expect(reminderRequestFor("").label).toBe("KOC → Vendors leads");
    expect(reminderRequestFor("vendors").label).toBe("Vendors → KOC leads");
    expect(reminderRequestFor("dhruva").label).toBe("Dhruva → KOC leads");
  });
});

describe("follow-up reminder helpers", () => {
  test("tags and formats use the reminder day offset", () => {
    expect(reminderTag(3)).toEqual({ label: "3 days overdue", tone: "red" });
    expect(reminderTag(0)).toEqual({ label: "Today", tone: "amber" });
    expect(reminderTag(-2)).toEqual({ label: "In 2 days", tone: "neutral" });
    expect(reminderDate("2026-11-19")).toBe("19 Nov 2026");
    expect(reminderPhone("+919876543210")).toBe("9876543210"); // Indian numbers: 10 digits
  });

  test("list destinations use only documented follow-up filters", () => {
    expect(reminderListDestination("wedding")).toBe("/leads/wedding?follow_up=due");
    expect(reminderListDestination("vendor_to_koc")).toBe("/vendor-to-koc?follow_up_due=true");
    expect(reminderListDestination("dhruva")).toBe("/dhruva-leads?follow_up_due=true");
  });

  test("reminder rows open their matching list and lead details", () => {
    const url = new URL(reminderLeadDestination({ source: "wedding", lead_key: "wk-9", name: "Ravi Rao" }), "https://crm.local");
    expect(url.pathname).toBe("/leads/wedding");
    expect(url.searchParams.get("search")).toBe("Ravi Rao");
    expect(url.searchParams.get("notification_lead_key")).toBe("wk-9");
    expect(reminderSourceLabel("vendor_to_koc")).toBe("Vendors → KOC");
    expect(reminderDashboardDestination("vendors")).toBe("/dashboard?flow=vendors#follow-ups");
  });
});
