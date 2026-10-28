import AppError from "../../errors/AppError";
import CheckContactOpenTickets from "../../helpers/CheckContactOpenTickets";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import Ticket from "../../models/Ticket";
import ShowContactService from "../ContactServices/ShowContactService";
import { getIO } from "../../libs/socket";
import GetDefaultWhatsAppByUser from "../../helpers/GetDefaultWhatsAppByUser";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";

interface Request {
  contactId: number;
  status: string;
  userId: number;
  companyId: number;
  queueId?: number;
  whatsappId?: string;
}

const CreateTicketService = async ({
  contactId,
  status,
  userId,
  queueId,
  companyId,
  whatsappId
}: Request): Promise<Ticket> => {
  let whatsapp;

  if (whatsappId !== undefined && whatsappId !== null && whatsappId !==  "") {
    whatsapp = await ShowWhatsAppService(whatsappId, companyId)
  }
  
  let defaultWhatsapp = await GetDefaultWhatsAppByUser(userId);

  if (whatsapp) {
    defaultWhatsapp = whatsapp;
  }
  if (!defaultWhatsapp)
    defaultWhatsapp = await GetDefaultWhatsApp(companyId);

  if (!defaultWhatsapp || defaultWhatsapp.companyId !== companyId) throw new AppError("ERR_NO_PERMISSION", 403);
  await CheckContactOpenTickets(contactId, whatsappId);

  const { isGroup } = await ShowContactService(contactId, companyId);

  const [{ id }] = await Ticket.findOrCreate({
    where: {
      contactId,
      companyId,
      whatsappId
    },
    defaults: {
      contactId,
      companyId,
      whatsappId: defaultWhatsapp.id,
      status,
      isGroup,
      userId
    }
  });

  await Ticket.update(
    { companyId, queueId, userId, whatsappId: defaultWhatsapp.id, status: "open" },
    { where: { id } }
  );

  const ticket = await Ticket.findByPk(id, { include: ["contact", "queue"] });

  if (!ticket) {
    throw new AppError("ERR_CREATING_TICKET");
  }

  try {
    const io = getIO();

    io.to(ticket.id.toString()).emit("ticket", {
      action: "update",
      ticket
    });

    const ticketRoom = io.to(`company-${companyId}-${ticket.status}`)
      .to(`company-${companyId}-notification`);

    if (ticket.queueId) {
      ticketRoom
        .to(`queue-${ticket.queueId}-${ticket.status}`)
        .to(`queue-${ticket.queueId}-notification`);
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

export default CreateTicketService;
