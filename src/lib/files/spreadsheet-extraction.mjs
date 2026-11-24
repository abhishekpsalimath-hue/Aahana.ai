const MAX_SHEETS = 8;
const MAX_ROWS_PER_SHEET = 200;
const MAX_COLUMNS_PER_SHEET = 30;

export function extractSpreadsheetText(workbook, maxCharacters = 6500) {
  const sheets = Array.isArray(workbook?.worksheets) ? workbook.worksheets : [];
  const sections = [];
  const limitations = [];

  if (sheets.length > MAX_SHEETS) {
    limitations.push("[Only the first 8 worksheets were extracted.]");
  }

  for (const sheet of sheets.slice(0, MAX_SHEETS)) {
    sections.push(`SHEET: ${sheet.name}`);
    const totalRows = Number(sheet.rowCount) || 0;
    const totalColumns = Number(sheet.columnCount) || 0;
    const rowLimit = Math.min(totalRows, MAX_ROWS_PER_SHEET);
    const columnLimit = Math.min(totalColumns, MAX_COLUMNS_PER_SHEET);

    if (totalRows > MAX_ROWS_PER_SHEET) {
      limitations.push(`[Worksheet "${sheet.name}" was limited to the first 200 rows of ${totalRows}.]`);
    }
    if (totalColumns > MAX_COLUMNS_PER_SHEET) {
      limitations.push(`[Worksheet "${sheet.name}" was limited to the first 30 columns of ${totalColumns}.]`);
    }

    for (let rowNumber = 1; rowNumber <= rowLimit; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      const values = [];
      for (let columnNumber = 1; columnNumber <= columnLimit; columnNumber++) {
        const cell = row.getCell(columnNumber);
        const value = cell.text || (cell.value == null ? "" : String(cell.value));
        values.push(value.replace(/[\t\r\n]+/g, " ").trim());
      }
      if (values.some(Boolean)) sections.push(values.join(" | "));
      if (sections.join("\n").length > maxCharacters * 2) {
        limitations.push("[Extraction stopped early because the workbook text exceeded the processing limit.]");
        break;
      }
    }
    if (sections.join("\n").length > maxCharacters * 2) break;
  }

  const fullText = [...limitations, ...sections].join("\n").trim();
  return {
    text: fullText.slice(0, maxCharacters),
    truncated: limitations.length > 0 || fullText.length > maxCharacters,
    extractedCharacters: fullText.length,
  };
}
