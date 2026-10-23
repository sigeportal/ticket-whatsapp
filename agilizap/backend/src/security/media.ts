import path from "path";
import fs from "fs";
import AppError from "../errors/AppError";
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_FILES = 5;
export const mediaTypes: Record<string, string[]> = {
  ".ico": ["image/x-icon", "image/vnd.microsoft.icon"],
  ".jpg": ["image/jpeg"], ".jpeg": ["image/jpeg"], ".png": ["image/png"], ".gif": ["image/gif"],
  ".webp": ["image/webp"], ".pdf": ["application/pdf"], ".mp3": ["audio/mpeg", "audio/mp3"],
  ".ogg": ["audio/ogg", "application/ogg"], ".opus": ["audio/ogg", "audio/opus"],
  ".wav": ["audio/wav", "audio/x-wav"], ".mp4": ["video/mp4", "audio/mp4"],
  ".m4a": ["audio/mp4", "audio/x-m4a"], ".webm": ["video/webm", "audio/webm"],
  ".txt": ["text/plain"], ".csv": ["text/csv", "application/vnd.ms-excel", "text/plain"],
  ".xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
};
export const confinedPath = (root: string, relative: string): string => {
  if (!relative || relative.includes("\\") || relative.includes(":") || relative.includes("\0") ||
      relative.split("/").some(part => !part || part === "." || part === "..") || path.isAbsolute(relative)) {
    throw new AppError("ERR_INVALID_PATH", 400);
  }
  const target = path.resolve(root, relative);
  if (!target.startsWith(path.resolve(root) + path.sep)) throw new AppError("ERR_INVALID_PATH", 400);
  // Existing symlinks/junctions must never redirect reads or writes outside the media root.
  let current = path.resolve(root);
  if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw new AppError("ERR_INVALID_PATH", 400);
  for (const segment of relative.split("/")) {
    current = path.join(current, segment);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw new AppError("ERR_INVALID_PATH", 400);
  }
  return target;
};
export const validateMedia = (extension: string, mime: string, bytes: Buffer, size: number): void => {
  const ext = extension.toLowerCase();
  if (size < 1 || size > MAX_FILE_BYTES || !mediaTypes[ext]?.includes(mime)) throw new AppError("ERR_INVALID_MEDIA", 400);
  const hex = bytes.toString("hex");
  const ascii = bytes.toString("latin1");
  let valid = false;
  switch (ext) {
    case ".ico": valid = hex.startsWith("00000100"); break;
    case ".jpg": case ".jpeg": valid = hex.startsWith("ffd8ff"); break;
    case ".png": valid = hex.startsWith("89504e470d0a1a0a"); break;
    case ".gif": valid = /^GIF8[79]a/.test(ascii); break;
    case ".webp": valid = ascii.startsWith("RIFF") && ascii.slice(8,12) === "WEBP"; break;
    case ".pdf": valid = ascii.startsWith("%PDF-"); break;
    case ".mp3": valid = ascii.startsWith("ID3") || bytes[0] === 255 && (bytes[1] & 224) === 224; break;
    case ".ogg": case ".opus": valid = ascii.startsWith("OggS"); break;
    case ".wav": valid = ascii.startsWith("RIFF") && ascii.slice(8,12) === "WAVE"; break;
    case ".mp4": case ".m4a": valid = ascii.slice(4,8) === "ftyp"; break;
    case ".webm": valid = hex.startsWith("1a45dfa3"); break;
    case ".docx": case ".xlsx": valid = hex.startsWith("504b0304"); break;
    case ".txt": case ".csv": valid = !bytes.includes(0) && !/<(?:!doctype|html|script|svg)\b/i.test(bytes.toString("utf8")); break;
  }
  if (!valid) throw new AppError("ERR_INVALID_MEDIA", 400);
};

export const ensureMediaStorage = async (root: string, reservedBytes = 100 * 1024 * 1024): Promise<void> => {
  await fs.promises.mkdir(root, { recursive: true, mode: 0o750 });
  confinedPath(root, "budget-check");
  const disk = await (fs.promises as any).statfs(root);
  if (Number(disk.bavail) * Number(disk.bsize) < 256 * 1024 * 1024 + reservedBytes) {
    throw new AppError("ERR_MEDIA_STORAGE_FULL", 507);
  }
};
