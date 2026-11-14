import { describe, expect, test } from "bun:test";
import { defaultSheet, parseSheetNames, readSheetNames } from "./xlsxSheets.js";

// A minimal zip with one entry (method 0 = stored, 8 = deflated), enough for readSheetNames
async function zipWith(name, text, method) {
  const enc = new TextEncoder();
  const nameBytes = enc.encode(name);
  const raw = enc.encode(text);
  const data =
    method === 8
      ? new Uint8Array(
          await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer(),
        )
      : raw;
  const local = new Uint8Array(30 + nameBytes.length);
  let v = new DataView(local.buffer);
  v.setUint32(0, 0x04034b50, true);
  v.setUint16(8, method, true);
  v.setUint32(18, data.length, true);
  v.setUint32(22, raw.length, true);
  v.setUint16(26, nameBytes.length, true);
  local.set(nameBytes, 30);
  const central = new Uint8Array(46 + nameBytes.length);
  v = new DataView(central.buffer);
  v.setUint32(0, 0x02014b50, true);
  v.setUint16(10, method, true);
  v.setUint32(20, data.length, true);
  v.setUint32(24, raw.length, true);
  v.setUint16(28, nameBytes.length, true);
  v.setUint32(42, 0, true);
  central.set(nameBytes, 46);
  const eocd = new Uint8Array(22);
  v = new DataView(eocd.buffer);
  v.setUint32(0, 0x06054b50, true);
  v.setUint16(8, 1, true);
  v.setUint16(10, 1, true);
  v.setUint32(12, central.length, true);
  v.setUint32(16, local.length + data.length, true);
  return new File([local, data, central, eocd], "book.xlsx");
}

const WORKBOOK =
  '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets>' +
  '<sheet name="Instructions" sheetId="2" r:id="rId2"/><sheet name="Leads" sheetId="1" r:id="rId1"/>' +
  '<sheet name="March &amp; April" sheetId="3" r:id="rId3"/></sheets></workbook>';

describe("xlsx sheet names", () => {
  test("parseSheetNames unescapes and keeps tab order", () => {
    expect(parseSheetNames(WORKBOOK)).toEqual(["Instructions", "Leads", "March & April"]);
    expect(parseSheetNames('<x:sheets><x:sheet name="A"/></x:sheets>')).toEqual(["A"]);
  });

  test("reads a stored and a deflated workbook.xml", async () => {
    expect(await readSheetNames(await zipWith("xl/workbook.xml", WORKBOOK, 0))).toEqual(["Instructions", "Leads", "March & April"]);
    expect(await readSheetNames(await zipWith("xl/workbook.xml", WORKBOOK, 8))).toEqual(["Instructions", "Leads", "March & April"]);
  });

  test("fails on files that aren't xlsx (caller shows a text box)", async () => {
    await expect(readSheetNames(new File(["phone,name\n1,2"], "x.xlsx"))).rejects.toThrow();
    await expect(readSheetNames(await zipWith("other.xml", WORKBOOK, 0))).rejects.toThrow();
  });

  test("default is Leads, else the first sheet", () => {
    expect(defaultSheet(["Instructions", "Leads"])).toBe("Leads");
    expect(defaultSheet(["March", "April"])).toBe("March");
  });
});
