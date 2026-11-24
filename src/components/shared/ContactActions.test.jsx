import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import ContactActions from "./ContactActions.jsx";
import { contactLinks, copyClick } from "./contactLinks.js";
import { copyText, copyWithTextarea } from "./clipboard.js";
import { copyPhoneText, displayPhone, indianDigits, mailHref, phoneE164, telHref, waHref } from "./contact.js";

// One quick-contact component for every lead: Call (tel:), Email (mailto:), WhatsApp (wa.me)

describe("phone formatting", () => {
  test("Indian numbers show as 10 digits, whatever the input", () => {
    for (const v of ["9845012345", "+919845012345", "+91 98450 12345", "919845012345", "09845012345", "98450-12345"]) {
      expect(displayPhone(v)).toBe("9845012345");
      expect(indianDigits(v)).toBe("9845012345");
    }
  });
  test("other countries keep their full number (bare country-code digits get a +)", () => {
    expect(displayPhone("+447911123456")).toBe("+447911123456");
    expect(displayPhone("447911123456")).toBe("+447911123456");
    expect(displayPhone("+1 415 555 0100")).toBe("+1 415 555 0100");
    expect(displayPhone("")).toBe("");
    expect(displayPhone(null)).toBe("");
  });
  test("E.164 for calls and the API", () => {
    expect(phoneE164("98450 12345")).toBe("+919845012345");
    expect(phoneE164("+44 7911 123456")).toBe("+447911123456");
    expect(phoneE164("447911123456")).toBe("+447911123456");
    expect(phoneE164("12345")).toBe("");
    expect(phoneE164("abc")).toBe("");
  });
  test("tel: is the E.164 value", () => {
    expect(telHref("9845012345")).toBe("tel:+919845012345");
    expect(telHref("+91 98450 12345")).toBe("tel:+919845012345");
    expect(telHref("+447911123456")).toBe("tel:+447911123456");
    expect(telHref("")).toBeNull();
    expect(telHref("123")).toBeNull();
  });
  test("wa.me/91<10 digits> for Indian numbers; country code and number for others", () => {
    expect(waHref("9845012345")).toBe("https://wa.me/919845012345");
    expect(waHref("+919845012345")).toBe("https://wa.me/919845012345");
    expect(waHref("09845012345")).toBe("https://wa.me/919845012345");
    expect(waHref("+44 7911 123456")).toBe("https://wa.me/447911123456");
    expect(waHref(null)).toBeNull();
  });
  test("mailto: only for an email", () => {
    expect(mailHref(" asha@example.in ")).toBe("mailto:asha@example.in");
    expect(mailHref("")).toBeNull();
    expect(mailHref("not an email")).toBeNull();
  });
});

