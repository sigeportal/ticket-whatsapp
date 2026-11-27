import path from "path";
import fs from "fs";
import { randomBytes } from "crypto";
import {
  AuthenticationState,
  BufferJSON,
  initAuthCreds,
  proto,
  SignalDataSet,
  SignalDataTypeMap
} from "@whiskeysockets/baileys";
import Whatsapp from "../models/Whatsapp";
import { logger } from "../utils/logger";

// shortcut: atomic multi-file store preserves /app/sessions volume; migrate to Postgres/Redis if running multi-replica backend.
const DEFAULT_SESSIONS_DIR = path.resolve(__dirname, "..", "..", "sessions");
const pathQueues = new Map<string, Promise<unknown>>();

export const getActiveAuthLockCount = (): number => pathQueues.size;

const getSessionsRoot = (): string => process.env.SESSIONS_DIR || DEFAULT_SESSIONS_DIR;

export const getSessionDir = (whatsappId: number | string): string => {
  return path.join(getSessionsRoot(), `whatsapp_${whatsappId}`);
};

const fixFileName = (file: string): string =>
  file?.replace(/\//g, "__")?.replace(/:/g, "-");

const withFileLock = <T>(filePath: string, task: () => Promise<T>): Promise<T> => {
  const prev = pathQueues.get(filePath) || Promise.resolve();
  const next = prev.catch(() => undefined).then(task);
  pathQueues.set(filePath, next);
  next.finally(() => {
    if (pathQueues.get(filePath) === next) {
      pathQueues.delete(filePath);
    }
  });
  return next;
};

const writeFileAtomic = async (
  filePath: string,
  payload: string,
  keepBackup = false
): Promise<void> => {
  const tmpPath = `${filePath}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
  await fs.promises.writeFile(tmpPath, payload, "utf8");
  if (keepBackup) {
    try {
      await fs.promises.copyFile(filePath, `${filePath}.bak`);
    } catch (err: any) {
      if (err?.code !== "ENOENT") {
        logger.warn(`Could not backup ${path.basename(filePath)}: ${err}`);
      }
    }
  }
  try {
    await fs.promises.rename(tmpPath, filePath);
  } catch (err) {
    await fs.promises.rm(tmpPath, { force: true }).catch(() => undefined);
    throw err;
  }
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
        await writeFileAtomic(
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

  const writeData = (data: unknown, file: string): Promise<void> => {
    const filePath = path.join(sessionDir, fixFileName(file));
    return withFileLock(filePath, () =>
      writeFileAtomic(
        filePath,
        JSON.stringify(data, BufferJSON.replacer),
        file === "creds.json"
      )
    );
  };

  const readData = (file: string): Promise<any> => {
    const filePath = path.join(sessionDir, fixFileName(file));
    return withFileLock(filePath, async () => {
      try {
        const raw = await fs.promises.readFile(filePath, { encoding: "utf-8" });
        return JSON.parse(raw, BufferJSON.reviver);
      } catch (err: any) {
        if (file === "creds.json" && err?.code !== "ENOENT") {
          try {
            const backupRaw = await fs.promises.readFile(`${filePath}.bak`, { encoding: "utf-8" });
            const recovered = JSON.parse(backupRaw, BufferJSON.reviver);
            logger.warn(`Recovered corrupted creds.json from backup for WhatsApp #${whatsapp.id}`);
            return recovered;
          } catch {
            // ignore missing/corrupted backup
          }
        }
        return null;
      }
    });
  };

  const removeData = (file: string): Promise<void> => {
    const filePath = path.join(sessionDir, fixFileName(file));
    return withFileLock(filePath, async () => {
      try {
        await fs.promises.unlink(filePath);
      } catch {
        // ignore missing file
      }
    });
  };

  const creds = (await readData("creds.json")) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
          const data: { [id: string]: SignalDataTypeMap[T] } = {};
          await Promise.all(
            ids.map(async id => {
              let value = await readData(`${type}-${id}.json`);
              if (type === "app-state-sync-key" && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              data[id] = value;
            })
          );
          return data;
        },
        set: async (data: SignalDataSet) => {
          const tasks: Promise<void>[] = [];
          for (const category of Object.keys(data) as Array<keyof SignalDataTypeMap>) {
            const entries = data[category];
            if (!entries) continue;
            for (const id of Object.keys(entries)) {
              const value = entries[id];
              const file = `${category}-${id}.json`;
              tasks.push(value ? writeData(value, file) : removeData(file));
            }
          }
          await Promise.all(tasks);
        }
      }
    },
    saveState: () => writeData(creds, "creds.json")
  };
};

export default authState;
