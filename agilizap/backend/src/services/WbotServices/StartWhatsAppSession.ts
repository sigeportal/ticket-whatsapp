import { initWASocket } from "../../libs/wbot";
import Whatsapp from "../../models/Whatsapp";
import { wbotMessageListener } from "./wbotMessageListener";
import wbotMonitor from "./wbotMonitor";
import { logger } from "../../utils/logger";
import * as Sentry from "@sentry/node";

export const StartWhatsAppSession = async (
  whatsapp: Whatsapp,
  companyId: number,
  reconnecting = false
): Promise<void> => {
  try {
    const wbot = await initWASocket(whatsapp, reconnecting);
    if (!wbot) return;
    wbotMessageListener(wbot, companyId);
    await wbotMonitor(wbot, whatsapp, companyId);
  } catch (err) {
    Sentry.captureException(err);
    logger.error(`Error starting WhatsApp session #${whatsapp.id}: ${err}`);
  }
};
