import { describe, expect, test } from "bun:test";
import {
  assignedChoice,
  assignedForUpload,
  AUTOMATIC,
  parseCsvHeader,
  previewColumns,
  screenFieldKeys,
  uploadFields,
  ddmmyyyy,
  duplicateLabel,
  duplicateWhere,
  errorsByField,
  errorText,
  exportQuery,
  filenameFromDisposition,
  formToValues,
  isCrmLead,
  mapRecheck,
  rowsToCsv,
  skippedText,
  submitLabel,
  summarize,
  toIstInput,
  valuesToForm,
} from "./crmLeadUtils.js";

describe("filenameFromDisposition", () => {
  test("quoted, plain, RFC 5987 and missing", () => {
    expect(filenameFromDisposition('attachment; filename="wedding-leads-2026-11-14.xlsx"', "x")).toBe(
      "wedding-leads-2026-11-14.xlsx",
    );
    expect(filenameFromDisposition("attachment; filename=spin-leads.csv", "x")).toBe("spin-leads.csv");
    expect(filenameFromDisposition("attachment; filename*=UTF-8''a%20b.csv", "x")).toBe("a b.csv");
    expect(filenameFromDisposition(null, "fallback.xlsx")).toBe("fallback.xlsx");
  });
});

describe("exportQuery", () => {
  test("passes the list's filter query through; drops paging and empty values", () => {
    expect(
      exportQuery(
        "wedding",
        { page: 3, page_size: 8, search: "ravi", occasion: "", city: "Hyd", hide_repeats: "true", sort: "name", order: "asc" },
        "csv",
      ),
    ).toEqual({ format: "csv", search: "ravi", city: "Hyd", hide_repeats: "true", sort: "name", order: "asc" });
  });

  test("repeated filters stay arrays; empty arrays are dropped", () => {
    expect(
      exportQuery("whatsapp", { update_status: ["interested", "pending"], origin: [], vendor_id: ["2"], quote: "gt:50000" }),
    ).toEqual({ format: "xlsx", update_status: ["interested", "pending"], vendor_id: ["2"], quote: "gt:50000" });
  });

  test("spin: no order without a sort", () => {
    expect(exportQuery("spin", { search: "a", branch: "4", sort: undefined, order: "desc" })).toEqual({
      format: "xlsx",
      search: "a",
      branch: "4",
    });
  });
});

describe("dates", () => {
  test("ddmmyyyy is the India date", () => {
    expect(ddmmyyyy("2026-11-14T20:00:00+00:00")).toBe("15-11-2026");
    expect(ddmmyyyy(null)).toBe("");
  });
  test("toIstInput for datetime-local", () => {
    expect(toIstInput("2026-11-14T05:00:00+00:00")).toBe("2026-11-14T10:30");
  });
});

describe("duplicates", () => {
  test("labels and tooltips", () => {
    expect(duplicateLabel({ reason: "in_file", duplicate_of_row: 2 })).toBe("Repeated in this file (same as row 2)");
    expect(duplicateLabel({ reason: "existing_sheet" })).toBe("Already exists");
    expect(duplicateWhere({ reason: "existing_sheet" })).toBe("In the sheet");
    expect(duplicateWhere({ reason: "existing_workflow" })).toBe("In the spin game");
    expect(duplicateWhere({ reason: "existing_added", created_at: "2026-11-14T05:00:00+00:00" })).toBe("Added on 14-11-2026");
    expect(duplicateWhere({ reason: "existing_added", created_at: "2026-11-14T05:00:00+00:00", archived: true })).toBe(
      "Added on 14-11-2026 (archived)",
    );
  });
});

describe("summary", () => {
  const rows = [
    { status: "ok", warnings: [{ type: "other_source", sources: ["wedding"] }] },
    { status: "ok", warnings: [] },
    { status: "error", warnings: [] },
    { status: "duplicate", duplicate: { reason: "in_file", duplicate_of_row: 2 }, warnings: [] },
    { status: "duplicate", duplicate: { reason: "existing_added" }, warnings: [] },
    { status: "duplicate", duplicate: { reason: "existing_sheet" }, warnings: [] },
  ];
  test("counts", () => {
    expect(summarize(rows)).toEqual({ total: 6, ok: 2, errors: 1, inFile: 1, existing: 2, otherSource: 1 });
  });
  test("skipped text and submit label", () => {
    expect(skippedText(summarize(rows))).toBe("Skipping 1 that needs fixing, 1 repeated in this file and 2 that already exist.");
    expect(skippedText({ errors: 0, inFile: 0, existing: 1 })).toBe("Skipping 1 that already exists.");
    expect(skippedText({ errors: 0, inFile: 0, existing: 0 })).toBe("");
    expect(submitLabel(1)).toBe("Submit 1 new lead");
    expect(submitLabel(12)).toBe("Submit 12 new leads");
  });
});

