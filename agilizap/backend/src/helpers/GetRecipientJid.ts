import Contact from "../models/Contact";
import Ticket from "../models/Ticket";

/**
 * Resolve o JID de destino correto no WhatsApp para grupos, contatos normais e contas LID (Linked Devices / Privacy ID).
 */
export const getRecipientJid = (
  ticket: Ticket | { isGroup?: boolean; contact?: any; contactId?: number },
  contact?: Contact | any
): string => {
  const targetContact = contact || (ticket as any)?.contact;
  const isGroup = ticket?.isGroup || targetContact?.isGroup;
  const rawNumber = targetContact?.number
    ? String(targetContact.number).replace(/\D/g, "")
    : "";

  if (isGroup) {
    return `${rawNumber}@g.us`;
  }

  // Se o contato for explicitamente LID ou se tiver identificador de LID WhatsApp (14+ dígitos sem começar com DDI 55)
  if (
    targetContact?.isLid ||
    (rawNumber.length >= 14 && !rawNumber.startsWith("55"))
  ) {
    return `${rawNumber}@lid`;
  }

  return `${rawNumber}@s.whatsapp.net`;
};

export default getRecipientJid;
