import { disconnectUser } from "../../libs/socket";
import User from "../../models/User";
import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import UpdateDeletedUserOpenTicketsStatus from "../../helpers/UpdateDeletedUserOpenTicketsStatus";

const DeleteUserService = async (
  id: string | number,
  companyId: number, requestUserId: string | number
): Promise<void> => {
  const user = await User.findOne({
    where: { id, companyId }
  });

  if (!user) {
    throw new AppError("ERR_NO_USER_FOUND", 404);
  }

  const actor = await User.findByPk(requestUserId);
  if (!actor || actor.companyId !== companyId || actor.profile !== "admin" ||
      user.super && (!actor.super || process.env.PLATFORM_MAINTENANCE_ENABLED !== "true")) throw new AppError("ERR_NO_PERMISSION", 403);
  const userOpenTickets: Ticket[] = await user.$get("tickets", {
    where: { status: "open" }
  });

  if (userOpenTickets.length > 0) {
    UpdateDeletedUserOpenTicketsStatus(userOpenTickets, companyId);
  }

  disconnectUser(user.id);
  await user.destroy();
};

export default DeleteUserService;
