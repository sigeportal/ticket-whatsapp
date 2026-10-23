import { ticketAccess } from "../../security/authorizeRequest";
import TicketNote from "../../models/TicketNote";
import AppError from "../../errors/AppError";

const ShowTicketNoteService = async (
  id: string | number, actor: any
): Promise<TicketNote> => {
  const ticketNote = await TicketNote.findByPk(id);

  if (!ticketNote) {
    throw new AppError("ERR_NO_TICKETNOTE_FOUND", 404);
  }

  await ticketAccess(actor, ticketNote.ticketId);
  return ticketNote;
};

export default ShowTicketNoteService;
