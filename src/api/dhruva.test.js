import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { setAccessToken } from "./client.js";
import { addDhruvaLead, listDhruvaLeads, updateDhruvaLead } from "./dhruva.js";

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
let calls;
let replies;
const realFetch = globalThis.fetch;

beforeEach(() => {
  calls = []; replies = []; setAccessToken("dhruva-test-token");
  globalThis.fetch = async (url, init = {}) => { calls.push({ url: String(url), ...init }); return replies.shift() ?? json(500, { detail: "no reply" }); };
});
afterEach(() => { globalThis.fetch = realFetch; });

describe("Dhruva API", () => {
  test("single create can explicitly allow a duplicate", async () => {
    replies.push(json(201, { id: 1 }));
    await addDhruvaLead({ name: "Asha", phone: "9800000000", allow_duplicate: true });
    expect(calls[0].url).toBe("/api/v1/dhruva/leads");
    expect(JSON.parse(calls[0].body)).toEqual({ name: "Asha", phone: "9800000000", allow_duplicate: true });
  });
  test("list repeats event types and sends paging", async () => {
    replies.push(json(200, { items: [] }));
    await listDhruvaLeads({ page: 2, page_size: 25, event_type: ["wedding", "engagement"] });
    expect(calls[0].url).toBe("/api/v1/dhruva/leads?page=2&page_size=25&event_type=wedding&event_type=engagement");
  });
  test("patch sends phones as the full list, [] to clear", async () => {
    replies.push(json(200, { id: 8 }), json(200, { id: 8 }));
    await updateDhruvaLead(8, { phones: ["9845012345", "9845012346"] });
    await updateDhruvaLead(8, { phones: [] });
    expect(JSON.parse(calls[0].body)).toEqual({ phones: ["9845012345", "9845012346"] });
    expect(JSON.parse(calls[1].body)).toEqual({ phones: [] });
  });
  test("patch sends event_dates as the full list", async () => {
    replies.push(json(200, { id: 8, activity: [] }));
    await updateDhruvaLead(8, { event_dates: ["2026-12-04", "2026-12-05"] });
    expect(JSON.parse(calls[0].body)).toEqual({ event_dates: ["2026-12-04", "2026-12-05"] });
  });
  test("list sends the needs_intervention filter and the new sorts", async () => {
    replies.push(json(200, { items: [] }));
    await listDhruvaLeads({ needs_intervention: "yes", sort: "whatsapp_status", order: "asc" });
    expect(calls[0].url).toBe("/api/v1/dhruva/leads?needs_intervention=yes&sort=whatsapp_status&order=asc");
  });
  test("patch uses the lead id and forwards allow_duplicate", async () => {
    replies.push(json(200, { id: 8 }));
    await updateDhruvaLead(8, { phone: "9800000000", allow_duplicate: true });
    expect(calls[0].url).toBe("/api/v1/dhruva/leads/8");
    expect(calls[0].method).toBe("PATCH");
    expect(JSON.parse(calls[0].body).allow_duplicate).toBe(true);
  });
});
