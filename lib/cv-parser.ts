import { extractText as extractPdfText } from "unpdf";
import mammoth from "mammoth";

export async function extractText(
  buffer: Buffer,
  filename: string
): Promise<string> {
  const ext = filename.toLowerCase().split(".").pop();

  switch (ext) {
    case "pdf":
      return extractPdf(buffer);
    case "docx":
    case "doc":
      return extractDocx(buffer);
    case "txt":
    case "csv":
      return buffer.toString("utf-8");
    default:
      throw new Error(`Unsupported file type: .${ext}`);
  }
}

async function extractPdf(buffer: Buffer): Promise<string> {
  const { text } = await extractPdfText(new Uint8Array(buffer));
  return Array.isArray(text) ? text.join("\n") : text;
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}
