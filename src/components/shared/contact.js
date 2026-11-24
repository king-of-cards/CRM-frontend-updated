// Phone and email links for every lead (pure, no React). Indian numbers show as 10 digits; the
// E.164 value (+919845012345) is what calls, WhatsApp and API calls use.

// An Indian number (10 digits; +91, 91 or 0 in front, spaces, dashes, dots and brackets ignored)
// → its 10 digits; null for anything else (another country's number, too short, empty)
export function indianDigits(value) {
  const s = String(value ?? "").trim().replace(/[\s().-]/g, "");
  const m = s.match(/^(?:\+91|91|0)?(\d{10})$/);
  return m && (!s.startsWith("+") || s.startsWith("+91")) ? m[1] : null;
}

// E.164: +91XXXXXXXXXX for Indian numbers, +<digits> for others (with + or 11–15 digits); "" if not a phone
export function phoneE164(value) {
  const india = indianDigits(value);
  if (india) return `+91${india}`;
  const s = String(value ?? "").trim();
  const digits = s.replace(/\D/g, "");
  if (/^\+[\d\s().-]+$/.test(s) && digits.length >= 7 && digits.length <= 15) return `+${digits}`;
  if (/^[\d\s().-]+$/.test(s) && digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return "";
}

// As shown: Indian numbers as 10 digits (+91 dropped); others as given, with + added to bare
// country-code digits (447911123456 → +447911123456); "" when empty
export function displayPhone(value) {
  const s = String(value ?? "").trim();
  if (!s) return "";
  const india = indianDigits(s);
  if (india) return india;
  return /^\d+$/.test(s) && phoneE164(s) ? `+${s}` : s;
}

// What Copy puts on the clipboard: Indian numbers as 10 digits (no +91, no spaces), others as
// E.164 (+447911123456); "" when it isn't a phone
export function copyPhoneText(value) {
  return indianDigits(value) ?? phoneE164(value);
}

// tel: link to the E.164 value, or null
export function telHref(value) {
  const e164 = phoneE164(value);
  return e164 ? `tel:${e164}` : null;
}

// WhatsApp: wa.me/91<10 digits> for Indian numbers, wa.me/<country code and number> for others, or null
export function waHref(value) {
  const india = indianDigits(value);
  if (india) return `https://wa.me/91${india}`;
  const e164 = phoneE164(value);
  return e164 ? `https://wa.me/${e164.slice(1)}` : null;
}

// mailto: link, or null when there is no email
export function mailHref(email) {
  const s = String(email ?? "").trim();
  return /^[^\s@]+@[^\s@]+$/.test(s) ? `mailto:${s}` : null;
}
