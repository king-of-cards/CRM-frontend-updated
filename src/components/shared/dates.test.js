import { describe, expect, test } from "bun:test";
import { formatDateTime, formatDay, personName } from "./dates.js";
import { kpiGridCols } from "./kpiGrid.js";

describe("formatDay", () => {
  test("ISO dates read 19 Nov 2026", () => {
    expect(formatDay("2026-11-19")).toBe("19 Nov 2026");
    expect(formatDay("2026-09-03")).toBe("3 Sep 2026");
  });
  test("date-times use the India date", () => {
    expect(formatDay("2026-11-19T05:00:00Z")).toBe("19 Nov 2026");
    expect(formatDay("2026-11-19T20:00:00+00:00")).toBe("20 Nov 2026");
    expect(formatDay(new Date("2026-11-19T05:00:00Z"))).toBe("19 Nov 2026");
  });
  test("empty gives the fallback; other text stays as written", () => {
    expect(formatDay(null)).toBe("");
    expect(formatDay("", "—")).toBe("—");
    expect(formatDay("April 2027")).toBe("April 2027");
  });
});

describe("formatDateTime", () => {
  test("India time, 12-hour clock", () => {
    expect(formatDateTime("2026-11-19T05:00:00.000Z")).toBe("19 Nov 2026, 10:30 am");
    expect(formatDateTime("2026-11-19T12:35:00Z")).toBe("19 Nov 2026, 06:05 pm");
    expect(formatDateTime("2026-11-18T18:40:00Z")).toBe("19 Nov 2026, 12:10 am");
  });
  test("a zone-less time is India time; a plain date has no time", () => {
    expect(formatDateTime("2026-11-19T10:30:00")).toBe("19 Nov 2026, 10:30 am");
    expect(formatDateTime("2026-11-19")).toBe("19 Nov 2026");
    expect(formatDateTime(undefined, "—")).toBe("—");
  });
});

describe("personName", () => {
  test("the API's name as sent, Deleted user included; fallback only without one", () => {
    expect(personName("Asha")).toBe("Asha");
    expect(personName("Deleted user")).toBe("Deleted user");
    expect(personName(null)).toBe("—");
    expect(personName("  ", "")).toBe("");
  });
});

describe("kpiGridCols", () => {
  test("2 per row on phones, 3 or 4 from lg", () => {
    expect(kpiGridCols(6)).toBe("grid-cols-2 lg:grid-cols-3");
    expect(kpiGridCols(8)).toBe("grid-cols-2 lg:grid-cols-4");
    expect(kpiGridCols(5)).toBe("grid-cols-2 lg:grid-cols-4");
    expect(kpiGridCols(2)).toBe("grid-cols-2");
  });
});
