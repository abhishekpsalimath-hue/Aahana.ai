import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import ExcelJS from "exceljs";
import { extractSpreadsheetText } from "@/lib/files/spreadsheet-extraction.mjs";
import { limitDocumentText } from "@/lib/files/document-text-limits.mjs";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_EXTRACTED_CHARACTERS = 14000;
const TEXT_TYPES = new Set(["text/plain", "text/markdown", "text/csv"]);
const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(_request, { params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const { data: file, error } = await supabase.from("user_files")
    .select("id, bucket_id, object_path, original_filename, mime_type, size_bytes")
    .eq("id", id).eq("user_id", user.id).maybeSingle();
  if (error || !file) return NextResponse.json({ error: "File not found." }, { status: 404 });
  if (!Number.isInteger(file.size_bytes) || file.size_bytes < 1 || file.size_bytes > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "This file exceeds the analysis size limit." }, { status: 413 });
  }

  const supported = TEXT_TYPES.has(file.mime_type) ||
    file.mime_type === "application/pdf" ||
    file.mime_type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.mime_type === XLSX_TYPE || IMAGE_TYPES.has(file.mime_type);
  if (IMAGE_TYPES.has(file.mime_type) && file.size_bytes > 2 * 1024 * 1024) {
    return NextResponse.json({ error: "Saved image analysis supports images up to 2 MB. Open the file and attach a smaller image in the chat." }, { status: 413 });
  }
  if (!supported) {
    return NextResponse.json({ error: "Analysis currently supports PDF, DOCX, XLSX, TXT, Markdown and CSV files. Image analysis for stored files is not enabled yet." }, { status: 415 });
  }

  const { data: blob, error: downloadError } = await supabase.storage.from(file.bucket_id).download(file.object_path);
  if (downloadError || !blob) {
    console.error("Aahana file download for analysis failed:", downloadError?.message);
    return NextResponse.json({ error: "Could not read the stored file." }, { status: 500 });
  }
  if (blob.size > MAX_FILE_BYTES) return NextResponse.json({ error: "This file exceeds the analysis size limit." }, { status: 413 });

  try {
    const buffer = Buffer.from(await blob.arrayBuffer());
    if (IMAGE_TYPES.has(file.mime_type)) {
      return NextResponse.json({
        filename: file.original_filename,
        mimeType: file.mime_type,
        imageDataUrl: "data:" + file.mime_type + ";base64," + buffer.toString("base64"),
      });
    }
    let extracted = "";
    let extractionTruncated = false;
    let extractedCharacters = null;
    if (file.mime_type === "application/pdf") {
      const parsed = await pdfParse(buffer);
      extracted = parsed.text || "";
    } else if (file.mime_type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const parsed = await mammoth.extractRawText({ buffer });
      extracted = parsed.value || "";
    } else if (file.mime_type === XLSX_TYPE) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const result = extractSpreadsheetText(workbook, MAX_EXTRACTED_CHARACTERS);
      extracted = result.text;
      extractionTruncated = result.truncated;
      extractedCharacters = result.extractedCharacters;
    } else {
      extracted = buffer.toString("utf8");
    }

    extracted = extracted.replace(/\u0000/g, "").trim();
    if (!extracted) {
      return NextResponse.json({ error: "No readable text was found. This may be a scanned PDF; OCR is not enabled for stored documents yet." }, { status: 422 });
    }

    const limited = extractionTruncated
      ? { text: extracted.slice(0, MAX_EXTRACTED_CHARACTERS), truncated: true, extractedCharacters: extractedCharacters ?? extracted.length }
      : limitDocumentText(extracted, MAX_EXTRACTED_CHARACTERS);
    return NextResponse.json({
      filename: file.original_filename,
      mimeType: file.mime_type,
      text: limited.text,
      truncated: limited.truncated,
      extractedCharacters: extractedCharacters ?? limited.extractedCharacters,
    });
  } catch (parseError) {
    console.error("Aahana document extraction failed:", parseError?.message || "unknown error");
    return NextResponse.json({ error: "This document could not be read. Please check that it is not damaged or password-protected." }, { status: 422 });
  }
}
