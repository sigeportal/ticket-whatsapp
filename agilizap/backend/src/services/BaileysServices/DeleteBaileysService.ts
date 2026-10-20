import Baileys from "../../models/Baileys";
import { deleteSessionFiles } from "../../helpers/authState";

const DeleteBaileysService = async (id: string | number): Promise<void> => {
  const baileysData = await Baileys.findOne({
    where: {
      whatsappId: id
    }
  });

  if (baileysData) {
    await baileysData.destroy();
  }

  await deleteSessionFiles(id);
};

export default DeleteBaileysService;
