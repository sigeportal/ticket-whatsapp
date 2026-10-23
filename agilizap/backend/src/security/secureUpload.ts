import { validateOffice } from "./validateOffice";
import { ensureMediaStorage, MAX_FILE_BYTES } from "./media";
import multer from "multer";
import path from "path";
import fs from "fs";
import { authorizeRequest } from "./authorizeRequest";
import { validateMedia, MAX_FILES } from "./media";
import AppError from "../errors/AppError";
const active = new Set<string>();
// One wrapper for every route: stream to bounded disk storage, validate before consumers run, clean failures.
export default (options: multer.Options) => ({
  array: (field: string) => async (req: any, res: any, next: any) => {
    const actorKey = req.user ? `user-${req.user.id}` : `api-${req.params.whatsappId}`;
    if (active.has(actorKey) || active.size >= 4) { next(new AppError("ERR_UPLOAD_BUSY", 429)); return; }
    active.add(actorKey);
    let released = false;
    const release = () => { if (!released) { released = true; active.delete(actorKey); } };
    res.once("close", release);
    try {
      const root = (options as any).directory;
      await ensureMediaStorage(root, active.size * 5 * MAX_FILE_BYTES);
    } catch (err) { release(); next(err); return; }
    const cleanup = async () => {
      const files = (req.files || []) as Express.Multer.File[];
      await Promise.all(files.map(file => fs.promises.unlink(file.path).catch(() => undefined)));
    };
    multer(options).array(field, MAX_FILES)(req, res, async error => {
      try {
        if (error) throw error;
        for (const key of ["typeArch", "fileId"]) {
          if (req.body[key] !== undefined && !/^[a-zA-Z0-9_-]+$/.test(req.body[key])) throw new AppError("ERR_INVALID_PATH", 400);
        }
        if (res.locals.actor) await authorizeRequest(req, res.locals.actor);
        for (const file of (req.files || []) as Express.Multer.File[]) {
          const handle = await fs.promises.open(file.path, "r");
          const bytes = Buffer.alloc(Math.min(file.size, 8192));
          try { await handle.read(bytes, 0, bytes.length, 0); } finally { await handle.close(); }
          validateMedia(path.extname(file.filename), file.mimetype, bytes, file.size);
          if ([".docx", ".xlsx"].includes(path.extname(file.filename))) await validateOffice(file.path);
          await fs.promises.chmod(file.path, 0o640);
        }
        res.on("finish", () => { if (res.statusCode >= 400 || req.path.includes("/upload") && ["contacts", "contact-lists"].includes(req.path.split("/")[1])) void cleanup(); });
        release(); next();
      } catch (err) { await cleanup(); release(); next(err); }
    });
  }
});
