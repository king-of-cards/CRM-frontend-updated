import { describe, expect, test } from "bun:test";
import { dashboardKpiLinks, funnelRows, inflowPoints, linkFor, num, statusRows, vendorCells } from "./vendorToKocDashboard.js";
import {
  dayText,
  fileDate,
  kocErrors,
  kocListLink,
  mapKocRecheck,
  phoneText,
  rowKind,
  rowsToKocCsv,
  statusLabel,
} from "../components/vendorToKoc/kocUtils.js";
import { activeCount, readFilters, toApiQuery, withoutKocAdminKeys } from "../components/leads/leadFilters.js";

const PERIOD = { from: "2026-10-18", to: "2026-11-16" };

describe("dashboard numbers and links", () => {
  test("— for 0 / null, and no link", () => {
    expect(num(0)).toBe("—");
    expect(num(null)).toBe("—");
    expect(num(1234)).toBe("1,234");
    expect(linkFor(0, {}, PERIOD)).toBe(null);
  });
  test("links carry the filters and the period; All time has no dates", () => {
    expect(linkFor(5, { update_status: ["pending"] }, PERIOD)).toBe(
      "/vendor-to-koc?update_status=pending&date_from=2026-10-18&date_to=2026-11-16",
    );
    expect(kocListLink({ follow_up_due: "true" }, { all: true })).toBe("/vendor-to-koc?follow_up_due=true");
  });
  test("funnel steps map to repeated statuses", () => {
    const rows = funnelRows({ received: 10, updated: 6, engaged: 4, converted: 2 });
    expect(rows.map((r) => r.count)).toEqual([10, 6, 4, 2]);
    expect(kocListLink(rows[2].filters, { all: true })).toBe(
      "/vendor-to-koc?update_status=interested&update_status=will_call_back&update_status=converted",
    );
    expect(rows[1].filters.update_status).toHaveLength(7);
  });
  test("status breakdown: Pending first, then the 7 labels", () => {
    const rows = statusRows({ pending: 3, converted: 1 });
    expect(rows.map((r) => r.label)).toEqual([
      "Pending",
      "Converted",
      "Not converted",
      "Already purchased somewhere else",
      "Already purchased with us",
      "Will call back",
      "Interested",
      "Not interested",
    ]);
    expect(rows[0].count).toBe(3);
  });
  test("per-vendor cells filter by vendor and status", () => {
    const cells = vendorCells({ vendor_id: 2, interested: 4, converted: 1, pending: 0 });
    expect(cells.map((c) => c.label)).toEqual(["INTERESTED", "CONVERTED", "PENDING"]);
    expect(kocListLink(cells[0].filters, PERIOD)).toBe(
      "/vendor-to-koc?vendor_id=2&update_status=interested&date_from=2026-10-18&date_to=2026-11-16",
    );
  });
  test("inflow points get one key per vendor", () => {
    expect(inflowPoints([{ date: "2026-11-01", end: "2026-11-07", total: 3, vendors: { 2: 2, 5: 1 } }])).toEqual([
      { date: "2026-11-01", end: "2026-11-07", total: 3, v2: 2, v5: 1 },
    ]);
  });
});

describe("list helpers", () => {
  test("labels and display formats", () => {
    expect(statusLabel(null)).toBe("Pending");
    expect(statusLabel("purchased_with_us")).toBe("Already purchased with us");
    expect(dayText("2026-12-13")).toBe("13 Dec 2026");
    expect(phoneText("9845012345")).toBe("+919845012345");
  });
  test("filters: URL keys, admin keys dropped for vendors, badge count", () => {
    const f = readFilters(
      new URLSearchParams("search=a&vendor_id=2&update_status=pending&update_status=converted&follow_up_due=true&source=manual&city=Goa&interest=x"),
      "vendor_to_koc",
    );
    const q = toApiQuery(f, "vendor_to_koc");
    expect(q).toEqual({
      search: "a",
      vendor_id: ["2"],
      update_status: ["pending", "converted"],
      follow_up_due: "true",
      city: "Goa",
      source: ["manual"],
    });
    // vendor logins: only the Vendor filter is dropped
    expect(withoutKocAdminKeys(q)).toEqual({
      search: "a",
      update_status: ["pending", "converted"],
      follow_up_due: "true",
      city: "Goa",
      source: ["manual"],
    });
    expect(activeCount(f, "vendor_to_koc")).toBe(5); // vendor, update, follow-up, city, source
  });
});

