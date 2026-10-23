import { createHash } from "crypto";
import { Request, Response, NextFunction } from "express";
import AppError from "../errors/AppError";
// Bounded, expiring windows. A single process is supported; shared limiter required before scaling.
export const rateLimit = (max: number, windowMs: number) => {
  const windows = new Map<string, { count: number; until: number }>();
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    for (const [key, value] of windows) if (value.until <= now) windows.delete(key);
    const account = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const keys = [`ip:${req.ip}`, ...(account ? [`account:${createHash("sha256").update(account).digest("hex")}`] : [])];
    for (const key of keys) {
      let value = windows.get(key);
      if (!value) {
        if (windows.size >= 20000) throw new AppError("ERR_RATE_LIMIT", 429);
        value = { count: 0, until: now + windowMs }; windows.set(key, value);
      }
      if (++value.count > max) {
        res.setHeader("Retry-After", String(Math.ceil((value.until - now) / 1000)));
        throw new AppError("ERR_RATE_LIMIT", 429);
      }
    }
    next();
  };
};
export const loginLimit = rateLimit(10, 15 * 60000);
export const recoveryLimit = rateLimit(5, 15 * 60000);
export const sendLimit = rateLimit(60, 60000);
export const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const, path: "/", maxAge: 7 * 24 * 60 * 60 * 1000 };
export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (process.env.NODE_ENV === "production") res.setHeader("Strict-Transport-Security", "max-age=31536000");
  next();
};
export const trustedOrigin = (req: Request, res: Response, next: NextFunction): void => {
  // Cookies only authenticate refresh/me; refresh is POST and requires the exact configured origin.
  if (req.method !== "GET" && req.method !== "HEAD" &&
      (req.cookies?.jrt || req.path.toLowerCase() === "/auth/login" || req.path.toLowerCase() === "/auth/refresh_token") &&
      req.get("Origin") !== process.env.FRONTEND_URL) throw new AppError("ERR_ORIGIN", 403);
  next();
};

export const clearCookieOptions = { httpOnly: cookieOptions.httpOnly, secure: cookieOptions.secure, sameSite: cookieOptions.sameSite, path: cookieOptions.path };
