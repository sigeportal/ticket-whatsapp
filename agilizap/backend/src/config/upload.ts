import path from "path";
import multer from "multer";
import fs from "fs";
import { randomBytes } from "crypto";
import { confinedPath, MAX_FILE_BYTES, MAX_FILES, mediaTypes } from "../security/media";
import AppError from "../errors/AppError";
const publicFolder = process.env.NODE_ENV === "test" && process.env.TEST_MEDIA_ROOT || path.resolve(__dirname, "..", "..", "public");
export default {
  directory: publicFolder,
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES, fields: 30, fieldSize: 64 * 1024, parts: 35 },
  fileFilter(req: any, file: any, cb: any) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!mediaTypes[ext]?.includes(file.mimetype)) return cb(new AppError("ERR_INVALID_MEDIA", 400));
    if ((req.path.includes("import") || req.path === "/contacts/upload" || /^\/contact-lists\/[^/]+\/upload$/.test(req.path)) && ![".csv", ".xlsx"].includes(ext)) return cb(new AppError("ERR_INVALID_MEDIA", 400));
    cb(null, true);
  },
  storage: multer.diskStorage({
    destination(req, file, cb) {
      try {
        // Directory derives only from an already-authorized route; multipart order is irrelevant.
        let relative = "";
        if (req.params.fileListId) relative = `fileList/${req.params.fileListId}`;
        else if (String(req.route?.path).startsWith("/quick-messages")) relative = "quickMessage";
        else if (String(req.route?.path).startsWith("/announcements")) relative = "announcements";
        const folder = relative ? confinedPath(publicFolder, relative) : publicFolder;
        fs.mkdirSync(folder, { recursive: true, mode: 0o750 });
        cb(null, folder);
      } catch (error) { cb(error as Error, ""); }
    },
    filename(req, file, cb) { cb(null, `${randomBytes(24).toString("hex")}${path.extname(file.originalname).toLowerCase()}`); }
  })
};
