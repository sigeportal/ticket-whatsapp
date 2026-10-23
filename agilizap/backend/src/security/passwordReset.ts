import { randomBytes, createHash } from "crypto";
export const RESET_TTL_MS = 30 * 60 * 1000;
export const newResetToken = (): string => randomBytes(32).toString("hex");
export const hashResetToken = (token: string): string => createHash("sha256").update(token).digest("hex");
