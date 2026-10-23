import * as Sentry from "@sentry/node";
import { WAMessage } from "@whiskeysockets/baileys";
import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";

import Contact from "../../models/Contact";
import formatBody from "../../helpers/Mustache";
import { map_msg } from "../../utils/global";
import { getRecipientJid } from "../../helpers/GetRecipientJid";
import { logger } from "../../utils/logger";

interface Request {
  body: string;
  ticket: Ticket;
  quotedMsg?: Message;
  isForwarded?: boolean;
  messageId?: string;
  operationId?: string;
}

export const isUncertainError = (err: any): boolean => {
  const msg = (err?.message || "").toLowerCase();
  const code = (err?.code || "").toLowerCase();
  return (
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("connection closed") ||
    msg.includes("socket closed") ||
    msg.includes("stream ended") ||
    msg.includes("network") ||
    code.includes("etimedout") ||
    code.includes("econnreset") ||
    code.includes("epipe")
  );
};

const SendWhatsAppMessage = async ({
  body,
  ticket,
  quotedMsg,
  isForwarded = false,
  messageId,
  operationId
}: Request): Promise<WAMessage> => {
  let options = {};
  const wbot = await GetTicketWbot(ticket);

  const contact = ticket.contact || (ticket.contactId ? await Contact.findByPk(ticket.contactId) : null);
  const destinationJid = getRecipientJid(ticket, contact);

  if (quotedMsg) {
    const chatMessages = await Message.findOne({
      where: {
        id: quotedMsg.id, companyId: ticket.companyId, ticketId: ticket.id
      }
    });

    if (chatMessages && chatMessages.dataJson) {
      try {
        const msgFound = JSON.parse(chatMessages.dataJson);
        options = {
          quoted: {
            key: msgFound.key,
            message: {
              extendedTextMessage: msgFound.message?.extendedTextMessage
            }
          }
        };
      } catch (parseErr) {
        logger.warn(`Could not parse dataJson for quotedMsg #${quotedMsg.id}`);
      }
    }
  }

  let messageRecord: Message | null = null;
  if (messageId) {
    messageRecord = await Message.findOne({
      where: { id: messageId, companyId: ticket.companyId }
    });
    if (messageRecord) {
      await messageRecord.update({ status: "processing" });
    }
  }

  try {
    const sentMessage = await wbot.sendMessage(destinationJid, {
      text: formatBody(body, contact || ticket.contact),
      contextInfo: { forwardingScore: isForwarded ? 2 : 0, isForwarded: isForwarded ? true : false }
    },
      {
        ...options
      }
    );

    await ticket.update({
      lastMessage: formatBody(body, contact || ticket.contact),
      lastHumanResponseAt: new Date(),
      currentWaitEpisodeId: null
    });

    try {
      const { resolveQueueWaitAlert } = await import("../TicketServices/QueueWaitAlertService");
      await resolveQueueWaitAlert(ticket.id, ticket.userId);
    } catch (e) {}

    if (messageRecord) {
      await messageRecord.update({
        status: "sended",
        ack: 1,
        uncertainReason: null
      });
    }

    return sentMessage;
  } catch (err: any) {
    Sentry.captureException(err);
    logger.error(`Error sending message for ticket #${ticket.id}: ${err.message}`);

    if (messageRecord) {
      if (isUncertainError(err)) {
        await messageRecord.update({
          status: "uncertain",
          uncertainReason: `Resultado incerto: falha de rede/timeout durante confirmação do provedor (${err.message})`
        });
      } else {
        await messageRecord.update({
          status: "failed",
          ack: -1,
          uncertainReason: err.message
        });
      }
    }

    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMessage;
