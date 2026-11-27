import * as Sentry from "@sentry/node";
import makeWASocket, {
  WASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  isJidBroadcast,
  jidNormalizedUser,
  CacheStore,
  Browsers,
  GroupMetadata,
  proto,
  WAMessageKey
} from "@whiskeysockets/baileys";
import { Op } from "sequelize";
import Whatsapp from "../models/Whatsapp";
import { logger } from "../utils/logger";
import MAIN_LOGGER from "@whiskeysockets/baileys/lib/Utils/logger";
import authState, { deleteSessionFiles, getSessionDir } from "../helpers/authState";
import fs from "fs";
import path from "path";
import { Boom } from "@hapi/boom";
import AppError from "../errors/AppError";
import { getIO } from "./socket";
import { Store } from "./store";
import DeleteBaileysService from "../services/BaileysServices/DeleteBaileysService";
import NodeCache from "node-cache";
import Contact from "../models/Contact";
import Message from "../models/Message";
import Ticket from "../models/Ticket";

const loggerBaileys = MAIN_LOGGER.child({});
loggerBaileys.level = "error";

export type Session = WASocket & {
  id?: number;
  store?: any;
};

const sessions: Session[] = [];
const reconnectTimeoutMap = new Map<number, NodeJS.Timeout>();
const reconnectRetriesMap = new Map<number, number>();
const stableConnectionTimers = new Map<number, NodeJS.Timeout>();
const connectWatchdogTimers = new Map<number, NodeJS.Timeout>();
const startingSessions = new Map<number, symbol>();
const retriesQrCodeMap = new Map<number, number>();
const replacedRetriesMap = new Map<number, number>();
const forbiddenRetriesMap = new Map<number, number>();
const groupMetadataCache = new NodeCache({ stdTTL: 15 * 60, checkperiod: 120, useClones: false });
const msgRetryCounterCache = new NodeCache({ stdTTL: 3600, checkperiod: 300, useClones: false });
const userDevicesCache: CacheStore = new NodeCache({ stdTTL: 300, checkperiod: 120, useClones: false });
const MAX_RECONNECT_ATTEMPTS = 10;
const SLOW_RECONNECT_MS = 180_000;
const MAX_REPLACED_RETRIES = 2;
const REPLACED_RETRY_DELAY_MS = 20_000;
const MAX_FORBIDDEN_RETRIES = 2;
const STABLE_CONNECTION_MS = 60_000;
const CONNECT_WATCHDOG_MS = 65_000;
const WA_VERSION_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const WA_VERSION_FALLBACK_RETRY_MS = 5 * 60 * 1000;
let cachedWaVersion: { version: [number, number, number]; isLatest: boolean; fetchedAt: number } | null = null;

export const clearBaileysVersionCache = (): void => {
  cachedWaVersion = null;
};

export const getCachedBaileysVersion = async (): Promise<{
  version: [number, number, number];
  isLatest: boolean;
}> => {
  const now = Date.now();
  if (cachedWaVersion) {
    const ttl = cachedWaVersion.isLatest ? WA_VERSION_CACHE_TTL_MS : WA_VERSION_FALLBACK_RETRY_MS;
    if (now - cachedWaVersion.fetchedAt < ttl) {
      return { version: cachedWaVersion.version, isLatest: cachedWaVersion.isLatest };
    }
  }
  const { version, isLatest } = await fetchLatestBaileysVersion({ timeout: 10_000 });
  cachedWaVersion = { version, isLatest, fetchedAt: now };
  return { version, isLatest };
};

const clearRetryCounters = (whatsappId: number): void => {
  reconnectRetriesMap.delete(whatsappId);
  retriesQrCodeMap.delete(whatsappId);
  replacedRetriesMap.delete(whatsappId);
  forbiddenRetriesMap.delete(whatsappId);
};

/**
 * Calcula o tempo de espera com backoff exponencial e jitter
 */
const calculateBackoff = (attempt: number): number => {
  const base = 2000;
  const maxDelay = 30000;
  const delay = Math.min(base * Math.pow(1.5, attempt), maxDelay);
  const jitter = Math.floor(Math.random() * 1000);
  return delay + jitter;
};

