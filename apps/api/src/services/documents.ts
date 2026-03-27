import pdfParse from "pdf-parse";
import Tesseract from "tesseract.js";
import type { Express } from "express";

export const documentService = {
  async extractText(file?: Express.Multer.File) {
    if (!file) {
      return "No file was provided. Use demo fallback analysis.";
    }

    const mime = file.mimetype.toLowerCase();
    if (mime.includes("pdf")) {
      const parsed = await pdfParse(file.buffer);
      return parsed.text || "PDF uploaded but no text was extracted.";
    }

    if (mime.includes("png") || mime.includes("jpg") || mime.includes("jpeg")) {
      const result = await Tesseract.recognize(file.buffer, "eng");
      return result.data.text || "Image uploaded but OCR returned no readable text.";
    }

    return "Unsupported file type. Please upload a PDF or image.";
  },
};
