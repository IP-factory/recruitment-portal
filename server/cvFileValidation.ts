/**
 * Task 24G — server-side CV file validation.
 *
 * The browser MIME type is never trusted: file content is identified from
 * magic bytes and must agree with the filename extension. Pure functions so
 * the rules are directly testable.
 */
import { CV_ACCEPTED_EXTENSIONS, CV_MAX_FILE_SIZE, CV_MIME_TYPES, cvExtensionOf, type CvExtension } from "../shared/cvApi";

export type CvFileType = "pdf" | "doc" | "docx";

const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF
const OLE2_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]); // legacy .doc
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // .docx (OOXML zip)

const EXTENSION_BY_TYPE: Record<CvFileType, CvExtension> = {
  pdf: ".pdf",
  doc: ".doc",
  docx: ".docx",
};

/**
 * Identify the CV file type from content magic bytes.
 * DOCX additionally requires the OOXML `[Content_Types].xml` entry name to
 * appear in the archive so arbitrary zip files are rejected.
 */
export function detectCvFileType(buffer: Buffer): CvFileType | null {
  if (buffer.length >= PDF_MAGIC.length && buffer.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) return "pdf";
  if (buffer.length >= OLE2_MAGIC.length && buffer.subarray(0, OLE2_MAGIC.length).equals(OLE2_MAGIC)) return "doc";
  if (buffer.length >= ZIP_MAGIC.length && buffer.subarray(0, ZIP_MAGIC.length).equals(ZIP_MAGIC)) {
    const head = buffer.subarray(0, Math.min(buffer.length, 512 * 1024));
    if (head.includes(Buffer.from("[Content_Types].xml"))) return "docx";
    return null;
  }
  return null;
}

export type CvValidationResult =
  | { ok: true; mimeType: string; extension: CvExtension; sanitizedFilename: string }
  | { ok: false; error: string };

/**
 * Validate an uploaded CV: size limit, known extension, detected content type,
 * and extension/content agreement. Returns a sanitized filename (basename
 * only — no directory components) for safe display and storage metadata.
 */
export function validateCvUpload(buffer: Buffer, filename: string): CvValidationResult {
  const cleanName = filename.replace(/^.*[\\/]/, "").trim();
  if (!cleanName) return { ok: false, error: "The file name is missing." };
  if (cleanName.length > 320) return { ok: false, error: "The file name is too long." };

  if (buffer.length === 0) return { ok: false, error: "The selected file is empty." };
  if (buffer.length > CV_MAX_FILE_SIZE) {
    return { ok: false, error: "The file is too large. CVs must be 10 MB or smaller." };
  }

  const extension = cvExtensionOf(cleanName);
  if (!(CV_ACCEPTED_EXTENSIONS as readonly string[]).includes(extension)) {
    return { ok: false, error: "Unsupported file type. Please upload a PDF, DOC or DOCX file." };
  }

  const detected = detectCvFileType(buffer);
  if (!detected) {
    return { ok: false, error: "The file contents could not be recognised as a valid CV document." };
  }
  if (EXTENSION_BY_TYPE[detected] !== extension) {
    return { ok: false, error: "The file contents do not match its extension. Please upload a genuine PDF, DOC or DOCX file." };
  }

  return { ok: true, mimeType: CV_MIME_TYPES[extension as CvExtension], extension: extension as CvExtension, sanitizedFilename: cleanName };
}
