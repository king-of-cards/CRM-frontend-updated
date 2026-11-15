import { describe, expect, test } from "bun:test";
import {
  addDays,
  daysInclusive,
  modeOf,
  periodError,
  periodFromSearch,
  periodLabel,
  presetPeriod,
  todayIst,
} from "./dashboardPeriod.js";

const TODAY = "2026-11-16";
const q = (s) => new URLSearchParams(s);

describe("today and day maths", () => {
  test("today is the India date", () => {
    // 19:00 UTC on the 15th is 00:30 IST on the 16th
    expect(todayIst(new Date("2026-11-15T19:00:00Z"))).toBe("2026-11-16");
    expect(todayIst(new Date("2026-11-15T18:00:00Z"))).toBe("2026-11-15");
  });
  test("addDays and inclusive day count", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(daysInclusive("2026-11-16", "2026-11-16")).toBe(1);
    expect(daysInclusive("2026-10-18", "2026-11-16")).toBe(30);
  });
});

describe("presets", () => {
  test("Last 7 / 15 / 30 days end today", () => {
    expect(presetPeriod("7", TODAY)).toEqual({ from: "2026-11-10", to: TODAY });
    expect(presetPeriod("15", TODAY)).toEqual({ from: "2026-11-02", to: TODAY });
    expect(presetPeriod("30", TODAY)).toEqual({ from: "2026-10-18", to: TODAY });
  });
});

describe("URL -> period", () => {
  test("no params = Last 30 days", () => {
    expect(periodFromSearch(q(""), TODAY)).toEqual({ from: "2026-10-18", to: TODAY });
  });
  test("both, or one = that single day", () => {
    expect(periodFromSearch(q("from=2026-11-01&to=2026-11-05"), TODAY)).toEqual({ from: "2026-11-01", to: "2026-11-05" });
    expect(periodFromSearch(q("from=2026-11-03"), TODAY)).toEqual({ from: "2026-11-03", to: "2026-11-03" });
    expect(periodFromSearch(q("to=2026-11-03"), TODAY)).toEqual({ from: "2026-11-03", to: "2026-11-03" });
  });
});

describe("dropdown name for a period", () => {
  test("exactly a preset ending today -> that preset", () => {
    expect(modeOf({ from: "2026-11-10", to: TODAY }, TODAY)).toBe("7");
    expect(modeOf({ from: "2026-11-02", to: TODAY }, TODAY)).toBe("15");
    expect(modeOf({ from: "2026-10-18", to: TODAY }, TODAY)).toBe("30");
  });
  test("same length but not ending today -> Date range", () => {
    expect(modeOf({ from: "2026-11-09", to: "2026-11-15" }, TODAY)).toBe("range");
  });
  test("ends today, not a preset length -> Date range", () => {
    expect(modeOf({ from: "2026-11-01", to: TODAY }, TODAY)).toBe("range");
  });
  test("from = to -> Single date (also today)", () => {
    expect(modeOf({ from: "2026-11-03", to: "2026-11-03" }, TODAY)).toBe("single");
    expect(modeOf({ from: TODAY, to: TODAY }, TODAY)).toBe("single");
  });
  test("a shared 'Last 7 days' link opened a day later -> Date range", () => {
    expect(modeOf({ from: "2026-11-10", to: TODAY }, "2026-11-17")).toBe("range");
  });
});

describe("validation", () => {
  test("ok", () => {
    expect(periodError({ from: "2025-11-16", to: TODAY }, TODAY)).toBe(null); // 366 days
    expect(periodError({ from: TODAY, to: TODAY }, TODAY)).toBe(null);
  });
  test("future, order, length, format", () => {
    expect(periodError({ from: "2026-11-10", to: "2026-11-17" }, TODAY)).toBe("Dates can't be in the future.");
    expect(periodError({ from: "2026-11-10", to: "2026-11-01" }, TODAY)).toBe("The start date must be on or before the end date.");
    expect(periodError({ from: "2025-11-15", to: TODAY }, TODAY)).toBe("The period can be at most 1 year."); // 367 days
    expect(periodError({ from: "16-11-2026", to: TODAY }, TODAY)).toBe("Pick a valid date.");
    expect(periodError({ from: "", to: TODAY }, TODAY)).toBe("Pick a valid date.");
  });
});

describe("labels", () => {
  test("single, same month, across months, across years", () => {
    expect(periodLabel(TODAY, TODAY)).toBe("16 Nov 2026");
    expect(periodLabel("2026-11-02", "2026-11-08")).toBe("2 – 8 Nov 2026");
    expect(periodLabel("2026-10-18", TODAY)).toBe("18 Oct – 16 Nov 2026");
    expect(periodLabel("2025-12-18", "2026-01-16")).toBe("18 Dec 2025 – 16 Jan 2026");
  });
});
