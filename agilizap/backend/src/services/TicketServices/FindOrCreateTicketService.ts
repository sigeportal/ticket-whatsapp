import { Op } from "sequelize";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import ShowTicketService from "./ShowTicketService";
import FindOrCreateATicketTrakingService from "./FindOrCreateATicketTrakingService";
import Setting from "../../models/Setting";
import Whatsapp from "../../models/Whatsapp";
import Queue from "../../models/Queue";
import User from "../../models/User";
import { logAuditEvent } from "../../security/audit";
import { getIO } from "../../libs/socket";
import { clearContactBotState } from "../../utils/global";

const FindOrCreateTicketService = async (
  contact: Contact,
  whatsappId: number,
  unreadMessages: number,
  companyId: number,
  groupContact?: Contact
): Promise<Ticket> => {
  const targetContactId = groupContact ? groupContact.id : contact.id;

  // 1. Search for an existing ACTIVE ticket (open or pending)
  let ticket = await Ticket.findOne({
    where: {
      status: {
        [Op.or]: ["open", "pending"]
      },
      contactId: targetContactId,
      companyId,
      whatsappId
    },
    order: [["id", "DESC"]]
  });

  if (ticket) {
    await ticket.update({ unreadMessages, whatsappId });
    ticket = await ShowTicketService(ticket.id, companyId);
    return ticket;
  }

  // 2. Check if there is a recently closed ticket within the grace period (default 2h = 7200s)
  const timeSetting = await Setting.findOne({
    where: { companyId, key: "timeCreateNewTicket" }
  });
  const graceSeconds = timeSetting && !isNaN(parseInt(timeSetting.value, 10))
    ? parseInt(timeSetting.value, 10)
    : 7200;
  const graceCutoff = new Date(Date.now() - graceSeconds * 1000);

  const recentClosedTicket = await Ticket.findOne({
    where: {
      status: "closed",
      contactId: targetContactId,
      companyId,
      whatsappId,
      [Op.or]: [
        {
          closedAt: {
            [Op.ne]: null,
            [Op.gte]: graceCutoff
          }
        },
        {
          closedAt: null,
          updatedAt: {
            [Op.gte]: graceCutoff
          }
        }
      ]
    },
    order: [["id", "DESC"]]
  });

  let previousQueueId: number | null = null;

  if (recentClosedTicket) {
    // Reopen within grace period preserving conversation context (queue & attendant)
    ticket = recentClosedTicket;
    previousQueueId = recentClosedTicket.queueId;

    let preservedQueueId: number | null = null;
    if (recentClosedTicket.queueId) {
      const existingQueue = await Queue.findOne({
        where: { id: recentClosedTicket.queueId, companyId }
      });
      if (existingQueue) {
        preservedQueueId = existingQueue.id;
      }
    }

    let preservedUserId: number | null = null;
    if (recentClosedTicket.userId) {
      const existingUser = await User.findOne({
        where: { id: recentClosedTicket.userId, companyId }
      });
      if (existingUser && !existingUser.blocked) {
        preservedUserId = existingUser.id;
      }
    }

    const reopenedStatus = preservedUserId ? "open" : "pending";

    await ticket.update({
      status: reopenedStatus,
      closedAt: null,
      userId: preservedUserId,
      unreadMessages,
      queueId: preservedQueueId,
      chatbot: false,
      queueOptionId: null,
      amountUsedBotQueues: 0,
      companyId,
      lastClientMessageAt: null,
      currentWaitEpisodeId: null
    });

    clearContactBotState(contact.number);
    clearContactBotState(groupContact?.number);

    const ticketTraking = await FindOrCreateATicketTrakingService({
      ticketId: ticket.id,
      companyId,
      whatsappId: ticket.whatsappId,
      userId: preservedUserId
    });

    if (reopenedStatus === "open") {
      await ticketTraking.update({
        startedAt: ticketTraking.startedAt || new Date(),
        userId: preservedUserId,
        ratingAt: null,
        rated: false
      });
    }

    await logAuditEvent({
      companyId,
      resource: "ticket",
      action: "reopen",
      result: "success",
      targetId: ticket.id,
      details: {
        reason: "Customer replied within reopening grace period",
        graceSeconds,
        reopenedStatus,
        preservedUserId,
        preservedQueueId
      }
    });
  } else {
    // Outside grace period: create a BRAND NEW ticket
    // This ensures past closed tickets retain their closedAt and their retention clocks are not reset
    const whatsapp = await Whatsapp.findOne({
      where: { id: whatsappId }
    });

    try {
      ticket = await Ticket.create({
        contactId: targetContactId,
        status: "pending",
        isGroup: !!groupContact,
        unreadMessages,
        whatsappId,
        whatsapp,
        companyId
      });
    } catch (err: any) {
      if (
        err.name === "SequelizeUniqueConstraintError" ||
        err.name === "UniqueConstraintError" ||
        (err.message && err.message.toLowerCase().includes("unique"))
      ) {
        // Concurrency recovery: another thread created the active ticket at the same moment
        const existingActive = await Ticket.findOne({
          where: {
            status: { [Op.or]: ["open", "pending"] },
            contactId: targetContactId,
            companyId,
            whatsappId
          }
        });
        if (existingActive) {
          return await ShowTicketService(existingActive.id, companyId);
        }
      }
      throw err;
    }

    await FindOrCreateATicketTrakingService({
      ticketId: ticket.id,
      companyId,
      whatsappId,
      userId: ticket.userId
    });

    clearContactBotState(contact.number);
    clearContactBotState(groupContact?.number);

    await logAuditEvent({
      companyId,
      resource: "ticket",
      action: "create",
      result: "success",
      targetId: ticket.id,
      details: {
        isGroup: !!groupContact,
        contactId: targetContactId
      }
    });
  }

  ticket = await ShowTicketService(ticket.id, companyId);

  try {
    const io = getIO();
    if (recentClosedTicket) {
      let closedDeleteRoom = io.to(`company-${companyId}-closed`);
      if (previousQueueId) {
        closedDeleteRoom = closedDeleteRoom.to(`queue-${previousQueueId}-closed`);
      }
      closedDeleteRoom.emit(`company-${companyId}-ticket`, {
        action: "delete",
        ticketId: ticket.id
      });
    }

    let ticketRoom = io.to(`company-${companyId}-${ticket.status}`)
      .to(`company-${companyId}-notification`)
      .to(ticket.id.toString());

    if (ticket.queueId) {
      ticketRoom = ticketRoom
        .to(`queue-${ticket.queueId}-${ticket.status}`)
        .to(`queue-${ticket.queueId}-notification`);
    }

    if (ticket.userId) {
      ticketRoom = ticketRoom.to(`user-${ticket.userId}`);
    }

    ticketRoom.emit(`company-${companyId}-ticket`, {
      action: "update",
      ticket
    });
  } catch (socketErr) {
    // Non-fatal if socket is uninitialized in test harness
  }

  return ticket;
};

export default FindOrCreateTicketService;
