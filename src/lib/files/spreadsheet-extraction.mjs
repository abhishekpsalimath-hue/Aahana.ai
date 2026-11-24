const MAX_SHEETS = 8;
const MAX_ROWS_PER_SHEET = 200;
const MAX_COLUMNS_PER_SHEET = 30;

function cellText(cell) {
  if (typeof cell?.text === "string" && cell.text.length) return cell.text;
  const value = cell?.value;
  if (value == null) return "";
  if (typeof value === "object") {
    if (Array.isArray(value.richText)) return value.richText.map((part) => part?.text || "").join("");
    if (value.text != null) return String(value.text);
    if (value.result != null) return String(value.result);
    return "";
  }
  return String(value);
}

export function extractSpreadsheetText(workbook, maxCharacters = 14000) {
  const safeLimit = Number.isInteger(maxCharacters) && maxCharacters > 0 ? maxCharacters : 14000;
  const sheets = Array.isArray(workbook?.worksheets) ? workbook.worksheets : [];
  const contentLines = [];
  const warnings = [];
  let scannedCharacters = 0;
  let characterLimitReached = false;

  if (sheets.length > MAX_SHEETS) {
    warnings.push(`[Only the first ${MAX_SHEETS} of ${sheets.length} worksheets were inspected.]`);
  }

  for (const sheet of sheets.slice(0, MAX_SHEETS)) {
    const sheetName = String(sheet?.name || "Unnamed worksheet").replace(/[\r\n]+/g, " ").slice(0, 120);
    contentLines.push(`SHEET: ${sheetName}`);
    scannedCharacters += sheetName.length + 7;

    const totalRows = Math.max(0, Number(sheet?.rowCount) || 0);
    const totalColumns = Math.max(0, Number(sheet?.columnCount) || 0);
    const rowLimit = Math.min(totalRows, MAX_ROWS_PER_SHEET);
    const columnLimit = Math.min(totalColumns, MAX_COLUMNS_PER_SHEET);

    if (totalRows > MAX_ROWS_PER_SHEET) {
      warnings.push(`[Worksheet "${sheetName}" inspected only rows 1–${MAX_ROWS_PER_SHEET} of ${totalRows}.]`);
    }
    if (totalColumns > MAX_COLUMNS_PER_SHEET) {
      warnings.push(`[Worksheet "${sheetName}" inspected only columns 1–${MAX_COLUMNS_PER_SHEET} of ${totalColumns}.]`);
    }

    for (let rowNumber = 1; rowNumber <= rowLimit; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      const values = [];
      for (let columnNumber = 1; columnNumber <= columnLimit; columnNumber++) {
        values.push(cellText(row.getCell(columnNumber)).replace(/[\t\r\n]+/g, " ").trim());
      }
      if (!values.some(Boolean)) continue;
      const line = values.join(" | ");
      contentLines.push(line);
      scannedCharacters += line.length + 1;
      if (scannedCharacters > safeLimit) {
        characterLimitReached = true;
        break;
      }
    }
    if (characterLimitReached) break;
  }

  if (characterLimitReached) {
    warnings.push("[Extraction stopped after reaching the text-processing limit. The workbook may contain additional content that was not inspected.]");
  }

  const content = contentLines.join("\n");
  const warningText = warnings.join("\n");
  const prefix = warningText ? warningText + "\n\n" : "";
  const available = Math.max(0, safeLimit - prefix.length);
  const text = (prefix.slice(0, safeLimit) + content.slice(0, available)).slice(0, safeLimit);

  return {
    text,
    truncated: warnings.length > 0 || content.length + prefix.length > safeLimit,
    extractedCharacters: content.length + prefix.length,
    warnings,
  };
}
