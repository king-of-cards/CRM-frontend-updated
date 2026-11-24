import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { apiRequest, clearCache, setAccessToken } from "./client.js";

// Brief reuse: no refetch when coming back to a page within a few seconds, one request for
// identical GETs in flight, and any change (POST / PATCH / DELETE) makes the next GET ask again.

const realFetch = globalThis.fetch;
const hadWindow = "window" in globalThis;
let calls = [];
const answer = (body) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

beforeEach(() => {
  globalThis.window ??= globalThis;
  setAccessToken("token");
  clearCache();
  calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method ?? "GET" });
    return answer({ n: calls.length });
  };
});
afterAll(() => {
  globalThis.fetch = realFetch;
  if (!hadWindow) delete globalThis.window;
  setAccessToken(null);
});

describe("GET reuse", () => {
  test("identical GETs in flight share one request", async () => {
    const [a, b] = await Promise.all([apiRequest("/things"), apiRequest("/things")]);
    expect(calls).toHaveLength(1);
    expect(a).toEqual(b);
  });
  test("the same GET again within a few seconds reuses the answer", async () => {
    await apiRequest("/things", { query: { page: 1 } });
    const again = await apiRequest("/things", { query: { page: 1 } });
    expect(calls).toHaveLength(1);
    expect(again).toEqual({ n: 1 });
    await apiRequest("/things", { query: { page: 2 } }); // another page: its own request
    expect(calls).toHaveLength(2);
  });
  test("a change makes the next GET ask the server", async () => {
    await apiRequest("/things");
    await apiRequest("/things/1", { method: "PATCH", body: { a: 1 } });
    await apiRequest("/things");
    expect(calls.map((c) => c.method)).toEqual(["GET", "PATCH", "GET"]);
  });
  test("refresh=true always asks the server", async () => {
    await apiRequest("/analytics/x", { query: { refresh: true } });
    await apiRequest("/analytics/x", { query: { refresh: true } });
    expect(calls).toHaveLength(2);
  });
});
