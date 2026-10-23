import Ticket from "../../models/Ticket";
import { Op as AccessOp } from "sequelize";
import { Sequelize, Op } from "sequelize";
import TicketNote from "../../models/TicketNote";

interface Request {
  searchParam?: string;
  pageNumber?: string;
}

interface Response {
  ticketNotes: TicketNote[];
  count: number;
  hasMore: boolean;
}

const ListTicketNotesService = async ({
  searchParam = "",
  pageNumber = "1"
}: Request, actor: any): Promise<Response> => {
  const whereCondition = {
    [Op.or]: [
      {
        note: Sequelize.where(
          Sequelize.fn("LOWER", Sequelize.col("note")),
          "LIKE",
          `%${searchParam.toLowerCase().trim()}%`
        )
      }
    ]
  };
  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const { count, rows: ticketNotes } = await TicketNote.findAndCountAll({
    where: whereCondition,
    include: [{ model: Ticket, as: "ticket", required: true, where: actor.profile === "admin" ? { companyId: actor.companyId } : { companyId: actor.companyId, queueId: { [AccessOp.in]: actor.queues.map((q: any) => q.id) } } }],
    limit,
    offset,
    order: [["createdAt", "DESC"]]
  });

  const hasMore = count > offset + ticketNotes.length;

  return {
    ticketNotes,
    count,
    hasMore
  };
};

export default ListTicketNotesService;
