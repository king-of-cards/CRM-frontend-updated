import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { setAccessToken } from "./client.js";
import { getKocToDhruvaDashboard, listKocToDhruvaLeads, saveKocToDhruvaCrm } from "./kocToDhruva.js";
import { setKocToDhruvaLeadHot } from "./hotLeads.js";
import { getLeadActivity } from "./leadActivity.js";
import { getFollowUpReminders } from "./reminders.js";

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
let calls;
let replies;
const realFetch = globalThis.fetch;

beforeEach(() => {
  calls = []; replies = []; setAccessToken("koc-dhruva-test-token");
  globalThis.fetch = async (url, init = {}) => { calls.push({ url: String(url), ...init }); return replies.shift() ?? json(200, {}); };
});
afterEach(() => { globalThis.fetch = realFetch; });

describe("KOC → Dhruva API (docs section 18)", () => {
  test("list sends paging and its own filters", async () => {
    await listKocToDhruvaLeads({ page: 1, page_size: 25, reason: "quantity", quantity_min: "1000", update_status: ["pending", "interested"] });
    expect(calls[0].url).toBe("/api/v1/koc-to-dhruva/leads?page=1&page_size=25&reason=quantity&quantity_min=1000&update_status=pending&update_status=interested");
  });
  test("CRM details: PUT …/leads/{lead_key}/crm with only the changes", async () => {
    await saveKocToDhruvaCrm("crm-12", { update_status: "interested", follow_up_date: "2026-12-01" });
    expect(calls[0].url).toBe("/api/v1/koc-to-dhruva/leads/crm-12/crm");
    expect(calls[0].method).toBe("PUT");
    expect(JSON.parse(calls[0].body)).toEqual({ update_status: "interested", follow_up_date: "2026-12-01" });
  });
  test("hot star and activity use this section's paths", async () => {
    await setKocToDhruvaLeadHot("41", true);
    await setKocToDhruvaLeadHot("41", false);
    await getLeadActivity({ source: "koc_to_dhruva", leadKey: "41" });
    expect(calls.map((c) => [c.method ?? "GET", c.url])).toEqual([
      ["POST", "/api/v1/koc-to-dhruva/leads/41/hot"],
      ["DELETE", "/api/v1/koc-to-dhruva/leads/41/hot"],
      ["GET", "/api/v1/koc-to-dhruva/leads/41/activity?page=1&page_size=25"],
    ]);
  });
  test("dashboard: All time by default, or the period", async () => {
    await getKocToDhruvaDashboard({ period: "all" });
    await getKocToDhruvaDashboard({ dateFrom: "2026-11-01", dateTo: "2026-11-21" });
    expect(calls[0].url).toBe("/api/v1/analytics/koc-to-dhruva?period=all");
    expect(calls[1].url).toBe("/api/v1/analytics/koc-to-dhruva?date_from=2026-11-01&date_to=2026-11-21");
  });
});

describe("follow-up reminders per direction", () => {
  test("the Dhruva endpoint narrowed to one direction", async () => {
    await getFollowUpReminders({ dhruva: true, sources: ["koc_to_dhruva"] });
    await getFollowUpReminders({ dhruva: true, sources: ["dhruva"] });
    expect(calls[0].url).toBe("/api/v1/dhruva/reminders/follow-ups?days=7&sources=koc_to_dhruva");
    expect(calls[1].url).toBe("/api/v1/dhruva/reminders/follow-ups?days=7&sources=dhruva");
  });
  test("KOC → Vendors keeps the general endpoint", async () => {
    await getFollowUpReminders({ sources: ["spin", "wedding"] });
    expect(calls[0].url).toBe("/api/v1/reminders/follow-ups?days=7&sources=spin%2Cwedding");
  });
});
