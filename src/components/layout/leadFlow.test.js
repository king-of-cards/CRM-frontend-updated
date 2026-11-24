import { describe, expect, test } from "bun:test";
import { RETIRED_PATHS, dhruvaDashboardPath, dhruvaDirectionOf, dhruvaDirectionTarget, DHRUVA_DIRECTIONS, flowOf, FLOW_PAGES, tabsFor } from "./leadFlow.js";

describe("Lead flow from the page", () => {
  test("Vendors → KOC pages", () => {
    expect(flowOf("/dashboard", "?flow=vendors&period=all")).toBe("vendors");
    expect(flowOf("/vendor-to-koc", "?vendor_id=2")).toBe("vendors");
  });
  test("KOC → Vendors pages", () => {
    expect(flowOf("/dashboard", "")).toBe("");
    expect(flowOf("/dashboard", "?period=all")).toBe("");
    for (const p of ["/leads/spin", "/leads/international", "/leads/wedding", "/leads/wedding-planner"])
      expect(flowOf(p, "")).toBe("");
  });
  test("Dhruva pages", () => {
    expect(flowOf("/dashboard", "?flow=dhruva&period=all")).toBe("dhruva");
    expect(flowOf("/dhruva-leads", "")).toBe("dhruva");
    expect(flowOf("/dhruva-leads", "?search=foo")).toBe("dhruva");
    expect(flowOf("/koc-to-dhruva", "")).toBe("dhruva");
    expect(flowOf("/dashboard", "?flow=dhruva&direction=koc_to_dhruva")).toBe("dhruva");
  });
});

describe("Dhruva direction", () => {
  test("the switch: Dhruva → KOC | KOC → Dhruva", () => {
    expect(DHRUVA_DIRECTIONS.map((d) => d.label)).toEqual(["Dhruva → KOC", "KOC → Dhruva"]);
  });
  test("from the list, or the Dashboard's ?direction (default Dhruva → KOC)", () => {
    expect(dhruvaDirectionOf("/koc-to-dhruva", "")).toBe("koc_to_dhruva");
    expect(dhruvaDirectionOf("/dhruva-leads", "?direction=koc_to_dhruva")).toBe("dhruva");
    expect(dhruvaDirectionOf("/dashboard", "?flow=dhruva&direction=koc_to_dhruva")).toBe("koc_to_dhruva");
    expect(dhruvaDirectionOf("/dashboard", "?flow=dhruva")).toBe("dhruva");
    expect(dhruvaDirectionOf("/dashboard", "?flow=dhruva&direction=other")).toBe("dhruva");
  });
  test("the switch keeps the Dashboard (URL) or opens the other list", () => {
    expect(dhruvaDirectionTarget("/dashboard", "koc_to_dhruva")).toBe("/dashboard?flow=dhruva&direction=koc_to_dhruva");
    expect(dhruvaDirectionTarget("/dashboard", "dhruva")).toBe("/dashboard?flow=dhruva");
    expect(dhruvaDirectionTarget("/dhruva-leads", "koc_to_dhruva")).toBe("/koc-to-dhruva");
    expect(dhruvaDirectionTarget("/koc-to-dhruva", "dhruva")).toBe("/dhruva-leads");
    expect(dhruvaDashboardPath()).toBe("/dashboard?flow=dhruva");
  });
});

describe("tabs per flow", () => {
  test("KOC → Vendors: Dashboard + the four sources, no Wedding gifts, Vendors → KOC or Dhruva", () => {
    expect(tabsFor("").map((t) => t.label)).toEqual(["Dashboard", "Spin leads", "International", "Wedding", "Wedding planner"]);
    expect(tabsFor("")[0].to).toBe("/dashboard");
  });
  test("the old Wedding gifts page redirects to Spin leads", () => {
    expect(RETIRED_PATHS["/leads/wedding-gifts"]).toBe("/leads/spin");
    expect(FLOW_PAGES).not.toContain("/leads/wedding-gifts");
  });
  test("Vendors → KOC: Dashboard (keeping the flow) + Vendors → KOC", () => {
    expect(tabsFor("vendors").map((t) => [t.label, t.to])).toEqual([
      ["Dashboard", "/dashboard?flow=vendors"],
      ["Vendors → KOC", "/vendor-to-koc"],
    ]);
  });
  test("Dhruva: Dashboard (keeping the flow and direction), Dhruva → KOC, KOC → Dhruva", () => {
    expect(tabsFor("dhruva").map((t) => [t.label, t.to])).toEqual([
      ["Dashboard", "/dashboard?flow=dhruva"],
      ["Dhruva → KOC", "/dhruva-leads"],
      ["KOC → Dhruva", "/koc-to-dhruva"],
    ]);
    expect(tabsFor("dhruva", "koc_to_dhruva")[0].to).toBe("/dashboard?flow=dhruva&direction=koc_to_dhruva");
    expect(tabsFor("vendors", "koc_to_dhruva")[0].to).toBe("/dashboard?flow=vendors");
  });
  test("the switch shows on the Dashboard and every lead list (including dhruva)", () => {
    expect(FLOW_PAGES.sort()).toEqual(
      ["/dashboard", "/dhruva-leads", "/koc-to-dhruva", "/leads/international", "/leads/spin", "/leads/wedding", "/leads/wedding-planner", "/vendor-to-koc"].sort(),
    );
  });
});
