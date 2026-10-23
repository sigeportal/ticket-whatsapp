import fs from "fs";
import path from "path";
import { Op } from "sequelize";
import { subDays } from "date-fns";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import Contact from "../../models/Contact";
import ContactCustomField from "../../models/ContactCustomField";
import ContactListItem from "../../models/ContactListItem";
import TicketNote from "../../models/TicketNote";
import TicketTag from "../../models/TicketTag";
import AppError from "../../errors/AppError";
import { confinedPath } from "../../security/media";
import { logAuditEvent } from "../../security/audit";
import { logger } from "../../utils/logger";

const getStorageRoot = (): string => {
  return process.env.TEST_MEDIA_ROOT || path.resolve(__dirname, "..", "..", "..", "public");
};

export interface RetentionPreviewReport {
  companyId: number;
  referenceDate: Date;
  conversationCutoffDate: Date;
  attachmentCutoffDate: Date;
  conversationRetentionDays: number;
  attachmentRetentionDays: number;
  conversations: {
    eligibleTicketsCount: number;
    eligibleMessagesCount: number;
    sampleTicketIds: number[];
  };
  attachments: {
    eligibleAttachmentsCount: number;
    sampleMediaUrls: string[];
    estimatedFilesFound: number;
  };
  preservedLegalHoldTicketsCount: number;
}

export interface RetentionPurgeOptions {
  companyId: number;
  conversationRetentionDays?: number;
  attachmentRetentionDays?: number;
  purgeConversations?: boolean;
  purgeAttachments?: boolean;
  dryRun?: boolean;
  actor?: { id?: number; email?: string; role?: string };
  ip?: string;
  referenceDate?: Date;
}

export interface RetentionPurgeReport {
  dryRun: boolean;
  companyId: number;
  conversationRetentionDays: number;
  attachmentRetentionDays: number;
  purgedTicketsCount: number;
  purgedMessagesCount: number;
  purgedAttachmentsCount: number;
  purgedPhysicalFilesCount: number;
  preservedLegalHoldTicketsCount: number;
  timestamp: Date;
}

export const previewRetention = async ({
  companyId,
  conversationRetentionDays = 730,
  attachmentRetentionDays = 365,
  referenceDate = new Date()
}: {
  companyId: number;
  conversationRetentionDays?: number;
  attachmentRetentionDays?: number;
  referenceDate?: Date;
}): Promise<RetentionPreviewReport> => {
  const conversationCutoffDate = subDays(referenceDate, conversationRetentionDays);
  const attachmentCutoffDate = subDays(referenceDate, attachmentRetentionDays);

  // Eligible conversations: tickets closed before conversation cutoff, not on legal hold
  const eligibleTickets = await Ticket.findAll({
    where: {
      companyId,
      status: "closed",
      legalHold: false,
      closedAt: {
        [Op.lte]: conversationCutoffDate
      }
    },
    attributes: ["id"],
    limit: 500
  });

  const eligibleTicketIds = eligibleTickets.map(t => t.id);
  const eligibleMessagesCount = eligibleTicketIds.length > 0
    ? await Message.count({
        where: {
          companyId,
          ticketId: { [Op.in]: eligibleTicketIds }
        }
      })
    : 0;

  // Eligible attachments: messages with media in tickets closed before attachment cutoff, not on legal hold
  const closedTicketsForAttachments = await Ticket.findAll({
    where: {
      companyId,
      status: "closed",
      legalHold: false,
      closedAt: {
        [Op.lte]: attachmentCutoffDate
      }
    },
    attributes: ["id"]
  });

  const attachmentTicketIds = closedTicketsForAttachments.map(t => t.id);
  const eligibleAttachmentMessages = attachmentTicketIds.length > 0
    ? await Message.findAll({
        where: {
          companyId,
          ticketId: { [Op.in]: attachmentTicketIds },
          mediaUrl: { [Op.ne]: null }
        },
        attributes: ["id", "mediaUrl"],
        limit: 100
      })
    : [];

  const totalAttachmentsCount = attachmentTicketIds.length > 0
    ? await Message.count({
        where: {
          companyId,
          ticketId: { [Op.in]: attachmentTicketIds },
          mediaUrl: { [Op.ne]: null }
        }
      })
    : 0;

  const preservedLegalHoldTicketsCount = await Ticket.count({
    where: {
      companyId,
      status: "closed",
      legalHold: true
    }
  });

  const root = getStorageRoot();
  let filesFound = 0;
  for (const msg of eligibleAttachmentMessages) {
    try {
      const raw = msg.getDataValue("mediaUrl");
      if (raw) {
        const filePath = confinedPath(root, raw);
        if (fs.existsSync(filePath)) filesFound++;
      }
    } catch (_err) {}
  }

  return {
    companyId,
    referenceDate,
    conversationCutoffDate,
    attachmentCutoffDate,
    conversationRetentionDays,
    attachmentRetentionDays,
    conversations: {
      eligibleTicketsCount: eligibleTicketIds.length,
      eligibleMessagesCount,
      sampleTicketIds: eligibleTicketIds.slice(0, 20)
    },
    attachments: {
      eligibleAttachmentsCount: totalAttachmentsCount,
      sampleMediaUrls: eligibleAttachmentMessages.map(m => m.getDataValue("mediaUrl")).filter(Boolean).slice(0, 10),
      estimatedFilesFound: filesFound
    },
    preservedLegalHoldTicketsCount
  };
};

