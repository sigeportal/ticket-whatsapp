import { Request, Response } from "express";
import AppError from "../errors/AppError";
import {
  previewRetention,
  executeRetentionPurge,
  setLegalHold,
  exportDataSubject,
  anonymizeDataSubject,
  toggleCampaignOptOut
} from "../services/DataRetentionService/DataRetentionService";
import { logAuditEvent } from "../security/audit";

export const preview = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, profile, id: rawUserId, email: userEmail } = req.user;
  const userId = Number(rawUserId);

  if (profile !== "admin" && profile !== "super") {
    await logAuditEvent({
      companyId,
      userId,
      userEmail,
      userRole: profile,
      resource: "retention",
      action: "preview",
      result: "denied",
      details: { reason: "Insufficient privileges for retention preview" },
      ip: req.ip
    });
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const {
    conversationRetentionDays,
    attachmentRetentionDays,
    referenceDate
  } = req.query as Record<string, string>;

  const report = await previewRetention({
    companyId,
    conversationRetentionDays: conversationRetentionDays ? Number(conversationRetentionDays) : 730,
    attachmentRetentionDays: attachmentRetentionDays ? Number(attachmentRetentionDays) : 365,
    referenceDate: referenceDate ? new Date(referenceDate) : new Date()
  });

  return res.status(200).json(report);
};

export const purge = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, profile, id: rawUserId, email: userEmail } = req.user;
  const userId = Number(rawUserId);

  if (profile !== "admin" && profile !== "super") {
    await logAuditEvent({
      companyId,
      userId,
      userEmail,
      userRole: profile,
      resource: "retention",
      action: "purge",
      result: "denied",
      details: { reason: "Insufficient privileges for retention purge" },
      ip: req.ip
    });
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const {
    conversationRetentionDays = 730,
    attachmentRetentionDays = 365,
    purgeConversations = false,
    purgeAttachments = false,
    dryRun = true,
    referenceDate
  } = req.body;

  const report = await executeRetentionPurge({
    companyId,
    conversationRetentionDays: Number(conversationRetentionDays) || 730,
    attachmentRetentionDays: Number(attachmentRetentionDays) || 365,
    purgeConversations: Boolean(purgeConversations),
    purgeAttachments: Boolean(purgeAttachments),
    dryRun: Boolean(dryRun),
    actor: { id: userId, email: userEmail, role: profile },
    ip: req.ip,
    referenceDate: referenceDate ? new Date(referenceDate) : new Date()
  });

  return res.status(200).json(report);
};

export const updateLegalHold = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, profile, id: rawUserId, email: userEmail } = req.user;
  const userId = Number(rawUserId);
  const { ticketId } = req.params;
  const { legalHold, reason } = req.body;

  if (profile !== "admin" && profile !== "super") {
    await logAuditEvent({
      companyId,
      userId,
      userEmail,
      userRole: profile,
      resource: "ticket",
      action: "legal_hold",
      result: "denied",
      targetId: ticketId,
      details: { reason: "Insufficient privileges to change legal hold" },
      ip: req.ip
    });
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const ticket = await setLegalHold({
    ticketId: Number(ticketId),
    companyId,
    legalHold: Boolean(legalHold),
    reason,
    actor: { id: userId, email: userEmail, role: profile },
    ip: req.ip
  });

  return res.status(200).json(ticket);
};

export const exportSubject = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, profile, id: rawUserId, email: userEmail } = req.user;
  const userId = Number(rawUserId);
  const { contactId } = req.params;

  if (profile !== "admin" && profile !== "super") {
    await logAuditEvent({
      companyId,
      userId,
      userEmail,
      userRole: profile,
      resource: "contact",
      action: "export",
      result: "denied",
      targetId: contactId,
      details: { reason: "Insufficient privileges to export data subject dossier" },
      ip: req.ip
    });
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const dossier = await exportDataSubject({
    contactId: Number(contactId),
    companyId,
    actor: { id: userId, email: userEmail, role: profile },
    ip: req.ip
  });

  return res.status(200).json(dossier);
};

export const anonymizeSubject = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, profile, id: rawUserId, email: userEmail } = req.user;
  const userId = Number(rawUserId);
  const { contactId } = req.params;
  const { forceAnonymizeNonHeld = false } = req.body;

  if (profile !== "admin" && profile !== "super") {
    await logAuditEvent({
      companyId,
      userId,
      userEmail,
      userRole: profile,
      resource: "contact",
      action: "anonymize",
      result: "denied",
      targetId: contactId,
      details: { reason: "Insufficient privileges to anonymize data subject" },
      ip: req.ip
    });
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const result = await anonymizeDataSubject({
    contactId: Number(contactId),
    companyId,
    forceAnonymizeNonHeld: Boolean(forceAnonymizeNonHeld),
    actor: { id: userId, email: userEmail, role: profile },
    ip: req.ip
  });

  return res.status(200).json(result);
};

export const optOut = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, profile, id: rawUserId, email: userEmail } = req.user;
  const userId = Number(rawUserId);
  const { contactId } = req.params;
  const { optOut: optOutVal = true } = req.body;

  const contact = await toggleCampaignOptOut({
    contactId: Number(contactId),
    companyId,
    optOut: Boolean(optOutVal),
    actor: { id: userId, email: userEmail, role: profile },
    ip: req.ip
  });

  return res.status(200).json(contact);
};
