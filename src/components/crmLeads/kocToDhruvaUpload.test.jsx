import { beforeAll, describe, expect, mock, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { fillInfo, kocToDhruvaFields, spinCountChips, spinMatch } from "./kocToDhruvaUpload.js";
import { rowsToCsv } from "./crmLeadUtils.js";

// KOC → Dhruva bulk upload (docs section 18): columns from the preview, each row's Spin link
// (matched / not_in_spin; an upload never creates a Spin lead), the Spin counts, and the API paths
// (Spin's /crm-leads paths unchanged).

const SPIN_FIELDS = [
  { key: "name", label: "Name", type: "text", required: false },
  { key: "phone", label: "Phone", type: "phone", required: true },
  { key: "branch", label: "Branch", type: "branch" },
  { key: "occasionDate", label: "Event date", type: "date" },
];
const COLUMNS = {
  Name: "name", Phone: "phone", Branch: "branch", "Event date": "occasionDate", Update: "update_status",
  "Quoted amount": "quoted_amount", "Additional comments": "notes", Source: "source", Relation: "relation",
};

describe("preview columns", () => {
  const fields = kocToDhruvaFields(SPIN_FIELDS, COLUMNS, [{ row: 2, values: { phone: "9845012345", pincode: "560018" }, errors: [] }]);
  test("the file's headers as labels, in the file's order, then keys only in values", () => {
    expect(fields.map((f) => f.label)).toEqual([
      "Name", "Phone", "Branch", "Event date", "Update", "Quoted amount", "Additional comments", "Source", "Relation", "Pincode",
    ]);
  });
  test("only Phone is required; Source and Relation are optional text", () => {
    expect(fields.filter((f) => f.required).map((f) => f.key)).toEqual(["phone"]);
    expect(fields.find((f) => f.key === "source")).toMatchObject({ type: "text", required: false, max_length: 50 });
    expect(fields.find((f) => f.key === "relation")).toMatchObject({ type: "text", required: false, max_length: 100 });
  });
  test("types: Spin's for shared keys, the section's own for its CRM columns", () => {
    const type = (k) => fields.find((f) => f.key === k).type;
    expect([type("branch"), type("occasionDate"), type("update_status"), type("quoted_amount")]).toEqual(["branch", "date", "update", "amount"]);
  });
  test("the re-check CSV uses the file's headers; Spin's keeps field keys", () => {
    const rows = [{ row: 2, values: { name: "Asha", phone: "9845012345", branch: 4, source: "Instagram" } }];
    const branches = [{ id: 4, name: "Chamrajpet" }];
    const kd = rowsToCsv(fields.slice(0, 3).concat(fields.find((f) => f.key === "source")), rows, branches, { headers: "label" });
    expect(kd).toBe("Name,Phone,Branch,Source\r\nAsha,9845012345,Chamrajpet,Instagram\r\n");
    expect(rowsToCsv(SPIN_FIELDS.slice(0, 2), rows).split("\r\n")[0]).toBe("name,phone");
  });
});

describe("Spin match", () => {
  test("matched: the Spin leads and their vendors", () => {
    const m = spinMatch({
      spin: { action: "matched", leads: [{ lead_key: "101", origin: "workflow", name: "Asha", vendors: [{ id: 2, name: "Phodeo" }, { id: 4, name: "Kraftyz" }] }] },
      also_in: [{ source: "spin", count: 1, vendors: ["Phodeo", "Kraftyz"] }],
    });
    expect(m).toMatchObject({ tone: "match", label: "In Spin", detail: "Vendors: Phodeo, Kraftyz" });
    expect(m.leads).toEqual([{ key: "101", name: "Asha", vendors: ["Phodeo", "Kraftyz"] }]);
  });
  test("matched several, without vendors on the leads: also_in's vendors", () => {
    const m = spinMatch({ spin: { action: "matched", leads: [{ lead_key: "1" }, { lead_key: "crm-2" }] }, also_in: [{ source: "spin", count: 2, vendors: ["RJ"] }] });
    expect(m.label).toBe("In Spin (2 leads)");
    expect(m.detail).toBe("Vendors: RJ");
  });
  test("not_in_spin: added for Dhruva only", () => {
    expect(spinMatch({ spin: { action: "not_in_spin" }, also_in: [] })).toEqual({ tone: "dhruva", label: "Not in Spin (Dhruva only)", detail: "", leads: [] });
  });
  test("no spin object, or an action this screen doesn't know", () => {
    expect(spinMatch({}).label).toBe("—");
    expect(spinMatch({ spin: { action: "none" } }).tone).toBe("none");
  });
});

describe("Spin counts", () => {
  test("only spin_matched and spin_not_in_spin, in the preview and the result", () => {
    expect(spinCountChips({ spin_matched: 5, spin_not_in_spin: 3, imported: 8 })).toEqual([["In Spin", 5], ["Not in Spin (Dhruva only)", 3]]);
    expect(spinCountChips({ spin_matched: 0, spin_not_in_spin: 0 })).toEqual([["In Spin", 0], ["Not in Spin (Dhruva only)", 0]]);
    expect(spinCountChips({})).toEqual([]);
  });
});

describe("fill from the workflow", () => {
  test("fill: the filled fields (the preview's labels first) and Received", () => {
    const f = fillInfo(
      { fill: { workflow_id: 77, fields: { name: "Asha", email: "asha@example.com", quantity_required: 1200, pincode: "" }, received: "2026-11-20T05:00:00Z" } },
      [{ key: "name", label: "Customer name", type: "text" }],
    );
    expect(f.kind).toBe("fill");
    expect(f.workflowId).toBe(77);
    expect(f.items.map((i) => [i.label, i.value])).toEqual([["Customer name", "Asha"], ["Email", "asha@example.com"], ["Quantity required", 1200]]);
    expect(f.received).toBe("20 Nov 2026, 10:30 am");
  });
  test("fill_skipped: the API's reason, as returned", () => {
    expect(fillInfo({ fill_skipped: "Several workflow leads and no Received" })).toEqual({ kind: "skipped", text: "Several workflow leads and no Received" });
    expect(fillInfo({ fill_skipped: { message: "Conflicting name" } }).text).toBe("Conflicting name");
  });
  test("nothing to fill", () => {
    expect(fillInfo({})).toBeNull();
    expect(fillInfo({ fill: { workflow_id: 1, fields: {} } })).toBeNull();
  });
});

// ── API paths and the Spin match cell ──
const calls = [];
let uploadApi;
let SpinMatchCell;
let FillCell;
beforeAll(async () => {
  const storage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  globalThis.sessionStorage = storage;
  globalThis.localStorage = storage;
  const real = await import("../../api/client.js");
  mock.module("../../api/client.js", () => ({
    ...real,
    getAccessToken: () => "token",
    refreshAccessToken: async () => "token",
    peek: () => undefined,
    apiRequest: async (path, opts = {}) => {
      calls.push(`${opts.method ?? "GET"} ${path}`);
      return { rows: [], counts: { imported: 0, skipped: 0 } };
    },
  }));
  globalThis.fetch = async (url, opts = {}) => {
    calls.push(`${opts.method ?? "GET"} ${String(url).replace(/^.*\/api\/v1/, "")}`);
    return new Response("name,phone\r\n", { status: 200, headers: { "content-type": "text/csv" } });
  };
  uploadApi = (await import("../../api/uploads.js")).uploadApi;
  ({ SpinMatchCell, FillCell } = await import("./BulkUploadDialog.jsx"));
});

describe("upload API paths", () => {
  test("KOC → Dhruva uses /koc-to-dhruva/leads; Spin keeps /crm-leads/spin", async () => {
    calls.length = 0;
    const kd = uploadApi("koc_to_dhruva");
    await kd.templateHeaders();
    await kd.preview(new File(["Phone\r\n9845012345\r\n"], "a.csv"), undefined).catch(() => {});
    await kd.importRows([{ row: 2, values: { phone: "9845012345" } }]);
    await kd.fields();
    const spin = uploadApi("spin");
    await spin.templateHeaders();
    await spin.preview(new File(["phone\r\n"], "b.csv"), undefined).catch(() => {});
    await spin.importRows([]);
    expect(calls).toEqual([
      "GET /koc-to-dhruva/leads/template?format=csv",
      "POST /koc-to-dhruva/leads/import/preview",
      "POST /koc-to-dhruva/leads/import",
      "GET /crm-leads/spin/fields",
      "GET /crm-leads/spin/template?format=csv",
      "POST /crm-leads/spin/import/preview",
      "POST /crm-leads/spin/import",
    ]);
  });
});

describe("Spin match cell", () => {
  test("renders the match and the vendors", () => {
    const html = renderToString(
      <SpinMatchCell row={{ spin: { action: "matched", leads: [{ lead_key: "101", name: "Asha", vendors: [{ id: 2, name: "Phodeo" }] }] } }} />,
    );
    expect(html).toContain("In Spin");
    expect(html).toContain("Asha · Phodeo");
    expect(renderToString(<SpinMatchCell row={{ spin: { action: "not_in_spin" } }} />)).toContain("Not in Spin (Dhruva only)");
    expect(renderToString(<SpinMatchCell row={{}} />)).toContain("—");
  });
});

describe("fill cell", () => {
  test("renders the filled fields, branch names and Received, or why not filled", () => {
    const html = renderToString(
      <FillCell
        row={{ fill: { workflow_id: 5, fields: { branch: 4, occasionDate: "2026-12-20" }, received: "2026-11-20" } }}
        fields={[{ key: "occasionDate", label: "Event date", type: "date" }]}
        branches={[{ id: 4, name: "Chamrajpet" }]}
      />,
    );
    expect(html).toContain("Filled from workflow (2)");
    expect(html).toContain("Chamrajpet");
    expect(html).toContain("20 Dec 2026");
    expect(html).toContain("Received: 20 Nov 2026");
    const skipped = renderToString(<FillCell row={{ fill_skipped: "Conflicting fields" }} />);
    expect(skipped).toContain("Not filled");
    expect(skipped).toContain("Conflicting fields");
    expect(renderToString(<FillCell row={{}} />)).toContain("—");
  });
});
