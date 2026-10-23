import { Op as AccessOp } from "sequelize";
import TicketNote from "../../models/TicketNote";
import User from "../../models/User";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";

interface Params {
  contactId: number | string;
  ticketId: number | string;
}

const FindNotesByContactIdAndTicketId = async ({
  contactId,
  ticketId
}: Params, actor: any): Promise<TicketNote[]> => {
  const notes: TicketNote[] = await TicketNote.findAll({
    where: {
      contactId,
      ticketId
    },
    include: [
      { model: User, as: "user", attributes: ["id", "name", "email"] },
      { model: Contact, as: "contact", attributes: ["id", "name"] },
      { model: Ticket, as: "ticket", required: true, where: actor.profile === "admin" ? { companyId: actor.companyId } : { companyId: actor.companyId, queueId: { [AccessOp.in]: actor.queues.map((q: any) => q.id) } } }
    ],
    order: [["createdAt", "DESC"]]
  });

  return notes;
};

export default FindNotesByContactIdAndTicketId;