export const executeRetentionPurge = async (options: RetentionPurgeOptions): Promise<RetentionPurgeReport> => {
  const {
    companyId,
    conversationRetentionDays = 730,
    attachmentRetentionDays = 365,
    purgeConversations = false,
    purgeAttachments = false,
    dryRun = true,
    actor,
    ip,
    referenceDate = new Date()
  } = options;

  if (dryRun) {
    const preview = await previewRetention({
      companyId,
      conversationRetentionDays,
      attachmentRetentionDays,
      referenceDate
    });

    await logAuditEvent({
      companyId,
      userId: actor?.id,
      userEmail: actor?.email,
      userRole: actor?.role,
      resource: "retention",
      action: "retention_dry_run",
      result: "success",
      details: {
        conversationRetentionDays,
        attachmentRetentionDays,
        eligibleTickets: preview.conversations.eligibleTicketsCount,
        eligibleMessages: preview.conversations.eligibleMessagesCount,
        eligibleAttachments: preview.attachments.eligibleAttachmentsCount,
        preservedLegalHold: preview.preservedLegalHoldTicketsCount
      },
      ip
    });

    return {
      dryRun: true,
      companyId,
      conversationRetentionDays,
      attachmentRetentionDays,
      purgedTicketsCount: 0,
      purgedMessagesCount: 0,
      purgedAttachmentsCount: 0,
      purgedPhysicalFilesCount: 0,
      preservedLegalHoldTicketsCount: preview.preservedLegalHoldTicketsCount,
      timestamp: new Date()
    };
  }

  // Real purge execution
  const conversationCutoffDate = subDays(referenceDate, conversationRetentionDays);
  const attachmentCutoffDate = subDays(referenceDate, attachmentRetentionDays);
  const root = getStorageRoot();

  let purgedAttachmentsCount = 0;
  let purgedPhysicalFilesCount = 0;
  let purgedTicketsCount = 0;
  let purgedMessagesCount = 0;

  // 1. Purge attachments older than attachmentCutoffDate
  if (purgeAttachments) {
    const closedTicketsForAttachments = await Ticket.findAll({
      where: {
        companyId,
        status: "closed",
        legalHold: false,
        closedAt: { [Op.lte]: attachmentCutoffDate }
      },
      attributes: ["id"]
    });

    const attachmentTicketIds = closedTicketsForAttachments.map(t => t.id);
    if (attachmentTicketIds.length > 0) {
      const messagesWithMedia = await Message.findAll({
        where: {
          companyId,
          ticketId: { [Op.in]: attachmentTicketIds },
          mediaUrl: { [Op.ne]: null }
        }
      });

      for (const msg of messagesWithMedia) {
        const raw = msg.getDataValue("mediaUrl");
        if (raw) {
          try {
            const filePath = confinedPath(root, raw);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              purgedPhysicalFilesCount++;
            }
          } catch (fileErr) {
            logger.warn(`[Retention] Error unlinking file for message ${msg.id}: ${fileErr}`);
          }
        }
        await msg.update({
          mediaUrl: null,
          body: msg.body ? `${msg.body}\n[Anexo expirado pela política de retenção]` : "[Anexo expirado pela política de retenção]"
        });
        purgedAttachmentsCount++;
      }
    }
  }

  // 2. Purge conversations older than conversationCutoffDate
  if (purgeConversations) {
    const eligibleTickets = await Ticket.findAll({
      where: {
        companyId,
        status: "closed",
        legalHold: false,
        closedAt: { [Op.lte]: conversationCutoffDate }
      }
    });

    for (const ticket of eligibleTickets) {
      // Unlink any remaining files
      const msgs = await Message.findAll({
        where: { companyId, ticketId: ticket.id }
      });

      for (const msg of msgs) {
        const raw = msg.getDataValue("mediaUrl");
        if (raw) {
          try {
            const filePath = confinedPath(root, raw);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              purgedPhysicalFilesCount++;
            }
          } catch (_e) {}
        }
      }

      const msgCount = msgs.length;
      await Message.destroy({ where: { companyId, ticketId: ticket.id } });
      await TicketNote.destroy({ where: { ticketId: ticket.id } });
      await TicketTag.destroy({ where: { ticketId: ticket.id } });
      await ticket.destroy();

      purgedTicketsCount++;
      purgedMessagesCount += msgCount;
    }
  }

  const preservedLegalHoldTicketsCount = await Ticket.count({
    where: {
      companyId,
      status: "closed",
      legalHold: true
    }
  });

  await logAuditEvent({
    companyId,
    userId: actor?.id,
    userEmail: actor?.email,
    userRole: actor?.role,
    resource: "retention",
    action: "execute_purge",
    result: "success",
    details: {
      conversationRetentionDays,
      attachmentRetentionDays,
      purgeConversations,
      purgeAttachments,
      purgedTicketsCount,
      purgedMessagesCount,
      purgedAttachmentsCount,
      purgedPhysicalFilesCount,
      preservedLegalHoldTicketsCount
    },
    ip
  });

  return {
    dryRun: false,
    companyId,
    conversationRetentionDays,
    attachmentRetentionDays,
    purgedTicketsCount,
    purgedMessagesCount,
    purgedAttachmentsCount,
    purgedPhysicalFilesCount,
    preservedLegalHoldTicketsCount,
    timestamp: new Date()
  };
};