/**
 * Limpa qualquer agendamento de reconexão pendente para a conexão
 */
const clearReconnectTimeout = (whatsappId: number): void => {
  const timeout = reconnectTimeoutMap.get(whatsappId);
  if (timeout) {
    clearTimeout(timeout);
    reconnectTimeoutMap.delete(whatsappId);
  }
};

/**
 * Cancela o watchdog de handshake pendente para a conexão
 */
const clearConnectWatchdog = (whatsappId: number): void => {
  const timeout = connectWatchdogTimers.get(whatsappId);
  if (timeout) {
    clearTimeout(timeout);
    connectWatchdogTimers.delete(whatsappId);
  }
};

export const getCachedGroupMetadata = async (
  wbot: Session,
  jid: string
): Promise<GroupMetadata> => {
  const cacheKey = `${wbot.id ?? 0}:${jid}`;
  const cached = groupMetadataCache.get<GroupMetadata>(cacheKey);
  if (cached) return cached;
  const meta = await wbot.groupMetadata(jid);
  if (meta) groupMetadataCache.set(cacheKey, meta);
  return meta;
};

export const invalidateGroupMetadataCache = (whatsappId: number, jid: string): void => {
  groupMetadataCache.del(`${whatsappId}:${jid}`);
};

/**
 * Obtém a sessão ativa de um WhatsApp pelo ID
 */
export const getWbot = (whatsappId: number): Session => {
  const sessionIndex = sessions.findIndex(s => s.id === whatsappId);

  if (sessionIndex === -1) {
    throw new AppError("ERR_WAPP_NOT_INITIALIZED");
  }
  return sessions[sessionIndex];
};

/**
 * Destrói e limpa uma sessão de socket, expurgando listeners e fechando conexões
 */
export const removeWbot = async (
  whatsappId: number,
  isLogout = true
): Promise<void> => {
  try {
    clearReconnectTimeout(whatsappId);
    clearConnectWatchdog(whatsappId);
    startingSessions.delete(whatsappId);
    clearTimeout(stableConnectionTimers.get(whatsappId));
    stableConnectionTimers.delete(whatsappId);
    const sessionIndex = sessions.findIndex(s => s.id === whatsappId);

    if (sessionIndex !== -1) {
      const session = sessions[sessionIndex];
      sessions.splice(sessionIndex, 1);

      // Remove todos os event listeners para evitar memory leaks
      try {
        session.ev.removeAllListeners("connection.update");
        session.ev.removeAllListeners("creds.update");
        session.ev.removeAllListeners("messages.upsert");
        session.ev.removeAllListeners("messages.update");
        session.ev.removeAllListeners("presence.update");
        session.ev.removeAllListeners("contacts.upsert");
        session.ev.removeAllListeners("groups.update");
        session.ev.removeAllListeners("group-participants.update");
        session.ws?.removeAllListeners("CB:call");
      } catch (evErr) {
        logger.warn(`Error clearing listeners for session #${whatsappId}: ${evErr}`);
      }

      if (isLogout) {
        try {
          await session.logout();
        } catch (logoutErr) {
          logger.warn(`Error logging out session #${whatsappId}: ${logoutErr}`);
        }
      }

      try {
        session.end(undefined);
      } catch (wsErr) {
        logger.warn(`Error closing websocket for session #${whatsappId}: ${wsErr}`);
      }

    }

    if (isLogout) {
      clearRetryCounters(whatsappId);
    }
  } catch (err) {
    logger.error(`Error in removeWbot for #${whatsappId}: ${err}`);
  }
};

export const closeAllWbots = async (): Promise<void> => {
  const ids = [
    ...new Set([
      ...sessions.map(s => s.id).filter((id): id is number => typeof id === "number"),
      ...reconnectTimeoutMap.keys()
    ])
  ];
  await Promise.allSettled(ids.map(id => removeWbot(id, false)));
};

