import { Op } from "sequelize";
import * as Sentry from "@sentry/node";
import Ticket from "../../models/Ticket"
import Whatsapp from "../../models/Whatsapp"
import { getIO } from "../../libs/socket"
import formatBody from "../../helpers/Mustache";
import SendWhatsAppMessage from "./SendWhatsAppMessage";
import moment from "moment";
import ShowTicketService from "../TicketServices/ShowTicketService";
import { verifyMessage } from "./wbotMessageListener";
import TicketTraking from "../../models/TicketTraking";
import { logger } from "../../utils/logger";

export const ClosedAllOpenTickets = async (companyId: number): Promise<void> => {

  // @ts-ignore: Unreachable code error
  const closeTicket = async (ticket: any, currentStatus: any, body: any) => {
    if (currentStatus === 'nps') {

      await ticket.update({
        status: "closed",
        //userId: ticket.userId || null,
        lastMessage: body,
        unreadMessages: 0,
        amountUseBotQueues: 0
      });

    } else if (currentStatus === 'open') {

      await ticket.update({
        status: "closed",
        //  userId: ticket.userId || null,
        lastMessage: body,
        unreadMessages: 0,
        amountUseBotQueues: 0
      });

    } else {

      await ticket.update({
        status: "closed",
        //userId: ticket.userId || null,
        unreadMessages: 0
      });
    }
  };

  const io = getIO();
  try {

    const { rows: tickets } = await Ticket.findAndCountAll({
      where: { status: { [Op.in]: ["open"] }, companyId },
      order: [["updatedAt", "DESC"]]
    });

    for (const ticket of tickets) {
      try {
        const showTicket = await ShowTicketService(ticket.id, companyId);
        if (!showTicket?.whatsappId) continue;

        const whatsapp = await Whatsapp.findByPk(showTicket.whatsappId);
        if (!whatsapp) continue;

        const ticketTraking = await TicketTraking.findOne({
          where: {
            ticketId: ticket.id,
            finishedAt: null,
          }
        });

        let {
          expiresInactiveMessage, //mensage de encerramento por inatividade      
          expiresTicket //tempo em horas para fechar ticket automaticamente
        } = whatsapp;

        // @ts-ignore: Unreachable code error
        if (expiresTicket && expiresTicket !== "" &&
          // @ts-ignore: Unreachable code error
          expiresTicket !== "0" && Number(expiresTicket) > 0) {

          //mensagem de encerramento por inatividade
          const bodyExpiresMessageInactive = formatBody(`\u200e ${expiresInactiveMessage || ""}`, showTicket.contact);

          const dataLimite = new Date();
          dataLimite.setMinutes(dataLimite.getMinutes() - Number(expiresTicket));

          if (showTicket.status === "open" && !showTicket.isGroup) {

            const dataUltimaInteracaoChamado = new Date(showTicket.updatedAt);

            if (dataUltimaInteracaoChamado < dataLimite && showTicket.fromMe) {

              await closeTicket(showTicket, showTicket.status, bodyExpiresMessageInactive);

              if (expiresInactiveMessage !== "" && expiresInactiveMessage != null) {
                try {
                  const sentMessage = await SendWhatsAppMessage({ body: bodyExpiresMessageInactive, ticket: showTicket });
                  await verifyMessage(sentMessage, showTicket, showTicket.contact);
                } catch (sendErr) {
                  logger.warn(`[wbotClosedTickets] Falha ao enviar mensagem de inatividade para ticket #${ticket.id}: ${sendErr}`);
                }
              }

              if (ticketTraking) {
                await ticketTraking.update({
                  finishedAt: moment().toDate(),
                  closedAt: moment().toDate(),
                  whatsappId: ticket.whatsappId,
                  userId: ticket.userId,
                });
              }

              io.to(`company-${companyId}-open`)
                .to(`queue-${ticket.queueId}-open`)
                .to(`company-${companyId}-notification`)
                .to(`queue-${ticket.queueId}-notification`)
                .to(showTicket.id.toString())
                .emit(`company-${companyId}-ticket`, {
                  action: "delete",
                  ticketId: showTicket.id
                });

            }
          }
        }
      } catch (ticketErr) {
        Sentry.captureException(ticketErr);
        logger.error(`[wbotClosedTickets] Erro ao processar ticket #${ticket.id}: ${ticketErr}`);
      }
    }

  } catch (e: any) {
    Sentry.captureException(e);
    logger.error(`[wbotClosedTickets] Erro ao fechar tickets abertos: ${e}`);
  }

};
