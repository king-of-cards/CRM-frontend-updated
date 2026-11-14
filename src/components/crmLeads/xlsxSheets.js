// Sheet names of an .xlsx file, read in the browser without a library.
// An .xlsx is a zip; the sheet names are in xl/workbook.xml (<sheet name="…"/>, in tab order).
// Throws if the file can't be read; the caller then shows a text box instead.

const EOCD = 0x06054b50; // end of central directory
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

function findEntry(bytes, wanted) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // The end record is in the last 22 bytes + up to 64 KB of comment
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
    if (view.getUint32(i, true) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Not a zip file");
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (view.getUint32(p, true) !== CENTRAL) throw new Error("Bad zip directory");
    const method = view.getUint16(p + 10, true);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    if (name === wanted) {
      if (view.getUint32(local, true) !== LOCAL) throw new Error("Bad zip entry");
      const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
      return { method, data: bytes.subarray(start, start + size) };
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`${wanted} not found`);
}

async function inflate(entry) {
  if (entry.method === 0) return entry.data;
  if (entry.method !== 8) throw new Error("Unsupported compression");
  const stream = new Blob([entry.data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function unescapeXml(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
    if (e[0] === "#")
      return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITIES[e] ?? m;
  });
}

// workbook.xml text -> ["Leads", "Instructions", …]
export function parseSheetNames(xml) {
  const names = [];
  for (const m of xml.matchAll(/<(?:\w+:)?sheet\b[^>]*?\bname\s*=\s*("([^"]*)"|'([^']*)')/g))
    names.push(unescapeXml(m[2] ?? m[3]));
  return names;
}

export async function readSheetNames(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const xml = new TextDecoder().decode(await inflate(findEntry(bytes, "xl/workbook.xml")));
  const names = parseSheetNames(xml);
  if (!names.length) throw new Error("No sheets found");
  return names;
}

// The sheet the backend would read by default: "Leads", else the first one
export const defaultSheet = (names) => (names.includes("Leads") ? "Leads" : (names[0] ?? ""));
