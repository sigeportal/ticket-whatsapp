import * as Sentry from "@sentry/node";
import Message from "../../models/Message";
import { getIO } from "../../libs/socket";
import Ticket from "../../models/Ticket";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import { logger } from "../../utils/logger";

const MarkDeleteWhatsAppMessage = async (
  from: any,
  timestamp?: any,
  msgId?: string,
  companyId?: number
): Promise<Message | any> => {
  if (!from || !msgId) return timestamp;

  try {
    from = String(from).replace("@c.us", "").replace("@s.whatsapp.net", "");

    const messages = await Message.findAll({
      where: {
        id: msgId,
        companyId
      }
    });

    if (!messages.length) return timestamp;

    const messageToUpdate = await Message.findByPk(messages[0].id, {
      include: [
        "contact",
        {
          model: Message,
          as: "quotedMsg",
          include: ["contact"]
        }
      ]
    });

    if (messageToUpdate) {
      const ticket = await Ticket.findOne({
        where: {
          id: messageToUpdate.ticketId,
          companyId
        }
      });

      await messageToUpdate.update({ isDeleted: true });

      if (ticket) {
        await UpdateTicketService({
          ticketData: { lastMessage: "🚫 _Mensagem Apagada_" },
          ticketId: ticket.id,
          companyId
        });
      }

      const io = getIO();
      io.to(String(messageToUpdate.ticketId)).emit(
        `company-${companyId}-appMessage`,
        {
          action: "update",
          message: messageToUpdate
        }
      );
    }
  } catch (err) {
    Sentry.captureException(err);
    logger.error(`[MarkDeleteWhatsAppMessage] Erro ao tentar marcar a mensagem como excluída: ${err}`);
  }

  return timestamp;
};

export default MarkDeleteWhatsAppMessage;
