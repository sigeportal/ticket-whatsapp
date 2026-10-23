import { Request, Response } from "express";
import { Op } from "sequelize";
import AuditLog from "../models/AuditLog";
import AppError from "../errors/AppError";
import { logAuditEvent } from "../security/audit";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, profile, id: rawUserId, email: userEmail } = req.user;
  const userId = Number(rawUserId);

  if (profile !== "admin" && profile !== "super") {
    await logAuditEvent({
      companyId,
      userId,
      userEmail,
      userRole: profile,
      resource: "audit_log",
      action: "read",
      result: "denied",
      details: { reason: "Insufficient privileges for audit log access" },
      ip: req.ip
    });
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const {
    resource,
    action,
    result,
    actorUserId,
    startDate,
    endDate,
    pageNumber = "1",
    pageSize = "50"
  } = req.query as Record<string, string>;

  const where: any = { companyId };

  if (resource) where.resource = resource;
  if (action) where.action = action;
  if (result) where.result = result;
  if (actorUserId) where.userId = Number(actorUserId);

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt[Op.gte] = new Date(startDate);
    if (endDate) where.createdAt[Op.lte] = new Date(endDate);
  }

  const limit = Math.min(Math.max(Number(pageSize) || 50, 1), 200);
  const offset = (Math.max(Number(pageNumber) || 1, 1) - 1) * limit;

  const { rows: logs, count } = await AuditLog.findAndCountAll({
    where,
    order: [["createdAt", "DESC"]],
    limit,
    offset
  });

  const hasMore = count > offset + logs.length;

  return res.status(200).json({ logs, count, hasMore, pageNumber: Number(pageNumber) });
};

export const exportLogs = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, profile, id: rawUserId, email: userEmail } = req.user;
  const userId = Number(rawUserId);

  if (profile !== "admin" && profile !== "super") {
    await logAuditEvent({
      companyId,
      userId,
      userEmail,
      userRole: profile,
      resource: "audit_log",
      action: "export",
      result: "denied",
      details: { reason: "Insufficient privileges for audit log export" },
      ip: req.ip
    });
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const { startDate, endDate, resource, action } = req.query as Record<string, string>;
  const where: any = { companyId };

  if (resource) where.resource = resource;
  if (action) where.action = action;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt[Op.gte] = new Date(startDate);
    if (endDate) where.createdAt[Op.lte] = new Date(endDate);
  }

  const logs = await AuditLog.findAll({
    where,
    order: [["createdAt", "DESC"]],
    limit: 5000
  });

  await logAuditEvent({
    companyId,
    userId,
    userEmail,
    userRole: profile,
    resource: "audit_log",
    action: "export",
    result: "success",
    details: { exportedRecordsCount: logs.length },
    ip: req.ip
  });

  return res.status(200).json({
    companyId,
    exportedAt: new Date(),
    count: logs.length,
    logs
  });
};
