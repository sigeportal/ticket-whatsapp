import Chat from "../../models/Chat";
import ChatUser from "../../models/ChatUser";
import User from "../../models/User";
import AppError from "../../errors/AppError";

const ShowFromUuidService = async (uuid: string): Promise<Chat> => {
  const record = await Chat.findOne({ where: { uuid }, include: [{ model: ChatUser, as: "users", include: [{ model: User, as: "user", attributes: ["id", "name", "online"] }] }] });

  if (!record) {
    throw new AppError("ERR_NO_CHAT_FOUND", 404);
  }

  return record;
};

export default ShowFromUuidService;
