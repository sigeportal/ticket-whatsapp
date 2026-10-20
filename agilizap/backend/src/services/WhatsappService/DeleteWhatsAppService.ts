import Whatsapp from "../../models/Whatsapp";
import AppError from "../../errors/AppError";
import { removeWbot } from "../../libs/wbot";
import { deleteSessionFiles } from "../../helpers/authState";
import DeleteBaileysService from "../BaileysServices/DeleteBaileysService";

const DeleteWhatsAppService = async (id: string): Promise<void> => {
  const whatsapp = await Whatsapp.findOne({
    where: { id }
  });

  if (!whatsapp) {
    throw new AppError("ERR_NO_WAPP_FOUND", 404);
  }

  try {
    await removeWbot(Number(id), true);
  } catch (err) {
    // Ignore error if wbot was already removed or not initialized
  }

  await DeleteBaileysService(id);
  await deleteSessionFiles(id);
  await whatsapp.destroy();
};

export default DeleteWhatsAppService;