// Baileys 6.7.24 has async ws.on handlers without try/catch (CB:success, CB:ib,,dirty, pair-device).
export const isTransientBaileysError = (error: any): boolean => {
  if (!error || typeof error !== "object") return false;
  const stack = String(error.stack || "");
  if (!/[\\/]baileys[\\/]lib[\\/]/i.test(stack)) return false;
  if (error.isBoom) return true;
  const code = String(error.code || "");
  const msg = String(error.message || "");
  return (
    /^(ECONNRESET|ETIMEDOUT|EPIPE|ENOTFOUND|EAI_AGAIN|ECONNREFUSED)$/.test(code) ||
    /connection closed|timed out|socket closed|stream errored|websocket error/i.test(msg)
  );
};

/**
 * Reinicia as conexões de uma empresa
 */
export const restartWbot = async (
  companyId: number,
  session?: any
): Promise<void> => {
  try {
    const whatsapps = await Whatsapp.findAll({
      where: { companyId }
    });

    for (const c of whatsapps) {
      await removeWbot(c.id, false);
      clearRetryCounters(c.id);
    }

    const { StartWhatsAppSession } = await import(
      "../services/WbotServices/StartWhatsAppSession"
    );

    for (const c of whatsapps) {
      const hasSessionFiles = fs.existsSync(
        path.join(getSessionDir(c.id), "creds.json")
      );
      if (c.status !== "DISCONNECTED" || hasSessionFiles) {
        logger.info(`WhatsApp #${c.id} (${c.name}): restarting session via restartWbot.`);
        void StartWhatsAppSession(c, companyId, false);
      }
    }
  } catch (err) {
    logger.error(`Error in restartWbot for company #${companyId}: ${err}`);
  }
};

/**
 * Agenda reconexão de forma segura com verificação de status no banco
 */
const updateConnectionStatus = async (
  whatsapp: Whatsapp,
  status: string,
  extra: Partial<{
    disconnectReason: string | null;
    actionRequired: string | null;
    lastDisconnectedAt: Date | null;
  }> = {}
): Promise<void> => {
  await whatsapp.update({ status, qrcode: "", ...extra });
  getIO().to(`company-${whatsapp.companyId}-admin`).emit(
    `company-${whatsapp.companyId}-whatsappSession`,
    { action: "update", session: whatsapp }
  );
};

const scheduleReconnect = async (
  whatsapp: Whatsapp,
  reason: number | string,
  customDelayMs?: number
): Promise<void> => {
  const { id } = whatsapp;
  clearReconnectTimeout(id);
  const attempts = reconnectRetriesMap.get(id) || 0;
  const isSlowRetry = attempts >= MAX_RECONNECT_ATTEMPTS;
  const status = isSlowRetry ? "RECONNECT_PAUSED" : "RECONNECTING";
  const delay = isSlowRetry
    ? SLOW_RECONNECT_MS
    : customDelayMs ??
      (reason === DisconnectReason.restartRequired && attempts === 0
        ? 1000
        : calculateBackoff(attempts));

  if (isSlowRetry) {
    logger.warn(`WhatsApp #${id}: switching to slow reconnect every ${SLOW_RECONNECT_MS}ms after ${attempts} attempts (reason: ${reason}).`);
  } else {
    logger.info(`WhatsApp #${id}: scheduling reconnect in ${delay}ms (reason: ${reason}).`);
  }

  const statusUpdate = updateConnectionStatus(whatsapp, status, {
    disconnectReason: isSlowRetry ? "PERSISTENT_NETWORK_FAILURE" : String(reason),
    actionRequired: isSlowRetry
      ? "Falha de rede persistente. Tentando reconectar automaticamente a cada 3 minutos."
      : "Reconectando automaticamente...",
    lastDisconnectedAt: new Date()
  }).catch(err => {
    logger.error(`Could not update reconnect status for WhatsApp #${id}: ${err}`);
  });

  const timeout = setTimeout(async () => {
    await statusUpdate;
    if (reconnectTimeoutMap.get(id) !== timeout) return;
    const attempt = attempts + 1;
    reconnectRetriesMap.set(id, attempt);
    try {
      const currentWapp = await Whatsapp.findByPk(id);
      const { StartWhatsAppSession } = await import(
        "../services/WbotServices/StartWhatsAppSession"
      );
      if (reconnectTimeoutMap.get(id) !== timeout) return;
      reconnectTimeoutMap.delete(id);
      if (!currentWapp || !["RECONNECTING", "RECONNECT_PAUSED"].includes(currentWapp.status)) return;
      logger.info(`WhatsApp #${id}: reconnect attempt ${attempt} (${status}, reason: ${reason}).`);
      await StartWhatsAppSession(currentWapp, currentWapp.companyId, true);
    } catch (err) {
      logger.error(`Error during scheduled reconnect for #${id}: ${err}`);
      if (reconnectTimeoutMap.get(id) === timeout) {
        reconnectTimeoutMap.delete(id);
        await scheduleReconnect(whatsapp, "startup failure").catch(error => logger.error(error));
      }
    }
  }, delay);

  reconnectTimeoutMap.set(id, timeout);
  await statusUpdate;
};

