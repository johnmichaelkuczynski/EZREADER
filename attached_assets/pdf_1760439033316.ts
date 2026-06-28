import { Router } from "express";
import multer from "multer";
import { createRequire } from "module";

// Use createRequire for CommonJS modules in ES module environment
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/extract", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    if (req.file.mimetype !== "application/pdf") {
      return res.status(400).json({ error: "Only PDFs are allowed" });
    }
    const data = await pdfParse(req.file.buffer);
    // data.text = plain text from a digital (non-scanned) PDF
    res.json({ text: data.text || "" });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "PDF parse failure" });
  }
});

export default router;