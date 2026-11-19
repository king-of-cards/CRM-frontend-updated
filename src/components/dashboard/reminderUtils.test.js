import { describe, expect, test } from "bun:test";
import { reminderDashboardDestination, reminderDate, reminderLeadDestination, reminderListDestination, reminderPhone, reminderSourceLabel, reminderTag } from "./reminderUtils.js";

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
