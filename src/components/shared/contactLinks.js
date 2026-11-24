// The buttons ContactActions draws for a number and an email (pure: data and icons, no state).
import { Mail, MessageCircle, Phone } from "lucide-react";
import { copyPhoneText, displayPhone, mailHref, telHref, waHref } from "./contact.js";
import { copyText } from "./clipboard.js";

// The buttons for one number (and maybe the email), in display order: links, then the copy buttons
export function contactLinks({ phone, email, name, withMail = true, withCopy = true }) {
  const who = name ? ` ${name}` : "";
  const shown = displayPhone(phone);
  const links = [];
  const tel = telHref(phone);
  if (tel) links.push({ kind: "call", href: tel, label: `Call${who}${shown ? ` on ${shown}` : ""}`, text: "Call", Icon: Phone });
  const mail = withMail ? mailHref(email) : null;
  if (mail) links.push({ kind: "mail", href: mail, label: `Email${who}`, title: `Email ${String(email).trim()}`, text: "Email", Icon: Mail });
  const wa = waHref(phone);
  if (wa) links.push({ kind: "wa", href: wa, label: `WhatsApp${who}${shown ? ` on ${shown}` : ""}`, text: "WhatsApp", Icon: MessageCircle, external: true });
  const number = withCopy ? copyPhoneText(phone) : "";
  if (number) links.push({ kind: "copyPhone", copy: number, label: "Copy phone number", text: "Copy number" });
  if (mail && withCopy) links.push({ kind: "copyMail", copy: String(email).trim(), label: "Copy email", text: "Copy email" });
  return links;
}

// A copy click: never reaches the row or panel around it; then copies and reports whether it worked
export function copyClick(event, value, copy = copyText) {
  event?.stopPropagation?.();
  event?.preventDefault?.();
  return copy(value);
}