describe("re-check", () => {
  const fields = [
    { key: "phone", type: "phone" },
    { key: "name", type: "text" },
    { key: "branch", type: "branch" },
    { key: "consent", type: "bool" },
  ];
  test("CSV uses keys, branch names, Yes/No and quoting", () => {
    const csv = rowsToCsv(
      fields,
      [
        { row: 2, values: { phone: "9845012345", name: 'Asha "A", Rao', branch: 4, consent: true } },
        { row: 7, values: { phone: "+91 98450", name: null, branch: "Jaynagar", consent: false } },
      ],
      [{ id: 4, name: "Jayanagar" }],
    );
    expect(csv).toBe('phone,name,branch,consent\r\n9845012345,"Asha ""A"", Rao",Jayanagar,Yes\r\n+91 98450,,Jaynagar,No\r\n');
  });

  test("row numbers go back to the file's rows", () => {
    const sent = [{ row: 3 }, { row: 9 }, { row: 12 }];
    const checked = [
      { row: 2, status: "ok", duplicate: null },
      { row: 3, status: "error", duplicate: null },
      { row: 4, status: "duplicate", duplicate: { reason: "in_file", duplicate_of_row: 2 } },
    ];
    const out = mapRecheck(sent, checked);
    expect(out.map((r) => r.row)).toEqual([3, 9, 12]);
    expect(out[2].duplicate).toEqual({ reason: "in_file", duplicate_of_row: 3 });
  });
});

describe("forms", () => {
  const fields = [
    { key: "phone", type: "phone" },
    { key: "name", type: "text" },
    { key: "branch", type: "branch" },
    { key: "ok", type: "bool" },
    { key: "submitted_at", type: "datetime" },
  ];
  test("add sends only filled fields, typed", () => {
    expect(formToValues(fields, { phone: " 98450 ", name: "", branch: "4", ok: "no", submitted_at: "" })).toEqual({
      phone: "98450",
      branch: 4,
      ok: false,
    });
  });
  test("edit sends only changes; cleared = null", () => {
    const original = valuesToForm(fields, { phone: "+9198", name: "A", branch: 4, ok: true, submitted_at: "2026-11-14T05:00:00+00:00" });
    expect(original).toEqual({ phone: "+9198", name: "A", branch: "4", ok: "yes", submitted_at: "2026-11-14T10:30" });
    expect(formToValues(fields, { ...original, name: "", ok: "no" }, { onlyChanged: original })).toEqual({ name: null, ok: false });
  });
});

describe("errors and origin", () => {
  test("errorText reads our detail.message", () => {
    expect(errorText({ message: "Request failed (409)", detail: { message: "A lead with this phone number already exists." } })).toBe(
      "A lead with this phone number already exists.",
    );
    expect(errorText({ message: "This export has 61,234 leads; the limit is 50,000.", detail: "x" })).toBe(
      "This export has 61,234 leads; the limit is 50,000.",
    );
  });
  test("errorsByField", () => {
    expect(
      errorsByField({ status: 422, detail: { message: "m", errors: [{ field: "email", message: "Not a valid email address" }] } }),
    ).toEqual({ email: "Not a valid email address" });
  });
  test("isCrmLead", () => {
    expect(isCrmLead({ origin: "added" })).toBe(true);
    expect(isCrmLead({ origin: "imported" })).toBe(true);
    expect(isCrmLead({ origin: "sheet" })).toBe(false);
    expect(isCrmLead({ origin: "workflow" })).toBe(false);
    expect(isCrmLead({})).toBe(false);
  });
});

