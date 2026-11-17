import { describe, expect, test } from "bun:test";
import { backTarget, isLeadRoute, leadDashboardFallback } from "./leadBack.js";

describe("lead back button", () => {
  test("uses browser history when there is a previous entry", () => {
    expect(backTarget(1, "/dashboard")).toBe(-1);
    expect(backTarget(8, "/dashboard")).toBe(-1);
  });
  test("direct links fall back to the matching section dashboard", () => {
    expect(backTarget(0, leadDashboardFallback("/dhruva-leads"))).toBe("/dashboard?flow=dhruva");
    expect(backTarget(null, leadDashboardFallback("/vendor-to-koc"))).toBe("/dashboard?flow=vendors");
    expect(backTarget(undefined, leadDashboardFallback("/leads/spin"))).toBe("/dashboard");
  });
  test("detects the requested lead pages", () => {
    expect(["/leads/spin", "/leads/international", "/vendor-to-koc", "/dhruva-leads"].every(isLeadRoute)).toBe(true);
    expect(isLeadRoute("/dashboard")).toBe(false);
    expect(isLeadRoute("/leads")).toBe(false);
  });
});
