import test from "node:test";
import assert from "node:assert/strict";
import { extractSpreadsheetText } from "./spreadsheet-extraction.mjs";

function makeSheet(name, rowCount, columnCount, valueAt = () => "") {
  return {
    name, rowCount, columnCount,
    getRow(rowNumber) {
      return {
        getCell(columnNumber) {
          const value = valueAt(rowNumber, columnNumber);
          return { text: value, value: null };
        },
      };
    },
  };
}

test("extracts worksheet names and cell values from a small workbook", () => {
  const result = extractSpreadsheetText({
    worksheets: [makeSheet("Sales", 2, 2, (r, c) => r === 1 ? (c === 1 ? "Product" : "Revenue") : (c === 1 ? "Tea" : "120"))],
  });
  assert.match(result.text, /SHEET: Sales/);
  assert.match(result.text, /Product \| Revenue/);
  assert.match(result.text, /Tea \| 120/);
  assert.equal(result.truncated, false);
  assert.deepEqual(result.warnings, []);
});

test("reports row and column limits at the beginning of the extracted text", () => {
  const rows = extractSpreadsheetText({ worksheets: [makeSheet("Large", 201, 2)] });
  const columns = extractSpreadsheetText({ worksheets: [makeSheet("Wide", 2, 31)] });
  assert.equal(rows.truncated, true);
  assert.match(rows.text, /first 200 rows of 201|rows 1–200 of 201/);
  assert.equal(columns.truncated, true);
  assert.match(columns.text, /first 30 columns of 31|columns 1–30 of 31/);
  assert.ok(rows.text.indexOf("[") < rows.text.indexOf("SHEET:"));
});

test("reports worksheets omitted beyond the first eight", () => {
  const workbook = { worksheets: Array.from({ length: 9 }, (_, i) => makeSheet(`Sheet${i + 1}`, 1, 1)) };
  const result = extractSpreadsheetText(workbook);
  assert.equal(result.truncated, true);
  assert.match(result.text, /first 8 of 9 worksheets/);
  assert.doesNotMatch(result.text, /SHEET: Sheet9/);
});

test("reports text-budget truncation and keeps the result within its character budget", () => {
  const result = extractSpreadsheetText({
    worksheets: [makeSheet("Long", 20, 3, () => "1234567890")],
  }, 120);
  assert.equal(result.truncated, true);
  assert.match(result.text, /stopped after reaching the text-processing limit/);
  assert.ok(result.text.length <= 120);
  assert.ok(result.extractedCharacters >= result.text.length);
});

test("handles rich text and formula result fallback values", () => {
  const result = extractSpreadsheetText({
    worksheets: [{
      name: "Values", rowCount: 1, columnCount: 2,
      getRow: () => ({
        getCell: (column) => column === 1
          ? { text: "", value: { richText: [{ text: "Hello " }, { text: "world" }] } }
          : { text: "", value: { result: 42 } },
      }),
    }],
  });
  assert.match(result.text, /Hello world \| 42/);
});