describe("preview columns from the template", () => {
  const fields = [
    { key: "name", label: "Lead" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Contact" },
    { key: "assigned_to", label: "Assigned to" },
    { key: "created_at", label: "Created" },
    { key: "pincode", label: "Pincode" },
    { key: "service", label: "Service" },
  ];
  test("parseCsvHeader: BOM, quotes, CRLF", () => {
    expect(parseCsvHeader('﻿Lead,Email,"Contact",Assigned to,"Quoted, amount",Created\r\nAsha,,,,,\r\n')).toEqual([
      "Lead",
      "Email",
      "Contact",
      "Assigned to",
      "Quoted, amount",
      "Created",
    ]);
  });
  test("screen columns + file/error extras, in field order; read-only headers drop out", () => {
    const screen = screenFieldKeys(fields, ["Lead", "Email", "Contact", "Interest", "Assigned to", "Created"]);
    expect([...screen]).toEqual(["name", "email", "phone", "assigned_to", "created_at"]);
    expect(previewColumns(fields, { screenKeys: screen, fileKeys: ["service"] }).map((f) => f.key)).toEqual([
      "name",
      "email",
      "phone",
      "assigned_to",
      "created_at",
      "service",
    ]);
  });
  test("without the template: file columns, errors and phone", () => {
    expect(previewColumns(fields, { fileKeys: ["name"], errorKeys: ["pincode"] }).map((f) => f.key)).toEqual([
      "name",
      "phone",
      "pincode",
    ]);
  });
});

describe("Assigned to choices", () => {
  test("file values -> dropdown", () => {
    expect(assignedChoice("Phodeo · auto")).toBe(AUTOMATIC);
    expect(assignedChoice("Automatic")).toBe(AUTOMATIC);
    expect(assignedChoice("auto")).toBe(AUTOMATIC);
    expect(assignedChoice("AUTO")).toBe(AUTOMATIC);
    expect(assignedChoice("RJ (auto)")).toBe(AUTOMATIC);
    expect(assignedChoice("Unassigned")).toBe("Unassigned");
    expect(assignedChoice("")).toBe("Unassigned");
    expect(assignedChoice(null)).toBe("Unassigned");
    expect(assignedChoice("Phodeo")).toBe("Phodeo");
    expect(assignedChoice("Autograph Studio")).toBe("Autograph Studio");
  });
  test("dropdown -> upload value", () => {
    expect(assignedForUpload(AUTOMATIC)).toBe("Automatic");
    expect(assignedForUpload("RJ")).toBe("RJ");
    expect(assignedForUpload("Unassigned")).toBe("Unassigned");
  });
});

describe("upload-only CRM columns", () => {
  const fields = [
    { key: "name", label: "Lead" },
    { key: "phone", label: "Contact", type: "phone" },
    { key: "assigned_to", label: "Assigned to", type: "assigned" },
    { key: "submitted_at", label: "Submitted", type: "datetime" },
  ];
  test("Update, Quoted amount and Conversion amount are added after GET fields", () => {
    expect(uploadFields(fields).map((f) => f.key)).toEqual([
      "name",
      "phone",
      "assigned_to",
      "submitted_at",
      "update_status",
      "quoted_amount",
      "conversion_amount",
    ]);
  });
  test("preview columns follow the template's order; read-only columns (Quoted date) drop out", () => {
    const all = uploadFields(fields);
    const headers = ["Lead", "Contact", "Assigned to", "Update", "Quoted amount", "Quoted date", "Conversion amount", "Submitted"];
    expect(previewColumns(all, { screenKeys: screenFieldKeys(all, headers) }).map((f) => f.label)).toEqual([
      "Lead",
      "Contact",
      "Assigned to",
      "Update",
      "Quoted amount",
      "Conversion amount",
      "Submitted",
    ]);
  });
  test("the re-check CSV sends the update code and amounts back as the preview returned them", () => {
    const csv = rowsToCsv(uploadFields(fields), [
      { row: 2, values: { name: "Asha", phone: "9845012345", update_status: "will_call_back", quoted_amount: 150000, conversion_amount: null } },
    ]);
    expect(csv).toBe(
      "name,phone,assigned_to,submitted_at,update_status,quoted_amount,conversion_amount\r\nAsha,9845012345,,,will_call_back,150000,\r\n",
    );
  });
});
