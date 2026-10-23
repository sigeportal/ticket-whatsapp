import { logger } from "../utils/logger";
import AuditLog from "../models/AuditLog";

export interface AuditEventParams {
  companyId: number;
  userId?: number | null;
  userEmail?: string | null;
  userRole?: string | null;
  resource: string;
  action: string;
  result?: "success" | "denied" | "failed" | string;
  targetId?: string | number | null;
  details?: any;
  ip?: string | null;
}

const SENSITIVE_KEY_REGEX = /(password|token|secret|hash|salt|authorization|cookie|jwt|key|mfalaststep)/i;

/**
 * Recursively strips sensitive fields (passwords, tokens, secrets) from audit metadata.
 */
export const sanitizeAuditDetails = (val: any, depth = 0): any => {
  if (depth > 6 || val === null || val === undefined) {
    return val;
  }
  if (typeof val !== "object") {
    return val;
  }
  if (Array.isArray(val)) {
    return val.slice(0, 100).map(item => sanitizeAuditDetails(item, depth + 1));
  }
  const sanitized: Record<string, any> = {};
  for (const [k, v] of Object.entries(val)) {
    if (SENSITIVE_KEY_REGEX.test(k)) {
      sanitized[k] = "[REDACTED]";
    } else if (typeof v === "object" && v !== null) {
      sanitized[k] = sanitizeAuditDetails(v, depth + 1);
    } else if (typeof v === "string" && v.length > 500) {
      sanitized[k] = v.slice(0, 500) + "...[TRUNCATED]";
    } else {
      sanitized[k] = v;
    }
  }
  return sanitized;
};

/**
 * Records an immutable audit log entry.
 * Never throws errors to the caller so primary operations are not disrupted.
 */
export const logAuditEvent = async (params: AuditEventParams): Promise<AuditLog | null> => {
  try {
    if (!params.companyId || !params.resource || !params.action) {
      logger.warn("[Audit] Missing required parameters for audit log event:", params);
      return null;
    }

    const entry = await AuditLog.create({
      companyId: Number(params.companyId),
      userId: params.userId ? Number(params.userId) : null,
      userEmail: params.userEmail ? String(params.userEmail) : null,
      userRole: params.userRole ? String(params.userRole) : null,
      resource: String(params.resource),
      action: String(params.action),
      result: params.result || "success",
      targetId: params.targetId !== null && params.targetId !== undefined ? String(params.targetId) : null,
      details: params.details ? sanitizeAuditDetails(params.details) : null,
      ip: params.ip ? String(params.ip).slice(0, 45) : null
    });

    return entry;
  } catch (err: any) {
    logger.warn(`[Audit] Failed to persist audit log entry: ${err?.message || err}`);
    return null;
  }
};
