import * as Sentry from "@sentry/node";
import makeWASocket, {
  WASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  isJidBroadcast,
  jidNormalizedUser,
  CacheStore,
  Browsers
} from "@whiskeysockets/baileys";
import { Op } from "sequelize";
import Whatsapp from "../models/Whatsapp";
import { logger } from "../utils/logger";
import MAIN_LOGGER from "@whiskeysockets/baileys/lib/Utils/logger";
import authState, { deleteSessionFiles } from "../helpers/authState";
import { Boom } from "@hapi/boom";
import AppError from "../errors/AppError";
import { getIO } from "./socket";
import { Store } from "./store";
import DeleteBaileysService from "../services/BaileysServices/DeleteBaileysService";
import NodeCache from "node-cache";
import Contact from "../models/Contact";
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
const startingSessions = new Map<number, symbol>();
const retriesQrCodeMap = new Map<number, number>();
const MAX_RECONNECT_ATTEMPTS = 10;
const STABLE_CONNECTION_MS = 60_000;

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
      reconnectRetriesMap.delete(whatsappId);
      retriesQrCodeMap.delete(whatsappId);
    }
  } catch (err) {
    logger.error(`Error in removeWbot for #${whatsappId}: ${err}`);
  }
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
      where: { companyId },
      attributes: ["id"]
    });

    for (const c of whatsapps) {
      await removeWbot(c.id, false);
    }
  } catch (err) {
    logger.error(`Error in restartWbot for company #${companyId}: ${err}`);
  }
};

/**
 * Agenda reconexão de forma segura com verificação de status no banco
 */
const updateConnectionStatus = async (whatsapp: Whatsapp, status: string): Promise<void> => {
  await whatsapp.update({ status, qrcode: "" });
  getIO().to(`company-${whatsapp.companyId}-admin`).emit(
    `company-${whatsapp.companyId}-whatsappSession`,
    { action: "update", session: whatsapp }
  );
};

const scheduleReconnect = async (
  whatsapp: Whatsapp,
  reason: number | string
): Promise<void> => {
  const { id } = whatsapp;
  const attempts = reconnectRetriesMap.get(id) || 0;
  if (attempts >= MAX_RECONNECT_ATTEMPTS) {
    logger.warn(`WhatsApp #${id}: automatic reconnect paused after ${attempts} attempts (reason: ${reason}).`);
    await updateConnectionStatus(whatsapp, "RECONNECT_PAUSED");
    return;
  }

  const delay = reason === DisconnectReason.restartRequired && attempts === 0
    ? 1000
    : calculateBackoff(attempts);
  logger.info(`WhatsApp #${id}: scheduling reconnect in ${delay}ms (reason: ${reason}).`);
  const statusUpdate = updateConnectionStatus(whatsapp, "RECONNECTING").catch(err => {
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
      if (!currentWapp || currentWapp.status !== "RECONNECTING") return;
      logger.info(`WhatsApp #${id}: reconnect attempt ${attempt}/${MAX_RECONNECT_ATTEMPTS} (reason: ${reason}).`);
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
  if (!reconnecting) reconnectRetriesMap.delete(id);
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

    const { version, isLatest } = await fetchLatestBaileysVersion({ timeout: 10_000 });
    logger.info(`Using WA v${version.join(".")}, isLatest: ${isLatest}. Starting session "${name}" (#${id}).`);

    const { state, saveState } = await authState(whatsappUpdate);
    if (startingSessions.get(id) !== start) return;

    const msgRetryCounterCache = new NodeCache();
    const userDevicesCache: CacheStore = new NodeCache();

    const wsocket: Session = makeWASocket({
      logger: loggerBaileys,
      printQRInTerminal: false,
      browser: Browsers.ubuntu("Chrome"),
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      version,
      msgRetryCounterCache,
      shouldIgnoreJid: jid => isJidBroadcast(jid),
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
    });

    wsocket.id = whatsappUpdate.id;

    // Registra a sessão ativa em memória
    const existingIndex = sessions.findIndex(s => s.id === id);
    if (existingIndex !== -1) {
      sessions[existingIndex] = wsocket;
    } else {
      sessions.push(wsocket);
    }

    // Suporte a Pairing Code (Código de 8 dígitos) quando explicitamente solicitado
    if (!state.creds.registered && pairingRequested && whatsappUpdate.number) {
      const cleanNumber = whatsappUpdate.number.replace(/\D/g, "");
      if (cleanNumber.length >= 10) {
        setTimeout(async () => {
          try {
            if (sessions.includes(wsocket) && !wsocket.authState.creds.registered) {
              const code = await wsocket.requestPairingCode(cleanNumber);
              if (!sessions.includes(wsocket)) return;
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
        if (!sessions.includes(wsocket)) return;
        logger.info(`[Socket #${id} - ${name}] Connection Update: ${connection || "pending"} | QR: ${!!qr}`);

        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;

        if (connection === "open") {
          clearReconnectTimeout(id);
          if (reconnectRetriesMap.has(id) && !stableConnectionTimers.has(id)) {
            stableConnectionTimers.set(id, setTimeout(() => {
              stableConnectionTimers.delete(id);
              if (sessions.includes(wsocket)) reconnectRetriesMap.delete(id);
            }, STABLE_CONNECTION_MS));
          }
          retriesQrCodeMap.delete(id);

          const number = jidNormalizedUser(wsocket.user?.id || "").split("@")[0];

          await whatsappUpdate.update({
            status: "CONNECTED",
            qrcode: "",
            retries: 0,
            number: number || whatsappUpdate.number,
            session: "connected"
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
        logger.warn(`[Socket #${id} - ${name}] Connection closed with status code: ${statusCode} (${lastDisconnect?.error?.message ?? "unknown"})`);

          // 401: Logged Out pelo dispositivo
          if (statusCode === DisconnectReason.loggedOut) {
            await whatsappUpdate.update({
              status: "DISCONNECTED",
              session: "",
              qrcode: "",
              number: ""
            });
            await removeWbot(id, true);
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

          // 403: Forbidden / Banido
          if (statusCode === 403) {
            logger.error(`[Socket #${id} - ${name}] Access forbidden or number banned (403).`);
            await whatsappUpdate.update({
              status: "DISCONNECTED",
              session: "",
              qrcode: ""
            });
            await removeWbot(id, true);
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

          // 440: Connection Replaced (aberto em outra sessão/navegador)
          if (statusCode === DisconnectReason.connectionReplaced) {
            logger.warn(`[Socket #${id} - ${name}] Connection replaced by another session (440).`);
            await whatsappUpdate.update({
              status: "DISCONNECTED",
              qrcode: ""
            });
            await removeWbot(id, false);

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
      }
    );

    // 2. Creds update listener
    wsocket.ev.on("creds.update", saveState);

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

    return wsocket;
  } catch (error) {
    if (startingSessions.get(id) !== start) return;
    Sentry.captureException(error);
    logger.error(`initWASocket error: ${error}`);
    void removeWbot(id, false);
    await scheduleReconnect(whatsapp, "startup failure").catch(err => logger.error(err));
  } finally {
    if (startingSessions.get(id) === start) startingSessions.delete(id);
  }
};
