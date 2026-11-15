import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { setAccessToken } from "./client.js";
import {
  addCrmLead,
  archiveCrmLead,
  editCrmLead,
  exportCrmLeads,
  importCrmLeads,
  previewCrmLeadImport,
} from "./crmLeads.js";

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

let calls;
let replies;
const realFetch = globalThis.fetch;

beforeEach(() => {
  calls = [];
  replies = [];
  setAccessToken("token-1");
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), ...init });
    return replies.shift() ?? json(500, { detail: "no reply" });
  };
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("crm-leads API", () => {
  test("add: 409 keeps the duplicate details", async () => {
    replies.push(
      json(409, {
        detail: {
          message: "A lead with this phone number already exists.",
          duplicate: { reason: "existing_sheet", lead_key: "abc" },
          warnings: [],
        },
      }),
    );
    const err = await addCrmLead("wedding", { phone: "98450" }).catch((e) => e);
    expect(err.status).toBe(409);
    expect(err.detail.duplicate.reason).toBe("existing_sheet");
    expect(calls[0].url).toBe("/api/v1/crm-leads/wedding");
    expect(JSON.parse(calls[0].body)).toEqual({ values: { phone: "98450" }, allow_duplicate: false });
  });

  test("add anyway sends allow_duplicate: true", async () => {
    replies.push(json(201, { lead: { lead_key: "crm-1" }, warnings: [] }));
    await addCrmLead("spin", { phone: "98450" }, true);
    expect(JSON.parse(calls[0].body).allow_duplicate).toBe(true);
  });

  test("preview: multipart with sheet_name for Excel, none for CSV", async () => {
    replies.push(json(200, { rows: [], counts: {} }), json(200, { rows: [], counts: {} }));
    await previewCrmLeadImport("spin", new File(["x"], "a.xlsx"), "March");
    await previewCrmLeadImport("spin", new File(["x"], "a.csv"));
    expect(calls[0].method).toBe("POST");
    expect(calls[0].url).toBe("/api/v1/crm-leads/spin/import/preview");
    expect(calls[0].body.get("sheet_name")).toBe("March");
    expect(calls[0].body.get("file").name).toBe("a.xlsx");
    expect(calls[0].headers.Authorization).toBe("Bearer token-1");
    expect(calls[1].body.has("sheet_name")).toBe(false);
  });

  test("preview: the backend's 400 message is the error message", async () => {
    replies.push(json(400, { detail: 'There is no sheet named "April" in this file. Sheets in the file: "Leads".' }));
    const err = await previewCrmLeadImport("spin", new File(["x"], "a.xlsx"), "April").catch((e) => e);
    expect(err.status).toBe(400);
    expect(err.message).toBe('There is no sheet named "April" in this file. Sheets in the file: "Leads".');
  });

  test("401 refreshes once and retries the upload", async () => {
    replies.push(json(401, { detail: "expired" }), json(200, { access_token: "token-2" }), json(200, { rows: [] }));
    await previewCrmLeadImport("whatsapp", new File(["x"], "a.csv"));
    expect(calls.map((c) => c.url)).toEqual([
      "/api/v1/crm-leads/whatsapp/import/preview",
      "/api/v1/auth/refresh",
      "/api/v1/crm-leads/whatsapp/import/preview",
    ]);
    expect(calls[2].headers.Authorization).toBe("Bearer token-2");
  });

  test("export: the list's filters (repeated values too), file name from Content-Disposition", async () => {
    const clicked = [];
    globalThis.document = {
      createElement: () => ({ click() { clicked.push(this.download); }, remove() {} }),
      body: { appendChild() {} },
    };
    const origCreate = URL.createObjectURL;
    URL.createObjectURL = () => "blob:x";
    URL.revokeObjectURL = () => {};
    replies.push(
      new Response("data", {
        status: 200,
        headers: { "content-disposition": 'attachment; filename="wedding-leads-2026-11-14.csv"' },
      }),
    );
    const name = await exportCrmLeads("wedding", "csv", {
      search: "ravi",
      hide_repeats: "true",
      interest: ["interested", "not_set"],
      sort: "name",
      order: "asc",
      page: 2,
    });
    expect(name).toBe("wedding-leads-2026-11-14.csv");
    expect(clicked).toEqual(["wedding-leads-2026-11-14.csv"]);
    const u = new URL(calls[0].url, "http://x");
    expect(u.pathname).toBe("/api/v1/crm-leads/wedding/export");
    expect([...u.searchParams]).toEqual([
      ["format", "csv"],
      ["search", "ravi"],
      ["hide_repeats", "true"],
      ["interest", "interested"],
      ["interest", "not_set"],
      ["sort", "name"],
      ["order", "asc"],
    ]);
    URL.createObjectURL = origCreate;
    delete globalThis.document;
  });

  test("export: over-the-limit 400 is readable", async () => {
    replies.push(json(400, { detail: "This export has 61,234 leads; the limit is 50,000. Narrow the filters and try again." }));
    const err = await exportCrmLeads("spin", "xlsx", {}).catch((e) => e);
    expect(err.message).toBe("This export has 61,234 leads; the limit is 50,000. Narrow the filters and try again.");
  });

  test("import, edit, archive", async () => {
    replies.push(json(200, { rows: [], counts: { imported: 1 } }), json(200, { lead: {} }), json(200, { lead: {} }));
    await importCrmLeads("wedding_planner", [{ row: 2, values: { phone: "1" } }]);
    await editCrmLead("wedding_planner", "crm-ab", { name: null });
    await archiveCrmLead("wedding_planner", "crm-ab");
    expect(calls.map((c) => [c.method, c.url])).toEqual([
      ["POST", "/api/v1/crm-leads/wedding_planner/import"],
      ["PATCH", "/api/v1/crm-leads/wedding_planner/crm-ab"],
      ["POST", "/api/v1/crm-leads/wedding_planner/crm-ab/archive"],
    ]);
    expect(JSON.parse(calls[0].body)).toEqual({ rows: [{ row: 2, values: { phone: "1" } }] });
    expect(JSON.parse(calls[1].body)).toEqual({ values: { name: null } });
  });
});