describe("dashboard KPI card links", () => {
  test("matching filters carry the received-date period", () => {
    const links = dashboardKpiLinks(PERIOD);
    expect(links.total).toBe("/vendor-to-koc?date_from=2026-10-18&date_to=2026-11-16");
    expect(links.interested).toContain("update_status=interested");
    expect(links.interested).toContain("date_from=2026-10-18");
    expect(links.pending).toContain("update_status=pending");
    expect(links.converted).toContain("update_status=converted");
    expect(links).not.toHaveProperty("purchased_with_us");
  });
  test("AOV opens exactly the converted leads with a conversion amount, with the period", () => {
    expect(dashboardKpiLinks(PERIOD).aov).toBe("/vendor-to-koc?update_status=converted&conversion=has&date_from=2026-10-18&date_to=2026-11-16");
    expect(dashboardKpiLinks({ all: true }).aov).toBe("/vendor-to-koc?update_status=converted&conversion=has");
  });
  test("follow-ups due uses its all-time filter because the API excludes the period", () => {
    expect(dashboardKpiLinks(PERIOD).follow_ups_due).toBe("/vendor-to-koc?follow_up_due=true");
  });
  test("quote and conversion cards open the list's quote / conversion filters with the period", () => {
    const links = dashboardKpiLinks(PERIOD);
    expect(links.quotes_sent).toBe("/vendor-to-koc?quote=has&date_from=2026-10-18&date_to=2026-11-16");
    expect(links.quoted_amount).toBe("/vendor-to-koc?quote=has&date_from=2026-10-18&date_to=2026-11-16");
    expect(links.conversion_amount).toBe("/vendor-to-koc?conversion=has&date_from=2026-10-18&date_to=2026-11-16");
    expect(links.hot_leads).toBe("/vendor-to-koc?hot=yes&date_from=2026-10-18&date_to=2026-11-16");
  });
  test("All time: the quote / conversion links carry no dates", () => {
    const links = dashboardKpiLinks({ all: true });
    expect(links.quotes_sent).toBe("/vendor-to-koc?quote=has");
    expect(links.quoted_amount).toBe("/vendor-to-koc?quote=has");
    expect(links.conversion_amount).toBe("/vendor-to-koc?conversion=has");
  });
});

describe("bulk upload re-check", () => {
  test("CSV with file dates (DD-MM-YYYY) and quoting", () => {
    expect(fileDate("2026-12-13")).toBe("13-12-2026");
    expect(fileDate("13 Dec")).toBe("13 Dec");
    expect(rowsToKocCsv([{ name: 'Asha "A", R', date: "2026-12-13", phone: "9845012345", city: null }])).toBe(
      'Name,Date,Phone,City\r\n"Asha ""A"", R",13-12-2026,9845012345,\r\n',
    );
  });
  test("row numbers go back to the file's rows; row kinds", () => {
    expect(mapKocRecheck([{ row: 5 }, { row: 9 }], [{ row: 2 }, { row: 3 }]).map((r) => r.row)).toEqual([5, 9]);
    expect(rowKind({ errors: [{ field: "phone", message: "x" }], duplicate: true })).toBe("invalid");
    expect(rowKind({ errors: [], duplicate: true })).toBe("duplicate");
    expect(rowKind({ errors: [] })).toBe("valid");
  });
  test("errors exactly as the API sends them (no text matching)", () => {
    const msg = "Date must be a date, or text like 13-12-2026 or 13 Dec 2026";
    expect(kocErrors({ status: 422, detail: [{ field: "date", message: msg }] })).toEqual({ fields: { date: msg }, message: "" });
    expect(kocErrors({ status: 409, detail: "A lead with this phone already exists for this vendor", message: "x" }).message).toBe(
      "A lead with this phone already exists for this vendor",
    );
    expect(
      kocErrors({ status: 422, detail: [{ loc: ["body", "vendor_id"], msg: "vendor_id is required for admins" }] }).fields,
    ).toEqual({ vendor_id: "vendor_id is required for admins" });
  });
});
