import upload from "./upload";
import AppError from "../errors/AppError";
export default { ...upload, limits: { ...upload.limits, files: 1 },
  fileFilter(req: any, file: any, cb: any) {
    if (!["image/png", "image/x-icon", "image/vnd.microsoft.icon"].includes(file.mimetype)) return cb(new AppError("ERR_INVALID_MEDIA", 400));
    upload.fileFilter(req, file, cb);
  }
};
