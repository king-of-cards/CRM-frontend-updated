import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { PENDING_UPDATE, saveLeadCrm, UPDATE_OPTIONS, updateInfo } from "./leadCrm.js";
import { setAccessToken } from "./client.js";
import { setSourceLeadHot } from "./hotLeads.js";
import { copyChanges, copyForm, copyOf, copySaveOptions } from "../components/leads/leadVendors.js";
import { STATUSES } from "../components/vendorToKoc/kocUtils.js";

describe("Update (replaces Interest / Converted)", () => {
  test("the same 7 values and labels as Vendors → KOC, in the same order", () => {
    expect(UPDATE_OPTIONS.map((o) => [o.value, o.label])).toEqual(STATUSES.map((s) => [s.value, s.label]));
  });
  test("null, empty and 'pending' are Pending", () => {
    for (const v of [null, undefined, "", "pending"]) expect(updateInfo(v)).toBe(PENDING_UPDATE);
    expect(PENDING_UPDATE.label).toBe("Pending");
  });
  test("labels", () => {
    expect(updateInfo("will_call_back").label).toBe("Will call back");
    expect(updateInfo("purchased_elsewhere").label).toBe("Already purchased somewhere else");
  });
});

// ── Several vendors (docs section 19): whose copy an admin's save changes ──
// A stand-in for PUT /leads/{source}/{key}/crm that follows the backend's rule (lead_crm.py
// _copy_vendor): a lead with several vendors needs ?vendor=<id> for Update, amounts, quoted date,
// follow-up and notes (422 without it); assignment changes need none.
describe("saving one vendor's copy on a lead with several vendors", () => {
  const VENDOR_IDS = [2, 4];
  const COPY = ["update_status", "quoted_amount", "quoted_date", "conversion_amount", "notes", "follow_up_date"];
  const crm = (vendors) => ({ lead_key: "404", vendors: vendors.map((v) => ({ vendor: { id: v.id, name: v.name }, vendor_source: "suggested", ...v.copy })) });
  let calls;
  const realFetch = globalThis.fetch;
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  beforeEach(() => {
    calls = [];
    setAccessToken("lead-vendors-test-token");
    globalThis.fetch = async (url, init = {}) => {
      const u = new URL(String(url), "http://x");
      const body = JSON.parse(init.body ?? "{}");
      calls.push({ url: String(url), method: init.method, body });
      const copyFields = Object.keys(body).filter((k) => COPY.includes(k));
      const vendor = u.searchParams.get("vendor");
      if (copyFields.length && vendor == null && VENDOR_IDS.length > 1)
        return json(422, { detail: "This lead has several vendors: choose whose copy with ?vendor=<vendor id> (0 = the lead's own row)." });
      if (vendor != null && vendor !== "0" && !VENDOR_IDS.includes(Number(vendor))) return json(422, { detail: "That vendor doesn't have this lead." });
      return json(200, crm([{ id: 2, name: "Phodeo", copy: {} }, { id: 4, name: "Kraftyz", copy: Number(vendor) === 4 ? body : {} }]));
    };
  });
  afterEach(() => { globalThis.fetch = realFetch; });

  test("before: the lead-wide save (no ?vendor=) was answered with 422", async () => {
    await expect(saveLeadCrm("spin", "404", { update_status: "interested" })).rejects.toMatchObject({ status: 422 });
  });
  test("now: an admin's card save sends ?vendor=<id> and only that card's fields, and succeeds", async () => {
    const copy = { vendor: { id: 4, name: "Kraftyz" }, update_status: null, follow_up_date: null, notes: null };
    const changes = copyChanges(copy, { ...copyForm(copy), update_status: "interested", follow_up_date: "2026-12-01", notes: " Call back " });
    expect(changes).toEqual({ update_status: "interested", follow_up_date: "2026-12-01", notes: "Call back" });
    const next = await saveLeadCrm("spin", "404", changes, {}, copySaveOptions(true, 4));
    expect(calls[0].method).toBe("PUT");
    expect(calls[0].url).toBe("/api/v1/leads/spin/404/crm?vendor=4");
    expect(calls[0].body).toEqual({ update_status: "interested", follow_up_date: "2026-12-01", notes: "Call back" });
    expect(copyOf(next, 4)).toMatchObject({ update_status: "interested", follow_up_date: "2026-12-01" });
    expect(copyOf(next, 2).update_status).toBeUndefined(); // the other vendor's copy is untouched
  });
  test("vendor logins never send ?vendor= (the API uses their own copy); assignment changes need none", async () => {
    expect(copySaveOptions(false, 4)).toEqual({});
    await saveLeadCrm("spin", "404", { vendor_ids: [2, 4] });
    expect(calls[0].url).toBe("/api/v1/leads/spin/404/crm");
  });
  test("vendor 0 (the lead's own row) is still sent", async () => {
    await saveLeadCrm("spin", "404", { notes: "x" }, {}, { vendor: 0 });
    expect(calls[0].url).toBe("/api/v1/leads/spin/404/crm?vendor=0");
  });
});

// The hot star on a lead with several vendors: the same rule (lead_crm.py _set_hot → _copy_vendor)
describe("hot star of one vendor's copy", () => {
  let calls;
  const realFetch = globalThis.fetch;
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  beforeEach(() => {
    calls = [];
    setAccessToken("lead-vendors-hot-token");
    globalThis.fetch = async (url, init = {}) => {
      const vendor = new URL(String(url), "http://x").searchParams.get("vendor");
      calls.push({ url: String(url), method: init.method });
      if (vendor == null) return json(422, { detail: "This lead has several vendors: choose whose copy with ?vendor=<vendor id> (0 = the lead's own row)." });
      return json(200, { is_hot: init.method === "POST" });
    };
  });
  afterEach(() => { globalThis.fetch = realFetch; });

  test("before: the lead-wide star (no ?vendor=) was answered with 422", async () => {
    await expect(setSourceLeadHot("spin", "404", true)).rejects.toMatchObject({ status: 422 });
  });
  test("now: the card's star marks and unmarks that vendor's copy with ?vendor=<id>", async () => {
    expect(await setSourceLeadHot("spin", "404", true, copySaveOptions(true, 4))).toEqual({ is_hot: true });
    expect(await setSourceLeadHot("spin", "404", false, copySaveOptions(true, 4))).toEqual({ is_hot: false });
    expect(calls).toEqual([
      { url: "/api/v1/leads/spin/404/hot?vendor=4", method: "POST" },
      { url: "/api/v1/leads/spin/404/hot?vendor=4", method: "DELETE" },
    ]);
  });
  test("vendor logins and single-vendor leads: no ?vendor= (as before)", async () => {
    globalThis.fetch = async (url, init = {}) => { calls.push({ url: String(url), method: init.method }); return json(200, { is_hot: true }); };
    await setSourceLeadHot("spin", "404", true, copySaveOptions(false, 4));
    await setSourceLeadHot("spin", "101", true);
    expect(calls.map((c) => c.url)).toEqual(["/api/v1/leads/spin/404/hot", "/api/v1/leads/spin/101/hot"]);
  });
});
