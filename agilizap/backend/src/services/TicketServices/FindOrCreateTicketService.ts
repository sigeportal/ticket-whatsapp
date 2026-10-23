import { Op } from "sequelize";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import ShowTicketService from "./ShowTicketService";
import FindOrCreateATicketTrakingService from "./FindOrCreateATicketTrakingService";
import Setting from "../../models/Setting";
import Whatsapp from "../../models/Whatsapp";
import { logAuditEvent } from "../../security/audit";

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

  if (recentClosedTicket) {
    // Reopen within grace period
    ticket = recentClosedTicket;
    await ticket.update({
      status: "pending",
      closedAt: null,
      userId: null,
      unreadMessages,
      queueId: null,
      companyId
    });

    await FindOrCreateATicketTrakingService({
      ticketId: ticket.id,
      companyId,
      whatsappId: ticket.whatsappId,
      userId: ticket.userId
    });

    await logAuditEvent({
      companyId,
      resource: "ticket",
      action: "reopen",
      result: "success",
      targetId: ticket.id,
      details: {
        reason: "Customer replied within reopening grace period",
        graceSeconds
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
  return ticket;
};

export default FindOrCreateTicketService;
