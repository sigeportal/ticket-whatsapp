import path from "path";
import fs from "fs";
import {
  AuthenticationState,
  BufferJSON,
  useMultiFileAuthState
} from "@whiskeysockets/baileys";
import Whatsapp from "../models/Whatsapp";
import { logger } from "../utils/logger";

const SESSIONS_DIR =
  process.env.SESSIONS_DIR || path.resolve(__dirname, "..", "..", "sessions");

export const getSessionDir = (whatsappId: number | string): string => {
  return path.join(SESSIONS_DIR, `whatsapp_${whatsappId}`);
};

export const deleteSessionFiles = async (
  whatsappId: number | string
): Promise<void> => {
  try {
    const sessionDir = getSessionDir(whatsappId);
    if (fs.existsSync(sessionDir)) {
      await fs.promises.rm(sessionDir, { recursive: true, force: true });
      logger.info(`Session files removed for WhatsApp #${whatsappId}`);
    }
  } catch (err) {
    logger.error(`Error deleting session files for WhatsApp #${whatsappId}: ${err}`);
  }
};

const authState = async (
  whatsapp: Whatsapp
): Promise<{ state: AuthenticationState; saveState: () => Promise<void> }> => {
  const sessionDir = getSessionDir(whatsapp.id);

  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  // Migração legada: se o diretório estiver sem creds.json mas houver dados em whatsapp.session
  const credsFile = path.join(sessionDir, "creds.json");
  if (!fs.existsSync(credsFile) && whatsapp.session && whatsapp.session.startsWith("{")) {
    try {
      logger.info(`Migrating legacy database session to file-based auth for WhatsApp #${whatsapp.id}...`);
      const parsed = JSON.parse(whatsapp.session, BufferJSON.reviver);
      if (parsed.creds) {
        fs.writeFileSync(
          credsFile,
          JSON.stringify(parsed.creds, BufferJSON.replacer, 2)
        );
      }
      // Marcar coluna como migrada para evitar re-parse e manter compatibilidade
      await whatsapp.update({ session: "file_session" });
      logger.info(`Legacy session migrated successfully for WhatsApp #${whatsapp.id}`);
    } catch (migErr) {
      logger.warn(`Could not migrate legacy session for WhatsApp #${whatsapp.id}: ${migErr}`);
    }
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  return {
    state,
    saveState: saveCreds
  };
};

export default authState;
