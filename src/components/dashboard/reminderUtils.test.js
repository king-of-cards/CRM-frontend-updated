import { describe, expect, test } from "bun:test";
import { FLOW_REMINDERS, reminderDashboardDestination, reminderDate, reminderLeadDestination, reminderListDestination, reminderPhone, reminderRequestFor, reminderSourceLabel, reminderTag } from "./reminderUtils.js";

describe("follow-ups per Lead flow", () => {
  test("KOC → Vendors asks for its five sources only, Wedding gifts included", () => {
    expect(reminderRequestFor("")).toMatchObject({ dhruva: false, sources: ["spin", "wedding_gifts", "whatsapp", "wedding", "wedding_planner"] });
  });
  test("Wedding gifts reminders: label, list and lead links", () => {
    expect(reminderSourceLabel("wedding_gifts")).toBe("Wedding gifts");
    expect(reminderListDestination("wedding_gifts")).toBe("/leads/wedding-gifts?follow_up=due");
    const url = new URL(reminderLeadDestination({ source: "wedding_gifts", lead_key: "41", name: "Asha" }), "https://crm.local");
    expect(url.pathname).toBe("/leads/wedding-gifts");
    expect(url.searchParams.get("notification_lead_key")).toBe("41");
  });
  test("Vendors → KOC asks for vendor_to_koc only", () => {
    expect(reminderRequestFor("vendors")).toMatchObject({ dhruva: false, sources: ["vendor_to_koc"] });
  });
  test("Dhruva uses the Dhruva endpoint", () => {
    expect(reminderRequestFor("dhruva")).toMatchObject({ dhruva: true, sources: [] });
  });
  test("an unknown flow falls back to KOC → Vendors", () => {
    expect(reminderRequestFor()).toBe(FLOW_REMINDERS[""]);
    expect(reminderRequestFor("other")).toBe(FLOW_REMINDERS[""]);
  });
  test("no flow mixes in another flow's sources", () => {
    const koc = reminderRequestFor("").sources;
    expect(koc).not.toContain("vendor_to_koc");
    expect(koc).not.toContain("dhruva");
    expect(reminderRequestFor("vendors").sources).not.toContain("dhruva");
  });
  test("each flow names its own leads", () => {
    expect(reminderRequestFor("").label).toBe("KOC → Vendors leads");
    expect(reminderRequestFor("vendors").label).toBe("Vendors → KOC leads");
    expect(reminderRequestFor("dhruva").label).toBe("Dhruva leads");
  });
});

describe("follow-up reminder helpers", () => {
  test("tags and formats use the reminder day offset", () => {
    expect(reminderTag(3)).toEqual({ label: "3 days overdue", tone: "red" });
    expect(reminderTag(0)).toEqual({ label: "Today", tone: "amber" });
    expect(reminderTag(-2)).toEqual({ label: "In 2 days", tone: "neutral" });
    expect(reminderDate("2026-11-19")).toBe("19 Nov 2026");
    expect(reminderPhone("9876543210")).toBe("+919876543210");
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
