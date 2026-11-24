import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router";
import KocToDhruvaLeadList from "./KocToDhruvaLeadList.jsx";
import ContactActions from "../shared/ContactActions.jsx";
import { entryPhones } from "../../pages/kocToDhruvaUtils.js";

// KOC → Dhruva dashboard lists (upcoming, stale, latest; docs section 18 "Contact details"):
// Call, WhatsApp and Copy for each number, Email and Copy email once, beside the lead's link.

const render = (leads) =>
  renderToString(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <KocToDhruvaLeadList leads={leads} detail={(l) => l.occasion ?? ""} right={(l) => l.right ?? "—"} none="No leads." />
    </MemoryRouter>,
  );
const count = (html, re) => (html.match(re) ?? []).length;

const TWO = { lead_key: "k1", name: "Asha", phone: "+91 98450 12345", phones: ["+91 98450 12345", "9845012346"], email: "asha@example.in", occasion: "Wedding", right: "4 Dec 2026" };
const ONE = { lead_key: "k2", name: "Ravi", phone: "9845012347", phones: ["9845012347"], email: null };
const MAIL = { lead_key: "k3", name: "Meera", phone: null, phones: [], email: "meera@example.in" };
const NONE = { lead_key: "k4", name: "Nobody", phone: null, phones: [], email: null };

describe("entry numbers", () => {
  test("phones in order (repeats and blanks dropped), else the one phone, else none", () => {
    expect(entryPhones(TWO)).toEqual(["+91 98450 12345", "9845012346"]);
    expect(entryPhones({ phones: ["9845012345", " ", "9845012345"] })).toEqual(["9845012345"]);
    expect(entryPhones({ phone: "9845012345" })).toEqual(["9845012345"]); // an older answer without phones
    expect(entryPhones({ phone: "9845012345", phones: [] })).toEqual(["9845012345"]);
    expect(entryPhones(NONE)).toEqual([]);
  });
});

describe("dashboard lead lists: contact buttons", () => {
  test("several numbers: Call, WhatsApp and Copy for each; Email and Copy email once", () => {
    const html = render([TWO]);
    expect(html).toContain('href="tel:+919845012345"');
    expect(html).toContain('href="tel:+919845012346"');
    expect(html).toContain('href="https://wa.me/919845012345"');
    expect(html).toContain('href="https://wa.me/919845012346"');
    expect(count(html, /aria-label="Copy phone number"/g)).toBe(2);
    expect(count(html, /href="mailto:asha@example.in"/g)).toBe(1);
    expect(count(html, /aria-label="Copy email"/g)).toBe(1);
    expect(html).toContain(">9845012345</span>"); // shown as 10 digits
    expect(html).toContain(">9845012346</span>");
  });
  test("missing data hides its buttons: no email → no mail; email only → mail and copy, no number; nothing → no buttons", () => {
    const one = render([ONE]);
    expect(one).not.toContain("mailto:");
    expect(count(one, /href="tel:/g)).toBe(1);
    const mail = render([MAIL]);
    expect(mail).toContain('href="mailto:meera@example.in"');
    expect(mail).not.toContain("tel:");
    expect(mail).not.toContain("wa.me");
    expect(mail).not.toContain("No number");
    const none = render([NONE]);
    expect(none).not.toContain("<a href=\"tel");
    expect(none).not.toContain("mailto:");
    expect(none).not.toContain("Copy");
    expect(none).toContain("Nobody"); // the lead itself still shows
  });
  test("the buttons sit beside the lead's link, never inside it, and stop their clicks", () => {
    const html = render([TWO]);
    const link = html.match(/<a [^>]*>Asha<\/a>/)?.[0] ?? ""; // the link holds only the name
    expect(link).toMatch(/href="\/koc-to-dhruva\?/);
    expect(link).not.toContain("tel:");
    const el = ContactActions({ phones: TWO.phones, email: TWO.email, name: TWO.name });
    const click = { stopped: false, stopPropagation() { this.stopped = true; } };
    el.props.onClick(click);
    expect(click.stopped).toBe(true);
  });
  test("phones: 44 px buttons that wrap (no sideways scroll)", () => {
    const html = render([TWO]);
    expect(html).toContain("flex h-11 w-11");
    expect(html).toContain("sm:h-8 sm:w-8");
    expect(html).toContain("flex flex-wrap items-center gap-x-2 gap-y-1");
    expect(html).toContain('class="flex flex-wrap items-center gap-1"');
    expect(html).toContain('class="min-w-0 py-2.5"');
  });
  test("an empty list says so", () => {
    expect(render([])).toContain("No leads.");
  });
});