/**
 * Inicializa a conexão com Baileys Multi-Device com resiliência total
 */
export const initWASocket = async (
  whatsapp: Whatsapp,
  reconnecting = false
): Promise<Session | undefined> => {
  const { id, name } = whatsapp;
  if (startingSessions.has(id)) return;
  const cleanup = removeWbot(id, false);
  const start = Symbol();
  startingSessions.set(id, start);
  if (!reconnecting) clearRetryCounters(id);
  try {
    await cleanup;
    if (startingSessions.get(id) !== start) return;
    const io = getIO();

    const whatsappUpdate = await Whatsapp.findOne({
      where: { id: whatsapp.id }
    });

    if (startingSessions.get(id) !== start || !whatsappUpdate) return;
    const pairingRequested = whatsappUpdate.status === "pairing";
    if (!reconnecting) await updateConnectionStatus(whatsappUpdate, "OPENING");
    if (startingSessions.get(id) !== start) return;

    const { version, isLatest } = await getCachedBaileysVersion();
    logger.info(`Using WA v${version.join(".")}, isLatest: ${isLatest}. Starting session "${name}" (#${id}).`);

    const { state, saveState } = await authState(whatsappUpdate);
    if (startingSessions.get(id) !== start) return;

    const wsocket: Session = makeWASocket({
      logger: loggerBaileys,
      printQRInTerminal: false,
      browser: Browsers.ubuntu("Chrome"),
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, loggerBaileys),
      },
      version,
      msgRetryCounterCache,
      userDevicesCache,
      syncFullHistory: false,
      shouldSyncHistoryMessage: () => false,
      markOnlineOnConnect: false,
      shouldIgnoreJid: jid => isJidBroadcast(jid),
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 30000,
      cachedGroupMetadata: async (jid: string) => {
        const cacheKey = `${id}:${jid}`;
        const cached = groupMetadataCache.get<GroupMetadata>(cacheKey);
        if (cached) return cached;
        const active = sessions.find(s => s.id === id);
        if (!active) return undefined;
        try {
          const meta = await active.groupMetadata(jid);
          if (meta) groupMetadataCache.set(cacheKey, meta);
          return meta;
        } catch {
          return undefined;
        }
      },
      getMessage: async (key: WAMessageKey): Promise<proto.IMessage | undefined> => {
        if (!key?.id) return undefined;
        try {
          const msg = await Message.findOne({
            where: { id: key.id, companyId: whatsappUpdate.companyId },
            attributes: ["dataJson"]
          });
          if (!msg?.dataJson) return undefined;
          const parsed = JSON.parse(msg.dataJson);
          if (!parsed?.message) return undefined;
          return proto.Message.fromObject(parsed.message);
        } catch (err) {
          logger.warn(`[Socket #${id}] getMessage failed for ${key.id}: ${err}`);
          return undefined;
        }
      },
    });

    wsocket.id = whatsappUpdate.id;

    // Registra a sessão ativa em memória
    const existingIndex = sessions.findIndex(s => s.id === id);
    if (existingIndex !== -1) {
      sessions[existingIndex] = wsocket;
    } else {
      sessions.push(wsocket);
    }

    // Watchdog: evita sessões presas indefinidamente em "connecting" após queda de rede
    clearConnectWatchdog(id);
    const connectWatchdog = setTimeout(async () => {
      try {
        connectWatchdogTimers.delete(id);
        if (!sessions.includes(wsocket)) return;
        logger.warn(`[Socket #${id} - ${name}] Connection handshake timed out in connecting state. Forcing reconnect.`);
        await removeWbot(id, false);
        const currentWapp = await Whatsapp.findByPk(id);
        if (currentWapp && currentWapp.status !== "DISCONNECTED") {
          await scheduleReconnect(currentWapp, "connect watchdog timeout")
            .catch(err => logger.error(`Could not schedule watchdog reconnect for #${id}: ${err}`));
        }
      } catch (err) {
        Sentry.captureException(err);
        logger.error(`[Socket #${id} - ${name}] Error in connectWatchdog: ${err}`);
      }
    }, CONNECT_WATCHDOG_MS);
    connectWatchdogTimers.set(id, connectWatchdog);

    // Suporte a Pairing Code (Código de 8 dígitos) quando explicitamente solicitado
    if (!state.creds.registered && pairingRequested && whatsappUpdate.number) {
      const cleanNumber = whatsappUpdate.number.replace(/\D/g, "");
      if (cleanNumber.length >= 10) {
        setTimeout(async () => {
          try {
            if (sessions.includes(wsocket) && !wsocket.authState.creds.registered) {
              const code = await wsocket.requestPairingCode(cleanNumber);
              if (!sessions.includes(wsocket)) return;
              clearConnectWatchdog(id);
              logger.info(`Pairing Code generated for WhatsApp #${id} (${cleanNumber}): ${code}`);
              await whatsappUpdate.update({
                qrcode: code,
                status: "qrcode",
                retries: 0
              });
              io.to(`company-${whatsappUpdate.companyId}-admin`).emit(
                `company-${whatsappUpdate.companyId}-whatsappSession`,
                {
                  action: "update",
                  session: whatsappUpdate
                }
              );
            }
          } catch (errPair) {
            logger.warn(`Could not request pairing code for #${id}: ${errPair}`);
          }
        }, 3500);
      }
    }

    // 1. Connection Update Listener
    wsocket.ev.on(
      "connection.update",
      async ({ connection, lastDisconnect, qr }) => {
        try {
          if (!sessions.includes(wsocket)) return;
          logger.info(`[Socket #${id} - ${name}] Connection Update: ${connection || "pending"} | QR: ${!!qr}`);

          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;

          if (connection === "open") {
            clearReconnectTimeout(id);
            clearConnectWatchdog(id);
            const hasRetryCounter =
              reconnectRetriesMap.has(id) ||
              replacedRetriesMap.has(id) ||
              forbiddenRetriesMap.has(id);
            if (hasRetryCounter && !stableConnectionTimers.has(id)) {
              stableConnectionTimers.set(id, setTimeout(() => {
                stableConnectionTimers.delete(id);
                if (sessions.includes(wsocket)) clearRetryCounters(id);
              }, STABLE_CONNECTION_MS));
            }
            retriesQrCodeMap.delete(id);

            const number = jidNormalizedUser(wsocket.user?.id || "").split("@")[0];

            await whatsappUpdate.update({
              status: "CONNECTED",
              qrcode: "",
              retries: 0,
              number: number || whatsappUpdate.number,
              session: "connected",
              disconnectReason: null,
              actionRequired: null
            });

            if (!sessions.includes(wsocket)) return;
            io.to(`company-${whatsappUpdate.companyId}-admin`).emit(
              `company-${whatsappUpdate.companyId}-whatsappSession`,
              {
                action: "update",
                session: whatsappUpdate
              }
            );
          }

          if (connection === "close") {
            clearConnectWatchdog(id);
            logger.warn(`[Socket #${id} - ${name}] Connection closed with status code: ${statusCode} (${lastDisconnect?.error?.message ?? "unknown"})`);

            // 401: Logged Out pelo dispositivo
            if (statusCode === DisconnectReason.loggedOut) {
              await whatsappUpdate.update({
                status: "DISCONNECTED",
                session: "",
                qrcode: "",
                number: "",
                disconnectReason: "LOGGED_OUT",
                actionRequired: "Sessão encerrada no aparelho. Escaneie o QR Code novamente para conectar.",
                lastDisconnectedAt: new Date()
              });
              await removeWbot(id, false);
              clearRetryCounters(id);
              await DeleteBaileysService(id);
              await deleteSessionFiles(id);

              io.to(`company-${whatsappUpdate.companyId}-admin`).emit(
                `company-${whatsappUpdate.companyId}-whatsappSession`,
                {
                  action: "update",
                  session: whatsappUpdate
                }
              );
              return;
            }

            // 403: Forbidden / Banido (tenta recuperar antes de desistir e preserva creds.json)
            if (statusCode === 403) {
              const forbiddenAttempts = (forbiddenRetriesMap.get(id) || 0) + 1;
              forbiddenRetriesMap.set(id, forbiddenAttempts);
              if (forbiddenAttempts <= MAX_FORBIDDEN_RETRIES) {
                logger.warn(`[Socket #${id} - ${name}] Received 403 (${forbiddenAttempts}/${MAX_FORBIDDEN_RETRIES}). Retrying without wiping session files.`);
                await removeWbot(id, false);
                await scheduleReconnect(whatsappUpdate, 403)
                  .catch(err => logger.error(`Could not reconnect WhatsApp #${id} after 403: ${err}`));
                return;
              }

              logger.error(`[Socket #${id} - ${name}] Access forbidden or number banned (403) after ${forbiddenAttempts} attempts.`);
              await whatsappUpdate.update({
                status: "DISCONNECTED",
                qrcode: "",
                disconnectReason: "BANNED_OR_FORBIDDEN",
                actionRequired: "Acesso proibido ou número suspenso pelo WhatsApp (403). Verifique a linha ou gere um novo QR Code.",
                lastDisconnectedAt: new Date()
              });
              await removeWbot(id, false);
              clearRetryCounters(id);

              io.to(`company-${whatsappUpdate.companyId}-admin`).emit(
                `company-${whatsappUpdate.companyId}-whatsappSession`,
                {
                  action: "update",
                  session: whatsappUpdate
                }
              );
              return;
            }

            // 440: Connection Replaced (permite retentativas atrasadas para conflito transitório)
            if (statusCode === DisconnectReason.connectionReplaced) {
              const replacedAttempts = (replacedRetriesMap.get(id) || 0) + 1;
              replacedRetriesMap.set(id, replacedAttempts);
              if (replacedAttempts <= MAX_REPLACED_RETRIES) {
                logger.warn(`[Socket #${id} - ${name}] Connection replaced (440, ${replacedAttempts}/${MAX_REPLACED_RETRIES}). Scheduling delayed reconnect.`);
                await removeWbot(id, false);
                await scheduleReconnect(whatsappUpdate, DisconnectReason.connectionReplaced, REPLACED_RETRY_DELAY_MS)
                  .catch(err => logger.error(`Could not reconnect WhatsApp #${id} after 440: ${err}`));
                return;
              }

              logger.warn(`[Socket #${id} - ${name}] Connection replaced by another session (440) after ${replacedAttempts} attempts.`);
              await whatsappUpdate.update({
                status: "DISCONNECTED",
                qrcode: "",
                disconnectReason: "CONNECTION_REPLACED",
                actionRequired: "Sessão conectada em outro navegador ou dispositivo. Reconecte para assumir o controle.",
                lastDisconnectedAt: new Date()
              });
              await removeWbot(id, false);
              clearRetryCounters(id);

              io.to(`company-${whatsappUpdate.companyId}-admin`).emit(
                `company-${whatsappUpdate.companyId}-whatsappSession`,
                {
                  action: "update",
                  session: whatsappUpdate
                }
              );
              return;
            }

            // Baileys also reports 500 for unrecognized stream errors.
            void removeWbot(id, false);
            await scheduleReconnect(whatsappUpdate, statusCode ?? "unknown")
              .catch(err => logger.error(`Could not reconnect WhatsApp #${id}: ${err}`));
            return;
          }

          if (qr !== undefined) {
            clearConnectWatchdog(id);
            const currentRetries = retriesQrCodeMap.get(id) || 0;

            if (currentRetries >= 5) {
              logger.info(`[Socket #${id} - ${name}] Reached maximum QR code attempts (5). Setting DISCONNECTED.`);
              await whatsappUpdate.update({
                status: "DISCONNECTED",
                qrcode: ""
              });
              await removeWbot(id, false);
              retriesQrCodeMap.delete(id);

              io.to(`company-${whatsappUpdate.companyId}-admin`).emit(
                `company-${whatsappUpdate.companyId}-whatsappSession`,
                {
                  action: "update",
                  session: whatsappUpdate
                }
              );
            } else {
              retriesQrCodeMap.set(id, currentRetries + 1);
              logger.info(`[Socket #${id} - ${name}] QR code attempt ${currentRetries + 1}/5 generated.`);

              await whatsappUpdate.update({
                qrcode: qr,
                status: "qrcode",
                retries: 0
              });

              io.to(`company-${whatsappUpdate.companyId}-admin`).emit(
                `company-${whatsappUpdate.companyId}-whatsappSession`,
                {
                  action: "update",
                  session: whatsappUpdate
                }
              );
            }
          }
        } catch (err) {
          Sentry.captureException(err);
          logger.error(`[Socket #${id} - ${name}] connection.update error: ${err}`);
        }
      }
    );

    // 2. Creds update listener
    wsocket.ev.on("creds.update", async () => {
      try {
        await saveState();
      } catch (err) {
        Sentry.captureException(err);
        logger.error(`creds.update saveState error for #${id}: ${err}`);
      }
    });

    // 3. Presence update listener
    wsocket.ev.on(
      "presence.update",
      async ({ id: remoteJid, presences }) => {
        try {
          if (!presences[remoteJid]?.lastKnownPresence) {
            return;
          }
          const contact = await Contact.findOne({
            where: {
              number: remoteJid.replace(/\D/g, ""),
              companyId: whatsappUpdate.companyId
            }
          });
          if (!contact) {
            return;
          }
          const ticket = await Ticket.findOne({
            where: {
              contactId: contact.id,
              whatsappId: whatsappUpdate.id,
              status: {
                [Op.or]: ["open", "pending"]
              }
            }
          });

          if (ticket) {
            io.to(ticket.id.toString())
              .to(`company-${whatsappUpdate.companyId}-${ticket.status}`)
              .to(`queue-${ticket.queueId}-${ticket.status}`)
              .emit(`company-${whatsappUpdate.companyId}-presence`, {
                ticketId: ticket.id,
                presence: presences[remoteJid].lastKnownPresence
              });
          }
        } catch (error) {
          logger.error(`presence.update error for #${id}: ${error}`);
        }
      }
    );

    wsocket.ev.on("groups.update", updates => {
      for (const u of updates) {
        if (u.id) invalidateGroupMetadataCache(id, u.id);
      }
    });

    wsocket.ev.on("group-participants.update", ({ id: groupJid }) => {
      if (groupJid) invalidateGroupMetadataCache(id, groupJid);
    });

    return wsocket;
  } catch (error) {
    clearConnectWatchdog(id);
    if (startingSessions.get(id) !== start) return;
    Sentry.captureException(error);
    logger.error(`initWASocket error: ${error}`);
    void removeWbot(id, false);
    await scheduleReconnect(whatsapp, "startup failure").catch(err => logger.error(err));
  } finally {
    if (startingSessions.get(id) === start) startingSessions.delete(id);
  }
};
