import Ticket from "../../models/Ticket";
import { Op as AccessOp } from "sequelize";
import TicketNote from "../../models/TicketNote";

const FindAllTicketNotesService = async (actor: any): Promise<TicketNote[]> => {
  const ticketNote = await TicketNote.findAll({ include: [{ model: Ticket, as: "ticket", required: true, where: actor.profile === "admin" ? { companyId: actor.companyId } : { companyId: actor.companyId, queueId: { [AccessOp.in]: actor.queues.map((q: any) => q.id) } } }] });
  return ticketNote;
};

export default FindAllTicketNotesService;