export const setLegalHold = async ({
  ticketId,
  companyId,
  legalHold,
  reason,
  actor,
  ip
}: {
  ticketId: number;
  companyId: number;
  legalHold: boolean;
  reason?: string;
  actor?: { id?: number; email?: string; role?: string };
  ip?: string;
}): Promise<Ticket> => {
  const ticket = await Ticket.findOne({
    where: { id: ticketId, companyId }
  });

  if (!ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  if (legalHold && (!reason || !reason.trim())) {
    throw new AppError("ERR_LEGAL_HOLD_REASON_REQUIRED", 400);
  }

  await ticket.update({
    legalHold,
    legalHoldReason: legalHold ? reason!.trim() : null,
    legalHoldAt: legalHold ? new Date() : null
  });

  await logAuditEvent({
    companyId,
    userId: actor?.id,
    userEmail: actor?.email,
    userRole: actor?.role,
    resource: "ticket",
    action: "legal_hold",
    result: "success",
    targetId: ticket.id,
    details: {
      legalHold,
      reason: legalHold ? reason!.trim() : null
    },
    ip
  });

  return ticket;
};

export const exportDataSubject = async ({
  contactId,
  companyId,
  actor,
  ip
}: {
  contactId: number;
  companyId: number;
  actor?: { id?: number; email?: string; role?: string };
  ip?: string;
}) => {
  const contact = await Contact.findOne({
    where: { id: contactId, companyId },
    include: ["extraInfo"]
  });

  if (!contact) {
    throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }

  const tickets = await Ticket.findAll({
    where: { contactId: contact.id, companyId },
    order: [["createdAt", "ASC"]]
  });

  const ticketIds = tickets.map(t => t.id);

  const messages = ticketIds.length > 0
    ? await Message.findAll({
        where: {
          companyId,
          ticketId: { [Op.in]: ticketIds }
        },
        order: [["createdAt", "ASC"]]
      })
    : [];

  const notes = ticketIds.length > 0
    ? await TicketNote.findAll({
        where: { ticketId: { [Op.in]: ticketIds } }
      })
    : [];

  await logAuditEvent({
    companyId,
    userId: actor?.id,
    userEmail: actor?.email,
    userRole: actor?.role,
    resource: "contact",
    action: "export",
    result: "success",
    targetId: contact.id,
    details: {
      contactName: contact.name,
      ticketsCount: tickets.length,
      messagesCount: messages.length
    },
    ip
  });

  return {
    contact: {
      id: contact.id,
      name: contact.name,
      number: contact.number,
      email: contact.email,
      optOutCampaign: contact.optOutCampaign,
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt,
      extraInfo: contact.extraInfo
    },
    tickets: tickets.map(t => ({
      id: t.id,
      uuid: t.uuid,
      status: t.status,
      closedAt: t.closedAt,
      legalHold: t.legalHold,
      legalHoldReason: t.legalHoldReason,
      createdAt: t.createdAt
    })),
    messages: messages.map(m => ({
      id: m.id,
      ticketId: m.ticketId,
      fromMe: m.fromMe,
      body: m.body,
      mediaType: m.mediaType,
      mediaUrl: m.mediaUrl,
      createdAt: m.createdAt
    })),
    notes: notes.map(n => ({
      id: n.id,
      ticketId: n.ticketId,
      note: n.note,
      createdAt: n.createdAt
    }))
  };
};

export const anonymizeDataSubject = async ({
  contactId,
  companyId,
  forceAnonymizeNonHeld = false,
  actor,
  ip
}: {
  contactId: number;
  companyId: number;
  forceAnonymizeNonHeld?: boolean;
  actor?: { id?: number; email?: string; role?: string };
  ip?: string;
}) => {
  const contact = await Contact.findOne({
    where: { id: contactId, companyId }
  });

  if (!contact) {
    throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }

  const heldTicketsCount = await Ticket.count({
    where: { contactId: contact.id, companyId, legalHold: true }
  });

  if (heldTicketsCount > 0 && !forceAnonymizeNonHeld) {
    await logAuditEvent({
      companyId,
      userId: actor?.id,
      userEmail: actor?.email,
      userRole: actor?.role,
      resource: "contact",
      action: "anonymize",
      result: "denied",
      targetId: contact.id,
      details: {
        reason: "Contact has tickets under active legal hold",
        heldTicketsCount
      },
      ip
    });
    throw new AppError("ERR_CONTACT_HAS_LEGAL_HOLD: Contato possui atendimentos com retenção legal obrigatória", 409);
  }

  const originalNumber = contact.number;
  const anonName = `[Titular Excluído #${contact.id}]`;
  const anonNumber = `deleted-${contact.id}-${Date.now()}`;
  const anonEmail = `deleted-${contact.id}@anonymized.invalid`;

  // Anonymize contact
  await contact.update({
    name: anonName,
    number: anonNumber,
    email: anonEmail,
    profilePicUrl: "",
    optOutCampaign: true
  });

  // Remove custom fields
  await ContactCustomField.destroy({ where: { contactId: contact.id } });

  // Update contact list items with the original number
  await ContactListItem.update({
    name: anonName,
    number: anonNumber,
    email: anonEmail,
    optOutCampaign: true
  }, {
    where: { companyId, number: originalNumber }
  });

  // Clean non-held tickets & messages
  const nonHeldTickets = await Ticket.findAll({
    where: { contactId: contact.id, companyId, legalHold: false },
    attributes: ["id"]
  });

  const root = getStorageRoot();
  let deletedFiles = 0;
  if (nonHeldTickets.length > 0) {
    const nonHeldIds = nonHeldTickets.map(t => t.id);
    const msgs = await Message.findAll({
      where: { companyId, ticketId: { [Op.in]: nonHeldIds } }
    });

    for (const msg of msgs) {
      const raw = msg.getDataValue("mediaUrl");
      if (raw) {
        try {
          const filePath = confinedPath(root, raw);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            deletedFiles++;
          }
        } catch (_e) {}
      }
      await msg.update({
        body: "[Mensagem anonimizada a pedido do titular]",
        mediaUrl: null
      });
    }
  }

  await logAuditEvent({
    companyId,
    userId: actor?.id,
    userEmail: actor?.email,
    userRole: actor?.role,
    resource: "contact",
    action: "anonymize",
    result: "success",
    targetId: contact.id,
    details: {
      anonymizedContactId: contact.id,
      heldTicketsCount,
      nonHeldTicketsCount: nonHeldTickets.length,
      deletedFiles
    },
    ip
  });

  return {
    success: true,
    contactId: contact.id,
    heldTicketsCount,
    nonHeldTicketsCount: nonHeldTickets.length
  };
};

export const toggleCampaignOptOut = async ({
  contactId,
  companyId,
  optOut,
  actor,
  ip
}: {
  contactId: number;
  companyId: number;
  optOut: boolean;
  actor?: { id?: number; email?: string; role?: string };
  ip?: string;
}): Promise<Contact> => {
  const contact = await Contact.findOne({
    where: { id: contactId, companyId }
  });

  if (!contact) {
    throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }

  await contact.update({ optOutCampaign: optOut });

  // Sync with contact list items by number
  await ContactListItem.update(
    { optOutCampaign: optOut },
    { where: { companyId, number: contact.number } }
  );

  await logAuditEvent({
    companyId,
    userId: actor?.id,
    userEmail: actor?.email,
    userRole: actor?.role,
    resource: "contact",
    action: "opt_out",
    result: "success",
    targetId: contact.id,
    details: { optOutCampaign: optOut },
    ip
  });

  return contact;
};
