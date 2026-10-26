import moment from "moment";
import Contact from "../../models/Contact";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { SendMessage } from "../../helpers/SendMessage";
import formatBody, { firstName } from "../../helpers/Mustache";
import { logger } from "../../utils/logger";

interface NotificationParams {
  contactId: number | string;
  companyId: number | string;
  userId?: number | string;
  sendAt: string | Date;
  body: string;
  confirmationMessage?: string;
}

export const sendScheduleNotification = async ({
  contactId,
  companyId,
  userId,
  sendAt,
  body,
  confirmationMessage
}: NotificationParams): Promise<void> => {
  try {
    const contact = await Contact.findByPk(contactId);
    if (!contact || contact.companyId !== Number(companyId)) {
      logger.warn(`Notificação de agendamento ignorada: contato ${contactId} não encontrado na empresa ${companyId}`);
      return;
    }

    const whatsapp = await GetDefaultWhatsApp(Number(companyId), userId ? Number(userId) : undefined);
    if (!whatsapp) {
      logger.warn(`Notificação de agendamento ignorada: nenhuma conexão WhatsApp ativa para a empresa ${companyId}`);
      return;
    }

    const dateFormatted = moment(sendAt).format("DD/MM/YYYY");
    const timeFormatted = moment(sendAt).format("HH:mm");

    const rawName = (contact.name || "").trim();
    // Se o nome começar com número ou for LID (ex: 12345678900000), não chama pelo número
    const isNumericName = /^\+?\d+/.test(rawName);
    const displayName = isNumericName ? "" : rawName;
    const displayFirstName = isNumericName ? "" : firstName(contact);

    let finalMsg =
      confirmationMessage && confirmationMessage.trim().length > 0
        ? confirmationMessage
        : "Olá, {nome}! Seu agendamento foi confirmado para o dia {data} às {hora}.";

    finalMsg = finalMsg
      .replace(/{data}/gi, dateFormatted)
      .replace(/{{data}}/gi, dateFormatted)
      .replace(/{hora}/gi, timeFormatted)
      .replace(/{{hora}}/gi, timeFormatted)
      .replace(/{mensagem}/gi, body)
      .replace(/{{mensagem}}/gi, body);

    if (displayName) {
      finalMsg = finalMsg
        .replace(/{nome}/gi, displayName)
        .replace(/{{nome}}/gi, displayName)
        .replace(/{name}/gi, displayName)
        .replace(/{{name}}/gi, displayName)
        .replace(/{firstName}/gi, displayFirstName)
        .replace(/{{firstName}}/gi, displayFirstName);
    } else {
      finalMsg = finalMsg
        .replace(/Olá,\s*{nome}!?/gi, "Olá!")
        .replace(/Olá\s*{nome}!?/gi, "Olá!")
        .replace(/Olá,\s*{{name}}!?/gi, "Olá!")
        .replace(/Olá\s*{{name}}!?/gi, "Olá!")
        .replace(/{nome}/gi, "")
        .replace(/{{nome}}/gi, "")
        .replace(/{name}/gi, "")
        .replace(/{{name}}/gi, "")
        .replace(/{firstName}/gi, "")
        .replace(/{{firstName}}/gi, "");
    }

    finalMsg = formatBody(finalMsg, contact);

    await SendMessage(whatsapp, {
      number: contact.number,
      body: finalMsg
    });

    logger.info(`Notificação imediata de agendamento enviada com sucesso para o contato ${contact.number}`);
  } catch (err: any) {
    logger.error(`Erro ao disparar aviso imediato de agendamento: ${err.message}`);
  }
};

export default sendScheduleNotification;