describe("ContactActions", () => {
  test("phone and email: the 10 digits, then Call, Email and WhatsApp", () => {
    const html = renderToString(<ContactActions phone="+919845012345" email="asha@example.in" name="Asha" />);
    expect(html).toContain(">9845012345</span>");
    expect(html).not.toContain(">+919845012345<");
    expect(html).toContain('href="tel:+919845012345"');
    expect(html).toContain('href="mailto:asha@example.in"');
    expect(html).toContain('href="https://wa.me/919845012345"');
    expect(html).toContain('aria-label="Call Asha on 9845012345"');
    expect(html).toContain('target="_blank"');
    expect(contactLinks({ phone: "9845012345", email: "a@b.in" }).map((l) => l.kind)).toEqual(["call", "mail", "wa", "copyPhone", "copyMail"]);
  });
  test("a button whose data is missing is left out", () => {
    const noEmail = renderToString(<ContactActions phone="9845012345" name="Asha" />);
    expect(noEmail).not.toContain("mailto:");
    expect(noEmail.match(/<a /g)).toHaveLength(2);
    const emailOnly = renderToString(<ContactActions email="asha@example.in" name="Asha" />);
    expect(emailOnly).not.toContain("tel:");
    expect(emailOnly).not.toContain("wa.me");
    expect(emailOnly).toContain("No number");
    expect(renderToString(<ContactActions phone="" showNumber={false} />)).toBe("");
    expect(renderToString(<ContactActions variant="panel" />)).toBe("");
  });
  test("several numbers: one Call and one WhatsApp per number, Email once", () => {
    const html = renderToString(<ContactActions phones={["+919845012345", "9845012346"]} email="a@b.in" name="Asha" />);
    expect(html.match(/href="tel:/g)).toHaveLength(2);
    expect(html.match(/href="https:\/\/wa\.me\//g)).toHaveLength(2);
    expect(html.match(/mailto:/g)).toHaveLength(1);
    const panel = renderToString(<ContactActions variant="panel" phones={["9845012345", "9845012346"]} name="Asha" />);
    expect(panel).toContain("Call 9845012346");
    expect(panel).toContain("WhatsApp 9845012345");
  });
  test("44 px tap targets on phones; the existing smaller size from sm up", () => {
    const row = renderToString(<ContactActions phone="9845012345" />);
    expect(row).toContain("h-11 w-11");
    expect(row).toContain("sm:h-8 sm:w-8");
    expect(renderToString(<ContactActions variant="panel" phone="9845012345" />)).toContain("min-h-11");
  });
  test("clicks and Enter stay inside: the row or panel around it doesn't open", () => {
    const el = ContactActions({ phone: "9845012345", name: "Asha" }); // no hooks: callable directly
    const event = () => ({ stopped: false, key: "Enter", stopPropagation() { this.stopped = true; } });
    const click = event();
    el.props.onClick(click);
    expect(click.stopped).toBe(true);
    const enter = event();
    el.props.onKeyDown(enter);
    expect(enter.stopped).toBe(true);
  });
});

describe("Copy", () => {
  // A stand-in document: records the textarea, whether it was selected and removed, and execCommand
  function fakeDoc({ result = true, throws = false } = {}) {
    const log = { added: null, removed: false, selected: false, command: null };
    const doc = {
      body: {
        appendChild(el) { log.added = el; },
        removeChild(el) { log.removed = el === log.added; },
      },
      createElement: () => ({
        style: {}, attrs: {},
        setAttribute(k, v) { this.attrs[k] = v; },
        focus() {}, select() { log.selected = true; }, setSelectionRange() {},
      }),
      execCommand(cmd) { log.command = cmd; if (throws) throw new Error("no"); return result; },
    };
    return { doc, log };
  }

  test("the number copied is the 10 digits (no +91, no spaces); other countries as E.164", () => {
    expect(copyPhoneText("+91 98450 12345")).toBe("9845012345");
    expect(copyPhoneText("919845012345")).toBe("9845012345");
    expect(copyPhoneText("+44 7911 123456")).toBe("+447911123456");
    expect(copyPhoneText("")).toBe("");
    const links = contactLinks({ phone: "+91 98450 12345", email: " asha@example.in " });
    expect(links.find((l) => l.kind === "copyPhone")).toMatchObject({ copy: "9845012345", label: "Copy phone number" });
    expect(links.find((l) => l.kind === "copyMail")).toMatchObject({ copy: "asha@example.in", label: "Copy email" });
  });
  test("navigator.clipboard.writeText when it is there", async () => {
    const written = [];
    const { doc, log } = fakeDoc();
    const ok = await copyText("9845012345", { nav: { clipboard: { writeText: async (t) => { written.push(t); } } }, doc });
    expect(ok).toBe(true);
    expect(written).toEqual(["9845012345"]);
    expect(log.command).toBeNull(); // no fallback needed
  });
  test("fallback on plain http (no clipboard API): a hidden textarea and execCommand('copy'), then removed", async () => {
    const { doc, log } = fakeDoc();
    expect(await copyText("9845012345", { nav: {}, doc })).toBe(true);
    expect(log.added.value).toBe("9845012345");
    expect(log.added.attrs.readonly).toBe("");
    expect(log.added.style.opacity).toBe("0");
    expect(log.selected).toBe(true);
    expect(log.command).toBe("copy");
    expect(log.removed).toBe(true);
  });
  test("fallback when writeText refuses; false when nothing can copy", async () => {
    const { doc, log } = fakeDoc();
    const nav = { clipboard: { writeText: async () => { throw new Error("NotAllowedError"); } } };
    expect(await copyText("a@b.in", { nav, doc })).toBe(true);
    expect(log.added.value).toBe("a@b.in");
    expect(await copyText("9845012345", { nav: {}, doc: fakeDoc({ result: false }).doc })).toBe(false);
    const throwing = fakeDoc({ throws: true });
    expect(copyWithTextarea("9845012345", throwing.doc)).toBe(false);
    expect(throwing.log.removed).toBe(true); // cleaned up even when it fails
    expect(await copyText("9845012345", { nav: {}, doc: undefined })).toBe(false);
    expect(await copyText("", { nav: {}, doc })).toBe(false);
  });
  test("a copy click never reaches the row or panel, and copies the value", async () => {
    const calls = [];
    const event = { stopped: false, prevented: false, stopPropagation() { this.stopped = true; }, preventDefault() { this.prevented = true; } };
    expect(await copyClick(event, "9845012345", async (v) => { calls.push(v); return true; })).toBe(true);
    expect(event.stopped).toBe(true);
    expect(event.prevented).toBe(true);
    expect(calls).toEqual(["9845012345"]);
    // and the wrapper stops anything that still bubbles (see "clicks and Enter stay inside")
  });
  test("buttons: Copy phone number per number, Copy email once; 44 px on phones; a status for 'Copied'", () => {
    const html = renderToString(<ContactActions phones={["9845012345", "+919845012346"]} email="asha@example.in" name="Asha" />);
    expect(html.match(/aria-label="Copy phone number"/g)).toHaveLength(2);
    expect(html.match(/aria-label="Copy email"/g)).toHaveLength(1);
    expect(html).toContain('title="Copy phone number: 9845012346"');
    expect(html).toMatch(/<button type="button" aria-label="Copy phone number"[^>]*class="flex h-11 w-11[^"]*sm:h-8 sm:w-8/);
    expect(html).toContain('role="status"');
    expect(renderToString(<ContactActions phone="9845012345" />)).not.toContain("Copy email");
    expect(renderToString(<ContactActions variant="panel" phone="9845012345" />)).toContain("Copy number");
  });
});
