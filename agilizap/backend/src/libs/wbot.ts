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
const retriesQrCodeMap = new Map<number, number>();

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
    const sessionIndex = sessions.findIndex(s => s.id === whatsappId);

    if (sessionIndex !== -1) {
      const session = sessions[sessionIndex];

      // Remove todos os event listeners para evitar memory leaks
      try {
        session.ev.removeAllListeners("connection.update");
        session.ev.removeAllListeners("creds.update");
        session.ev.removeAllListeners("messages.upsert");
        session.ev.removeAllListeners("messages.update");
        session.ev.removeAllListeners("presence.update");
        session.ws?.removeAllListeners();
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
        if (session.ws) {
          session.ws.close();
        }
      } catch (wsErr) {
        logger.warn(`Error closing websocket for session #${whatsappId}: ${wsErr}`);
      }

      sessions.splice(sessionIndex, 1);
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
export const scheduleReconnect = (
  whatsapp: Whatsapp,
  delayMs: number
): void => {
  clearReconnectTimeout(whatsapp.id);

  const timeout = setTimeout(async () => {
    reconnectTimeoutMap.delete(whatsapp.id);
    try {
      const currentWapp = await Whatsapp.findByPk(whatsapp.id);
      if (!currentWapp || currentWapp.status === "DISCONNECTED") {
        logger.info(`Skipping reconnect for WhatsApp #${whatsapp.id} (status: ${currentWapp?.status || "null"})`);
        return;
      }

      logger.info(`Reconnecting WhatsApp #${whatsapp.id} (${whatsapp.name})...`);
      const { StartWhatsAppSession } = await import(
        "../services/WbotServices/StartWhatsAppSession"
      );
      await StartWhatsAppSession(currentWapp, currentWapp.companyId);
    } catch (err) {
      logger.error(`Error during scheduled reconnect for #${whatsapp.id}: ${err}`);
    }
  }, delayMs);

  reconnectTimeoutMap.set(whatsapp.id, timeout);
};

/**
 * Inicializa a conexão com Baileys Multi-Device com resiliência total
 */
export const initWASocket = async (whatsapp: Whatsapp): Promise<Session> => {
  return new Promise(async (resolve, reject) => {
    try {
      const io = getIO();

      const whatsappUpdate = await Whatsapp.findOne({
        where: { id: whatsapp.id }
      });

      if (!whatsappUpdate) {
        return reject(new Error("WHATSAPP_NOT_FOUND"));
      }

      const { id, name } = whatsappUpdate;

      // Limpa qualquer conexão anterior para evitar sockets órfãos
      await removeWbot(id, false);

      const { version, isLatest } = await fetchLatestBaileysVersion();
      logger.info(`Using WA v${version.join(".")}, isLatest: ${isLatest}. Starting session "${name}" (#${id}).`);

      const { state, saveState } = await authState(whatsappUpdate);

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
      if (!state.creds.registered && whatsappUpdate.status === "pairing" && whatsappUpdate.number) {
        const cleanNumber = whatsappUpdate.number.replace(/\D/g, "");
        if (cleanNumber.length >= 10) {
          setTimeout(async () => {
            try {
              if (!wsocket.authState.creds.registered) {
                const code = await wsocket.requestPairingCode(cleanNumber);
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
          logger.info(`[Socket #${id} - ${name}] Connection Update: ${connection || "pending"} | QR: ${!!qr}`);

          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;

          if (connection === "open") {
            clearReconnectTimeout(id);
            reconnectRetriesMap.delete(id);
            retriesQrCodeMap.delete(id);

            const number = jidNormalizedUser(wsocket.user?.id || "").split("@")[0];

            await whatsappUpdate.update({
              status: "CONNECTED",
              qrcode: "",
              retries: 0,
              number: number || whatsappUpdate.number,
              session: "connected"
            });

            io.to(`company-${whatsappUpdate.companyId}-admin`).emit(
              `company-${whatsappUpdate.companyId}-whatsappSession`,
              {
                action: "update",
                session: whatsappUpdate
              }
            );
          }

          if (connection === "close") {
            logger.warn(`[Socket #${id} - ${name}] Connection closed with status code: ${statusCode}`);

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

            // 500: Bad Session (sessão corrompida)
            if (statusCode === DisconnectReason.badSession) {
              logger.error(`[Socket #${id} - ${name}] Bad session (500). Resetting files.`);
              await whatsappUpdate.update({
                status: "DISCONNECTED",
                session: "",
                qrcode: ""
              });
              await removeWbot(id, true);
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

            // 515: Restart Required (WhatsApp pede reinicialização do handshake)
            if (statusCode === DisconnectReason.restartRequired) {
              logger.info(`[Socket #${id} - ${name}] Restart required (515). Reconnecting in 1000ms...`);
              await removeWbot(id, false);
              scheduleReconnect(whatsappUpdate, 1000);
              return;
            }

            // Outras desconexões de rede (408 TimedOut, 428 ConnectionClosed, falhas temporárias)
            const retries = reconnectRetriesMap.get(id) || 0;
            reconnectRetriesMap.set(id, retries + 1);
            const backoffDelay = calculateBackoff(retries);

            logger.warn(
              `[Socket #${id} - ${name}] Temporary disconnect (${statusCode || "network"}). Scheduling reconnect in ${backoffDelay}ms (attempt #${retries + 1}).`
            );

            await removeWbot(id, false);
            scheduleReconnect(whatsappUpdate, backoffDelay);
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

      resolve(wsocket);
    } catch (error) {
      Sentry.captureException(error);
      logger.error(`initWASocket error: ${error}`);
      reject(error);
    }
  });
};
