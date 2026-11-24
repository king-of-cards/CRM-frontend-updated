import { describe, expect, test } from "bun:test";
import {
  cleanDates, dhruvaChanges, dhruvaErrors, dhruvaFieldAccess, dhruvaFormErrors, dhruvaFormOf, dhruvaListLink, dhruvaNewLead,
  dhruvaStatCards, eventDatesOf, eventDatesText, mapDhruvaRecheck, phoneDigits, phoneError, rowKind, rowsToDhruvaRecheck,
  cleanPhones, phonesOf, phonesText,
} from "./dhruvaUtils.js";
import { kpiCards } from "../components/leads/kpiCards.js";

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
  test("re-check CSV: the template's 15 headings (one Phone numbers column), quoted values, lists and Yes / No; row numbers mapped back", () => {
    const csv = rowsToDhruvaRecheck([{ row: 10, values: { name: "A, B", venue: "Hall\nOne", phones: ["9845012345", "9845012346"], event_dates: ["2026-12-05", "2026-12-04"], needs_intervention: true, update_status: "interested" } }]);
    const [head, row] = csv.split("\r\n");
    expect(head).toBe("Name,Phone numbers,Event date,Event type,Venue,WhatsApp status,Response,Message sent,Follow-up notes,Comments,Needs Dhruva intervention,Update,Quoted amount,Conversion amount,Follow-up date");
    expect(row).toBe('"A, B","9845012345, 9845012346","2026-12-04, 2026-12-05",,"Hall\nOne",,,,,,Yes,interested,,,');
    expect(rowsToDhruvaRecheck([{ row: 3, values: { name: "C", phones: "9845012345, 98450" } }]).split("\r\n")[1]).toBe('C,"9845012345, 98450",,,,,,,,,,,,,');
    expect(head).not.toMatch(/Alternate phone|(^|,)Phone(,|$)/);
    expect(head).not.toContain("Date,"); // no old Date column
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

describe("Dhruva → KOC fields (docs section 13)", () => {
  const lead = {
    id: 8, name: "Asha", phones: ["9800000001"], phones_e164: ["+919800000001"], event_dates: ["2026-12-04", "2026-12-05"], event_date: "2026-12-04",
    event_type: "Wedding", venue: "Palace", sent_at: "2026-11-20T10:00:00Z", whatsapp_status: "Delivered", response: null,
    message_sent: null, follow_up_notes: null, comments: "Old", needs_intervention: false, update_status: null,
    quoted_amount: 45000, conversion_amount: null, follow_up_date: null,
  };
  test("event dates: a list, sorted, repeats dropped; older answers' event_date as one date", () => {
    expect(cleanDates(["2026-12-05", " 2026-12-04", "2026-12-05", ""])).toEqual(["2026-12-04", "2026-12-05"]);
    expect(cleanDates("2026-12-05, 2026-12-04")).toEqual(["2026-12-04", "2026-12-05"]);
    expect(eventDatesOf({ event_date: "2026-12-01" })).toEqual(["2026-12-01"]);
    expect(eventDatesText(lead.event_dates)).toBe("4 Dec 2026, 5 Dec 2026");
    expect(eventDatesText([])).toBe("—");
  });
  test("phone: digits only, 10 at most (+91 / 0 dropped); anything else is an error", () => {
    expect(phoneDigits("+91 98000-00001")).toBe("9800000001");
    expect(phoneDigits("09800000001")).toBe("9800000001");
    expect(phoneDigits("98000abc000011")).toBe("9800000001");
    expect(phoneError("98000")).toBe("Phone must have 10 digits");
    expect(phoneError("9800000001")).toBe("");
    expect(phoneError("")).toBe("");
  });
  test("phone numbers: phones from the lead, order kept, repeats dropped; shown as 10 digits", () => {
    expect(phonesOf({ phones: ["9845012346", "9845012345", "9845012346"], phones_e164: [] })).toEqual(["9845012346", "9845012345"]);
    expect(phonesOf({ phones: [] })).toEqual([]);
    expect(phonesOf({})).toEqual([]);
    expect(cleanPhones("9845012345; 9845012346\n9845012345")).toEqual(["9845012345", "9845012346"]);
    expect(phonesText(["+919845012345", "9845012346"])).toBe("9845012345, 9845012346");
    expect(phonesText([])).toBe("—");
  });
  test("PATCH: phones as the full list in E.164; [] clears them", () => {
    const two = { ...lead, phones: ["9800000001", "9800000003"] };
    expect(dhruvaChanges(lead, { ...dhruvaFormOf(lead), phones: ["9800000001", "9800000003"] })).toEqual({ phones: ["+919800000001", "+919800000003"] });
    expect(dhruvaChanges(two, { ...dhruvaFormOf(two), phones: ["9800000003"] })).toEqual({ phones: ["+919800000003"] });
    expect(dhruvaChanges(lead, { ...dhruvaFormOf(lead), phones: [] })).toEqual({ phones: [] });
    expect(Object.keys(dhruvaChanges(lead, { ...dhruvaFormOf(lead), phones: [] }))).not.toContain("phone");
  });
  test("PATCH: only what changed; event_dates as the full new list; never sent_at", () => {
    const form = { ...dhruvaFormOf(lead), event_dates: ["2026-12-04", "2026-12-06"], comments: "New", sent_at: "2030-01-01" };
    expect(dhruvaChanges(lead, form, { koc: true })).toEqual({ event_dates: ["2026-12-04", "2026-12-06"], comments: "New" });
    expect(dhruvaChanges(lead, dhruvaFormOf(lead), { koc: true })).toEqual({});
    const removed = { ...dhruvaFormOf(lead), event_dates: ["2026-12-05"] };
    expect(dhruvaChanges(lead, removed)).toEqual({ event_dates: ["2026-12-05"] });
  });
  test("Dhruva logins: KOC fields are never sent; admins send them", () => {
    const form = { ...dhruvaFormOf(lead), venue: "Hall", whatsapp_status: "Read", needs_intervention: true, update_status: "interested", quoted_amount: "1,50,000" };
    expect(dhruvaChanges(lead, form, { koc: false })).toEqual({ venue: "Hall" });
    expect(dhruvaChanges(lead, form, { koc: true })).toEqual({ venue: "Hall", whatsapp_status: "Read", needs_intervention: true, update_status: "interested", quoted_amount: 150000 });
  });
  test("new lead: filled fields only; KOC fields only for admins", () => {
    const form = { ...dhruvaFormOf(null), name: " Ravi ", phones: ["9800000002", "9000000002"], event_dates: ["2026-12-25"], whatsapp_status: "Sent", needs_intervention: true };
    expect(dhruvaNewLead(form)).toEqual({ name: "Ravi", phones: ["+919800000002", "+919000000002"], event_dates: ["2026-12-25"] });
    expect(dhruvaNewLead(form, { koc: true })).toEqual({ name: "Ravi", phones: ["+919800000002", "+919000000002"], event_dates: ["2026-12-25"], whatsapp_status: "Sent", needs_intervention: true });
    expect(dhruvaNewLead({ ...dhruvaFormOf(null), name: "No phone" })).toEqual({ name: "No phone" });
  });
  test("form errors before saving: name, 10 digits per phone number, real dates", () => {
    expect(dhruvaFormErrors({ ...dhruvaFormOf(null), phones: ["9800000001", "98000"], event_dates: ["Dec 4th"] })).toEqual({
      name: "Name is required", phones: "Each phone number must have 10 digits", event_dates: "Use real dates (YYYY-MM-DD)",
    });
    expect(dhruvaFormErrors(dhruvaFormOf(lead))).toEqual({});
  });
  test("stats cards: the six KPIs plus No event date and Needs intervention", () => {
    const cards = dhruvaStatCards({ kpis: { total: 4 }, no_event_date: 2, needs_intervention: 3 }, kpiCards);
    expect(cards.map((c) => c.label).slice(-2)).toEqual(["No event date", "Needs intervention"]);
    expect(cards.at(-2).value).toBe("2");
    expect(cards.at(-1)).toMatchObject({ value: "3", tone: "amber" });
    expect(dhruvaStatCards(null, kpiCards).at(-1).value).toBe("—");
  });
});
