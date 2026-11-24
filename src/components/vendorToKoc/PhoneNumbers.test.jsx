import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { PhoneList, PhoneRows } from "./PhoneNumbers.jsx";
import {
  dhruvaChanges, dhruvaFormErrors, dhruvaFormOf, dhruvaNewLead, phoneE164, phoneEntriesOf, phoneRowErrors, phonesForApi,
  phoneText, splitPhones,
} from "../../pages/dhruvaUtils.js";

// Dhruva → KOC phone numbers (docs section 13): shown short, tel: links and copy, "+N more", number rows

const FOUR = { phones: ["9845012345", "9845012346", "9845012347", "9845012348"], phones_e164: ["+919845012345", "+919845012346", "+919845012347", "+919845012348"] };

describe("formatting", () => {
  test("Indian numbers as 10 digits, +91 / 91 / 0 / spaces dropped; other countries in full", () => {
    expect(phoneText("+919845012345")).toBe("9845012345");
    expect(phoneText("+91 98450-12345")).toBe("9845012345");
    expect(phoneText("919845012345")).toBe("9845012345");
    expect(phoneText("09845012345")).toBe("9845012345");
    expect(phoneText("9845012345")).toBe("9845012345");
    expect(phoneText("+447911123456")).toBe("+447911123456");
    expect(phoneText("+1 415 555 0100")).toBe("+1 415 555 0100");
    expect(phoneText("")).toBe("—");
    expect(phoneText(null)).toBe("—");
  });
  test("E.164 kept for calls and the API", () => {
    expect(phoneE164("9845012345")).toBe("+919845012345");
    expect(phoneE164("+91 98450 12345")).toBe("+919845012345");
    expect(phoneE164("+44 7911 123456")).toBe("+447911123456");
    expect(phoneE164("98450")).toBe("");
    expect(phonesForApi(["9845012345", " ", "+919845012345", "9845012346"])).toEqual(["+919845012345", "+919845012346"]);
  });
  test("a lead's entries: phones_e164 first (order kept), else phones", () => {
    expect(phoneEntriesOf(FOUR).slice(0, 2)).toEqual([{ text: "9845012345", e164: "+919845012345" }, { text: "9845012346", e164: "+919845012346" }]);
    expect(phoneEntriesOf({ phones: ["9845012345"] })).toEqual([{ text: "9845012345", e164: "+919845012345" }]);
    expect(phoneEntriesOf({ phones_e164: ["+447911123456"] })).toEqual([{ text: "+447911123456", e164: "+447911123456" }]);
    expect(phoneEntriesOf({})).toEqual([]);
  });
  test("per number: the 10 digits, a copy button, Call (tel: E.164) and WhatsApp", () => {
    const html = renderToString(<PhoneList entries={phoneEntriesOf(FOUR)} />);
    expect(html).toContain('href="tel:+919845012345"');
    expect(html).toContain(">9845012345</span>");
    expect(html.match(/href="https:\/\/wa\.me\/91\d{10}"/g)).toHaveLength(4);
    expect(html).not.toContain(">+919845012345<");
    expect(html.match(/aria-label="Copy /g)).toHaveLength(4); // the panel shows all
  });
});

describe('"+N more" toggle', () => {
  test("first 2 shown, the rest counted; expanded shows all", () => {
    const all = phoneEntriesOf(FOUR);
    expect(splitPhones(all, 2)).toEqual({ shown: all.slice(0, 2), hidden: 2 });
    expect(splitPhones(all, 2, true)).toEqual({ shown: all, hidden: 0 });
    expect(splitPhones(all.slice(0, 2), 2)).toEqual({ shown: all.slice(0, 2), hidden: 0 });
  });
  test("collapsed row: 2 numbers and a +2 more button; expanded: all and Show less", () => {
    const closed = renderToString(<PhoneList entries={phoneEntriesOf(FOUR)} limit={2} />);
    expect(closed.match(/href="tel:/g)).toHaveLength(2);
    expect(closed).toContain(">+2 more</button>");
    expect(closed).toContain('aria-expanded="false"');
    const open = renderToString(<PhoneList entries={phoneEntriesOf(FOUR)} limit={2} defaultExpanded />);
    expect(open.match(/href="tel:/g)).toHaveLength(4);
    expect(open).toContain("Show less");
    expect(open).toContain('aria-expanded="true"');
  });
  test("2 numbers or fewer: no toggle; none: a dash", () => {
    expect(renderToString(<PhoneList entries={phoneEntriesOf({ phones: ["9845012345", "9845012346"] })} limit={2} />)).not.toContain("more");
    expect(renderToString(<PhoneList entries={[]} limit={2} />)).toContain("—");
  });
});

describe("form: several numbers per lead", () => {
  test("one input per row, the first marked Main, add and remove buttons", () => {
    const html = renderToString(<PhoneRows value={["9845012345", "98450"]} onChange={() => {}} showErrors />);
    expect(html.match(/<input/g)).toHaveLength(2);
    expect(html).toContain('aria-label="Phone numbers: main number"');
    expect(html).toContain('aria-label="Phone numbers: number 2"');
    expect(html).toContain(">Main<");
    expect(html).toContain('aria-label="Remove number 2"');
    expect(html).toContain("Add number");
    expect(html).toContain("Use 10 digits (+91 optional)"); // only the bad row
    expect(html.match(/Use 10 digits/g)).toHaveLength(1);
  });
  test("an empty form shows one empty row; errors wait until showErrors", () => {
    const html = renderToString(<PhoneRows value={[]} onChange={() => {}} />);
    expect(html.match(/<input/g)).toHaveLength(1);
    expect(renderToString(<PhoneRows value={["98450"]} onChange={() => {}} />)).not.toContain("Use 10 digits");
  });
  test("the upload preview's text becomes rows", () => {
    expect(renderToString(<PhoneRows value="9845012345, 9845012346" onChange={() => {}} compact />).match(/<input/g)).toHaveLength(2);
  });
  test("each row is validated: bad, repeated (with or without +91), blank skipped", () => {
    expect(phoneRowErrors(["9845012345", "", "+91 98450 12345", "12345", "+447911123456"])).toEqual([
      "", "", "This number is already in the list", "Use 10 digits (+91 optional)", "Use 10 digits (+91 optional)",
    ]);
    expect(dhruvaFormErrors({ name: "A", phones: ["9845012345", "12"] }).phones).toBe("Each phone number must have 10 digits");
    expect(dhruvaFormErrors({ name: "A", phones: ["9845012345", ""] })).toEqual({});
  });
  test("saved as E.164, first = main; editing shows 10 digits; unchanged numbers aren't sent", () => {
    expect(dhruvaNewLead({ ...dhruvaFormOf(null), name: "Ravi", phones: ["+91 98000 00002", "9000000002", ""] }).phones).toEqual(["+919800000002", "+919000000002"]);
    const lead = { id: 1, name: "Asha", ...FOUR };
    expect(dhruvaFormOf(lead).phones).toEqual(["9845012345", "9845012346", "9845012347", "9845012348"]);
    expect(dhruvaChanges(lead, dhruvaFormOf(lead))).toEqual({});
    const reordered = { ...dhruvaFormOf(lead), phones: ["9845012346", "9845012345"] };
    expect(dhruvaChanges(lead, reordered)).toEqual({ phones: ["+919845012346", "+919845012345"] });
  });
});
