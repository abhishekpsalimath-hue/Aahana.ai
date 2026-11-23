import test from "node:test";
import assert from "node:assert/strict";
import { extractSpreadsheetText } from "./spreadsheet-extraction.mjs";

function makeSheet(name, rowCount, columnCount) {
  return {
    name, rowCount, columnCount,
    getRow(rowNumber) {
      return {
        getCell(columnNumber) {
          return { text: rowNumber === 1 && columnNumber === 1 ? "Header" : `R${rowNumber}C${columnNumber}`, value: null };
        },
      };
    },
  };
}

test("extracts worksheet names and cell values without marking a small workbook truncated", () => {
  const result = extractSpreadsheetText({ worksheets: [makeSheet("Sales", 2, 2)] });
  assert.match(result.text, /SHEET: Sales/);
  assert.match(result.text, /Header \| R1C2/);
  assert.equal(result.truncated, false);
});

test("reports row and column limits instead of implying the workbook is complete", () => {
  const rows = extractSpreadsheetText({ worksheets: [makeSheet("Large", 201, 2)] });
  const columns = extractSpreadsheetText({ worksheets: [makeSheet("Wide", 2, 31)] });
  assert.equal(rows.truncated, true);
  assert.match(rows.text, /first 200 rows of 201/);
  assert.equal(columns.truncated, true);
  assert.match(columns.text, /first 30 columns of 31/);
});

test("reports when worksheets beyond the first eight are omitted", () => {
  const workbook = { worksheets: Array.from({ length: 9 }, (_, index) => makeSheet(`Sheet${index + 1}`, 1, 1)) };
  const result = extractSpreadsheetText(workbook);
  assert.equal(result.truncated, true);
  assert.match(result.text, /first 8 worksheets/);
  assert.doesNotMatch(result.text, /SHEET: Sheet9/);
});

test("reports character truncation and preserves the full extracted character count", () => {
  const result = extractSpreadsheetText({ worksheets: [makeSheet("Long", 10, 4)] }, 40);
  assert.equal(result.truncated, true);
  assert.equal(result.text.length, 40);
  assert.ok(result.extractedCharacters > result.text.length);
});
