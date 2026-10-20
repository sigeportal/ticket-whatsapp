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

interface Request {
  body: string;
  ticket: Ticket;
  quotedMsg?: Message;
  isForwarded?: boolean;  
}

const SendWhatsAppMessage = async ({
  body,
  ticket,
  quotedMsg,
  isForwarded = false
}: Request): Promise<WAMessage> => {
  let options = {};
  const wbot = await GetTicketWbot(ticket);

  const contact = ticket.contact || (ticket.contactId ? await Contact.findByPk(ticket.contactId) : null);
  const destinationJid = getRecipientJid(ticket, contact);


  if (quotedMsg) {
    const chatMessages = await Message.findOne({
      where: {
        id: quotedMsg.id
      }
    });

    if (chatMessages) {
      const msgFound = JSON.parse(chatMessages.dataJson);

      options = {
        quoted: {
          key: msgFound.key,
          message: {
            extendedTextMessage: msgFound.message.extendedTextMessage
          }
        }
      };
    }

  }

  try {
    const sentMessage = await wbot.sendMessage(destinationJid, {
      text: formatBody(body, contact || ticket.contact),
      // text: body, //formatBody(body, ticket.contact),
      contextInfo: { forwardingScore: isForwarded ? 2 : 0, isForwarded: isForwarded ? true : false }
    },
      {
        ...options
      }
    );

    await ticket.update({ lastMessage: formatBody(body, contact || ticket.contact) });
    return sentMessage;
  } catch (err) {
    Sentry.captureException(err);
    console.log(err);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMessage;
