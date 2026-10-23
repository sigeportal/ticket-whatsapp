import fs from "fs";
import { randomBytes } from "crypto";
import { confinedPath, MAX_FILE_BYTES } from "./media";
import * as yauzl from "yauzl";
import path from "path";
import { readLimitedStream } from "./readLimitedStream";
import AppError from "../errors/AppError";
// Office documents are ZIP containers. Check internal type, expanded bytes and entries before XLSX consumers run.
export const validateOffice = (filename: string): Promise<void> => new Promise((resolve, reject) => {
  yauzl.open(filename, { lazyEntries: true, autoClose: true, validateEntrySizes: true }, (error, zip) => {
    if (error) { reject(new AppError("ERR_INVALID_MEDIA", 400)); return; }
    let entries = 0, total = 0, foundDocument = false, foundTypes = false, finished = false;
    const expected = path.extname(filename) === ".xlsx" ? "xl/workbook.xml" : "word/document.xml";
    const fail = () => { if (!finished) { finished = true; clearTimeout(timer); zip.close(); reject(new AppError("ERR_INVALID_MEDIA", 400)); } };
    const timer = setTimeout(fail, 30000);
    zip.on("error", fail);
    zip.on("end", () => {
      if (!foundDocument || !foundTypes) { fail(); return; }
      if (!finished) { finished = true; clearTimeout(timer); resolve(); }
    });
    zip.on("entry", entry => {
      if (++entries > 1000 || entry.fileName.length > 250 || entry.fileName.includes("\\") ||
          entry.fileName.split("/").includes("..") || /(?:vbaProject|embeddings)\b/i.test(entry.fileName) ||
          (entry.generalPurposeBitFlag & 1) || entry.uncompressedSize > 20 * 1024 * 1024 ||
          (total += entry.uncompressedSize) > 50 * 1024 * 1024) { fail(); return; }
      if (entry.fileName.endsWith("/")) { zip.readEntry(); return; }
      if (entry.fileName === expected) foundDocument = true;
      if (entry.fileName === "[Content_Types].xml") foundTypes = true;
      zip.openReadStream(entry, async (err, stream) => {
        if (err || !stream) { fail(); return; }
        try { await readLimitedStream(stream, 20 * 1024 * 1024, 10000); if (!finished) zip.readEntry(); }
        catch (_) { fail(); }
      });
    });
    zip.readEntry();
  });
});

export const validateOfficeBuffer = async (data: Buffer, extension: string, root: string): Promise<void> => {
  if (![".xlsx", ".docx"].includes(extension) || data.length > MAX_FILE_BYTES) throw new AppError("ERR_INVALID_MEDIA", 400);
  const filename = confinedPath(root, `tmp-office-${randomBytes(24).toString("hex")}${extension}`);
  try {
    await fs.promises.writeFile(filename, data, { flag: "wx", mode: 0o640 });
    await validateOffice(filename);
  } finally { await fs.promises.unlink(filename).catch(() => undefined); }
};
