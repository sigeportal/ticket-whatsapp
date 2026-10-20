import ListWhatsAppsService from "../WhatsappService/ListWhatsAppsService";
import { StartWhatsAppSession } from "./StartWhatsAppSession";
import * as Sentry from "@sentry/node";
import fs from "fs";
import path from "path";
import { getSessionDir } from "../../helpers/authState";

export const StartAllWhatsAppsSessions = async (
  companyId: number
): Promise<void> => {
  try {
    const whatsapps = await ListWhatsAppsService({ companyId });
    if (whatsapps.length > 0) {
      whatsapps.forEach(whatsapp => {
        const sessionDir = getSessionDir(whatsapp.id);
        const hasSessionFiles = fs.existsSync(path.join(sessionDir, "creds.json"));

        // Inicia automaticamente apenas canais que estavam conectados ou possuem credenciais salvas
        if (whatsapp.status !== "DISCONNECTED" || hasSessionFiles) {
          StartWhatsAppSession(whatsapp, companyId);
        }
      });
    }
  } catch (e) {
    Sentry.captureException(e);
  }
};
