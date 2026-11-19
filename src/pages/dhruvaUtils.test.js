import { describe, expect, test } from "bun:test";
import { dhruvaErrors, dhruvaFieldAccess, dhruvaListLink, mapDhruvaRecheck, rowKind, rowsToDhruvaRecheck } from "./dhruvaUtils.js";

describe("Dhruva helpers", () => {
  test("list links repeat multi-value filters and carry dashboard dates", () => {
    expect(dhruvaListLink({ update_status: ["pending", "interested"] }, { from: "2026-11-01", to: "2026-11-05" })).toBe(
      "/dhruva-leads?update_status=pending&update_status=interested&date_from=2026-11-01&date_to=2026-11-05",
    );
  });
  test("row kinds prioritize duplicate and validation errors, then no phone", () => {
    expect(rowKind({ status: "duplicate" })).toBe("duplicate");
    expect(rowKind({ errors: [{ field: "name" }], flags: ["no_phone"] })).toBe("invalid");
    expect(rowKind({ flags: ["no_phone"] })).toBe("no_phone");
    expect(rowKind({ status: "ok" })).toBe("valid");
  });
  test("re-check CSV quotes cell values and maps row numbers back", () => {
    expect(rowsToDhruvaRecheck([{ row: 10, values: { name: "A, B", venue: "Hall\nOne" } }])).toBe(
      'Name,Venue,Date,Phone,Alt phone,Event type\r\n"A, B","Hall\nOne",,,,\r\n',
    );
    expect(mapDhruvaRecheck([{ row: 10 }], [{ row: 2, status: "ok" }])[0].row).toBe(10);
  });
  test("409 error exposes duplicate data and validation errors expose fields", () => {
    expect(dhruvaErrors({ detail: { message: "Duplicate", duplicate: { id: 3 } } })).toEqual({ fields: {}, message: "Duplicate", duplicate: { id: 3 } });
    expect(dhruvaErrors({ detail: [{ field: "phone", message: "Invalid" }] }).fields).toEqual({ phone: "Invalid" });
  });
  test("Dhruva logins can edit basic fields but only admins can edit admin fields or archive", () => {
    expect(dhruvaFieldAccess("dhruva")).toEqual({ editBasic: true, editAdmin: false, archive: false });
    expect(dhruvaFieldAccess("admin")).toEqual({ editBasic: true, editAdmin: true, archive: true });
    expect(dhruvaFieldAccess("vendor")).toEqual({ editBasic: false, editAdmin: false, archive: false });
  });
  test("view-only logins can't edit or archive anything", () => {
    expect(dhruvaFieldAccess("viewer")).toEqual({ editBasic: false, editAdmin: false, archive: false });
  });
});
