// Copy text to the clipboard. navigator.clipboard needs a secure context (https or localhost);
// on plain http (e.g. the app opened on a phone over the LAN) it is missing or refuses, so a hidden
// textarea and document.execCommand("copy") do it instead. Resolves true when copied.
// nav / doc can be passed in (tests).
export async function copyText(text, { nav = globalThis.navigator, doc = globalThis.document } = {}) {
  const value = String(text ?? "");
  if (!value) return false;
  if (nav?.clipboard?.writeText) {
    try {
      await nav.clipboard.writeText(value);
      return true;
    } catch {
      // not allowed here: try the fallback
    }
  }
  return copyWithTextarea(value, doc);
}

export function copyWithTextarea(value, doc = globalThis.document) {
  if (!doc?.body || typeof doc.execCommand !== "function") return false;
  const area = doc.createElement("textarea");
  area.value = value;
  area.setAttribute("readonly", "");
  area.setAttribute("aria-hidden", "true");
  Object.assign(area.style, { position: "fixed", top: "0", left: "0", width: "1px", height: "1px", opacity: "0", pointerEvents: "none" });
  doc.body.appendChild(area);
  try {
    area.focus?.();
    area.select?.();
    area.setSelectionRange?.(0, value.length); // iOS Safari selects only with a range
    return Boolean(doc.execCommand("copy"));
  } catch {
    return false;
  } finally {
    doc.body.removeChild(area);
  }
}
