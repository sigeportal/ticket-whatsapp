import { Request, Response, NextFunction } from "express";
import path from "path";
const assets = new Set(["android-chrome-192x192.png", "apple-touch-icon.png", "favicon-256x256.png",
  "favicon-32x32.png", "favicon.ico", "interno.png", "login.png", "signup.png"]);
export const publicAssets = (req: Request, res: Response, next: NextFunction): void => {
  const name = req.path.replace(/^\//, "");
  if (!assets.has(name)) { res.sendStatus(404); return; }
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.sendFile(path.resolve(__dirname, "..", "..", "public", "logotipos", name), error => { if (error) next(error); });
};
