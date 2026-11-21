import { describe, expect, test } from "bun:test";
import {
  notificationDateTime,
  notificationDestination,
  notificationBellPlacement,
  notificationSourceLabel,
  relativeNotificationTime,
  unreadBadge,
} from "./notificationUtils.js";

describe("notification formatting", () => {
  test("unread badge is hidden at zero and caps above nine", () => {
    expect(unreadBadge(0)).toBeNull();
    expect(unreadBadge(1)).toBe("1");
    expect(unreadBadge(9)).toBe("9");
    expect(unreadBadge(10)).toBe("9+");
  });

  test("relative time and exact tooltip time use the expected short format and IST", () => {
    const now = Date.parse("2026-11-19T06:00:00.000Z");
    expect(relativeNotificationTime("2026-11-19T05:55:00.000Z", now)).toBe("5 min ago");
    expect(notificationDateTime("2026-11-19T05:00:00.000Z")).toBe("19 Nov 2026, 10:30 am");
  });

  test("source labels use the API source name", () => {
    expect(notificationSourceLabel("wedding_planner")).toBe("Wedding planner");
    expect(notificationSourceLabel("vendor_to_koc")).toBe("Vendors → KOC");
  });
});

describe("notification bell placement", () => {
  test("admins with a visible flow toggle use the toggle row and mobile avatar fallback", () => {
    expect(notificationBellPlacement({ isAdmin: true, isVendor: false, isDhruva: false, showToggle: true })).toEqual({
      besideToggle: true,
      besideAvatar: false,
      mobileBesideAvatar: true,
    });
  });

  test("vendors without a visible flow toggle keep the bell beside the avatar", () => {
    expect(notificationBellPlacement({ isAdmin: false, isVendor: true, isDhruva: false, showToggle: false })).toEqual({
      besideToggle: false,
      besideAvatar: true,
      mobileBesideAvatar: false,
    });
  });

  test("Dhruva never gets a notification bell", () => {
    expect(notificationBellPlacement({ isAdmin: false, isVendor: false, isDhruva: true, showToggle: false })).toEqual({
      besideToggle: false,
      besideAvatar: false,
      mobileBesideAvatar: false,
    });
  });
});

describe("notification destinations", () => {
  test("vendor assignment opens the matching source list and lead details", () => {
    const url = new URL(notificationDestination({
      type: "vendor_assigned",
      body: "Meera Rao (wedding) was assigned to Phodeo by Admin.",
      lead_ref: { source: "wedding", lead_key: "sheet-key-1" },
    }), "https://crm.local");
    expect(url.pathname).toBe("/leads/wedding");
    expect(url.searchParams.get("search")).toBe("Meera Rao");
    expect(url.searchParams.get("notification_lead_key")).toBe("sheet-key-1");
  });

  test("a single KOC notification opens its matching list row", () => {
    const url = new URL(notificationDestination({
      type: "vendor_lead_added",
      body: "Phodeo added Meera Rao to KOC; added by Vendor User.",
      lead_ref: { source: "vendor_to_koc", lead_id: 42, lead_key: "42" },
    }), "https://crm.local");
    expect(url.pathname).toBe("/vendor-to-koc");
    expect(url.searchParams.get("search")).toBe("Meera Rao");
    expect(url.searchParams.get("notification_lead_id")).toBe("42");
  });

  test("a bulk KOC summary opens the list without inventing a lead target", () => {
    expect(notificationDestination({
      type: "vendor_lead_added",
      body: "4 leads added by Phodeo; added by Vendor User.",
      lead_ref: { source: "vendor_to_koc", lead_key: null, lead_id: null },
    })).toBe("/vendor-to-koc");
  });
});

describe("gift leads are Spin leads (docs section 17)", () => {
  test("a gift lead's notification opens Spin; the old wedding_gifts source has no page", () => {
    const url = new URL(notificationDestination({ source: "spin", lead_ref: { source: "spin", lead_key: "41" } }), "https://crm.local");
    expect(url.pathname).toBe("/leads/spin");
    expect(url.searchParams.get("notification_lead_key")).toBe("41");
    expect(notificationSourceLabel("wedding_gifts")).toBe("Lead");
    expect(notificationDestination({ source: "wedding_gifts", lead_key: "41" })).toBe("/dashboard");
  });
});
