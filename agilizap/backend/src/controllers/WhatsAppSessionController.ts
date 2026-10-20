import { Request, Response } from "express";
import { getWbot, removeWbot } from "../libs/wbot";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";
import { StartWhatsAppSession } from "../services/WbotServices/StartWhatsAppSession";
import UpdateWhatsAppService from "../services/WhatsappService/UpdateWhatsAppService";
import DeleteBaileysService from "../services/BaileysServices/DeleteBaileysService";
import { deleteSessionFiles } from "../helpers/authState";

import AppError from "../errors/AppError";

const store = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;

  const whatsapp = await ShowWhatsAppService(whatsappId, companyId);
  await StartWhatsAppSession(whatsapp, companyId);

  return res.status(200).json({ message: "Starting session." });
};

const update = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;

  // Limpa socket e arquivos da sessão anterior para gerar um QR Code limpo
  await removeWbot(+whatsappId, false);
  await DeleteBaileysService(+whatsappId);
  await deleteSessionFiles(+whatsappId);

  const whatsapp = await ShowWhatsAppService(whatsappId, companyId);
  await whatsapp.update({ session: "", qrcode: "", status: "qrcode", number: "" });

  await StartWhatsAppSession(whatsapp, companyId);

  return res.status(200).json({ message: "Starting session." });
};

const requestPairing = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { phoneNumber } = req.body;
  const { companyId } = req.user;

  const cleanNumber = (phoneNumber || "").replace(/\D/g, "");
  if (!cleanNumber || cleanNumber.length < 10) {
    throw new AppError("Número de telefone inválido para pareamento. Informe DDI + DDD + Número.");
  }

  // Limpa socket e arquivos da sessão anterior para geração limpa do código
  await removeWbot(+whatsappId, false);
  await DeleteBaileysService(+whatsappId);
  await deleteSessionFiles(+whatsappId);

  const whatsapp = await ShowWhatsAppService(whatsappId, companyId);
  await whatsapp.update({ session: "", qrcode: "", status: "pairing", number: cleanNumber });

  await StartWhatsAppSession(whatsapp, companyId);

  return res.status(200).json({ message: "Iniciando pareamento com código." });
};

const remove = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;
  const whatsapp = await ShowWhatsAppService(whatsappId, companyId);

  await whatsapp.update({ status: "DISCONNECTED", session: "", qrcode: "", number: "" });

  try {
    const wbot = getWbot(whatsapp.id);
    await wbot.logout();
  } catch (err) {
    // Socket was already disconnected or not initialized
  }

  await removeWbot(whatsapp.id, false);
  await DeleteBaileysService(whatsapp.id);
  await deleteSessionFiles(whatsapp.id);

  return res.status(200).json({ message: "Session disconnected." });
};

export default { store, remove, update, requestPairing };
