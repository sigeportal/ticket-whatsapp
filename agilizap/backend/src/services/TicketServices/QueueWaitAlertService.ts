import { Op } from "sequelize";
import { randomUUID } from "crypto";
import Ticket from "../../models/Ticket";
import Queue from "../../models/Queue";
import User from "../../models/User";
import UserQueue from "../../models/UserQueue";
import QueueWaitAlert from "../../models/QueueWaitAlert";
import AuditLog from "../../models/AuditLog";
import { calculateBusinessMinutesBetween } from "../ScheduleServices/BusinessHoursService";
import { logger } from "../../utils/logger";
import { getIO } from "../../libs/socket";

export const WAIT_TIME_ALERT_THRESHOLD_MINUTES = 10; // OPS-04: 10 minutos de expediente

export interface CheckQueueWaitOptions {
  now?: Date;
  holidays?: string[];
  companyId?: number;
}

export const checkAndTriggerQueueWaitAlerts = async (
  options?: CheckQueueWaitOptions
): Promise<QueueWaitAlert[]> => {
  const now = options?.now ?? new Date();
  const holidays = options?.holidays ?? [];
  const triggeredAlerts: QueueWaitAlert[] = [];

  const whereCondition: any = {
    queueId: { [Op.ne]: null }
  };
  if (options?.companyId) {
    whereCondition.companyId = options.companyId;
  }

  // Buscar tickets em espera de resposta humana:
  // 1. Status 'pending' com fila definida (aguardando atendimento)
  // 2. Status 'open' onde a última mensagem é do cliente e ainda não houve resposta humana subsequente
  const waitingTickets = await Ticket.findAll({
    where: {
      ...whereCondition,
      [Op.or]: [
        { status: "pending" },
        {
          status: "open",
          lastClientMessageAt: { [Op.ne]: null }
        }
      ]
    },
    include: [
      { model: Queue, as: "queue", attributes: ["id", "name"] }
    ]
  });

  for (const ticket of waitingTickets) {
    // Se o ticket estiver 'open', verificar se a última mensagem do cliente foi após a última resposta humana
    if (ticket.status === "open") {
      const clientMsgTime = ticket.lastClientMessageAt ? new Date(ticket.lastClientMessageAt).getTime() : 0;
      const humanRespTime = ticket.lastHumanResponseAt ? new Date(ticket.lastHumanResponseAt).getTime() : 0;
      if (clientMsgTime <= humanRespTime) {
        continue; // Cliente já foi respondido
      }
    }

    // Ancorar o momento inicial da espera:
    // Começa na entrada na fila humana ou na primeira mensagem pendente do cliente
    const waitingSince = ticket.lastClientMessageAt
      ? new Date(ticket.lastClientMessageAt)
      : new Date(ticket.createdAt || now);

    const businessMinutes = calculateBusinessMinutesBetween(waitingSince, now, holidays);

    if (businessMinutes >= WAIT_TIME_ALERT_THRESHOLD_MINUTES) {
      // Garantir identificador único para o episódio de espera ativo
      let episodeId = ticket.currentWaitEpisodeId;
      if (!episodeId) {
        episodeId = randomUUID();
        await ticket.update({ currentWaitEpisodeId: episodeId });
      }

      // Desduplicação estrita: verificar se já existe alerta emitido para este episódio
      const existingAlert = await QueueWaitAlert.findOne({
        where: {
          ticketId: ticket.id,
          episodeId
        }
      });

      if (existingAlert) {
        continue; // Já alertado neste episódio, NÃO reenviar a cada verificação
      }

      // Identificar os supervisores responsáveis pela fila do ticket
      const supervisorUsers = await User.findAll({
        where: {
          companyId: ticket.companyId,
          profile: "supervisor"
        },
        include: [
          {
            model: Queue,
            as: "queues",
            where: { id: ticket.queueId },
            required: true
          }
        ],
        attributes: ["id", "name", "email"]
      });

      let recipientUserIds: number[] = supervisorUsers.map(s => s.id);

      // Destinatário substituto: se a fila não possuir nenhum supervisor ativo, alertar os administradores
      if (recipientUserIds.length === 0) {
        const admins = await User.findAll({
          where: {
            companyId: ticket.companyId,
            profile: "admin"
          },
          attributes: ["id"]
        });
        recipientUserIds = admins.map(a => a.id);
        logger.warn(
          `[QueueWaitAlertService] Fila ${ticket.queueId} sem supervisores. Alerta escalado para administradores: ${recipientUserIds.join(", ")}`
        );
      }

      const alertRecord = await QueueWaitAlert.create({
        ticketId: ticket.id,
        companyId: ticket.companyId,
        queueId: ticket.queueId,
        episodeId,
        waitingSince,
        alertedAt: now,
        businessMinutesWaiting: businessMinutes,
        recipientUserIds,
        status: "pending_response"
      });

      triggeredAlerts.push(alertRecord);

      // Notificação em tempo real via Socket.IO restrita aos supervisores/admins autorizados da fila
      try {
        const io = getIO();
        if (io) {
          recipientUserIds.forEach(userId => {
            io.to(`user-${userId}`).emit(`company-${ticket.companyId}-queue-alert`, {
              action: "waitAlert",
              alert: alertRecord,
              ticketId: ticket.id,
              queueId: ticket.queueId,
              queueName: ticket.queue?.name || "Setor",
              businessMinutesWaiting: businessMinutes
            });
          });
        }
      } catch (ioErr) {
        logger.warn(`[QueueWaitAlertService] Socket emit falhou: ${ioErr}`);
      }

      // Registro de auditoria seguro
      try {
        await AuditLog.create({
          companyId: ticket.companyId,
          userId: recipientUserIds[0] || null,
          userEmail: "system@internal",
          userRole: "system",
          resource: "tickets",
          action: "queue_wait_alert",
          result: "success",
          detailsJson: {
            ticketId: ticket.id,
            queueId: ticket.queueId,
            episodeId,
            businessMinutesWaiting: businessMinutes,
            recipientsCount: recipientUserIds.length
          }
        });
      } catch (audErr) {
        logger.warn(`[QueueWaitAlertService] Erro ao gravar auditoria de alerta: ${audErr}`);
      }

      logger.info(
        `[QueueWaitAlertService] Alerta de espera disparado: Ticket ${ticket.id}, Fila ${ticket.queueId}, ${businessMinutes} min úteis de espera.`
      );
    }
  }

  return triggeredAlerts;
};

export const resolveQueueWaitAlert = async (
  ticketId: number,
  userId?: number,
  resolvedAt: Date = new Date()
): Promise<void> => {
  try {
    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) return;

    await ticket.update({
      lastHumanResponseAt: resolvedAt,
      currentWaitEpisodeId: null
    });

    await QueueWaitAlert.update(
      {
        status: "resolved",
        resolvedAt,
        resolvedByUserId: userId || null
      },
      {
        where: {
          ticketId,
          status: "pending_response"
        }
      }
    );
  } catch (err: any) {
    logger.error(`[QueueWaitAlertService] Erro ao resolver alerta de espera do ticket ${ticketId}: ${err?.message || err}`);
  }
};

export const listQueueWaitAlerts = async (
  companyId: number,
  actor: { id: number; profile: string; queues?: Array<{ id: number }> },
  filter?: { status?: string; queueId?: number }
): Promise<QueueWaitAlert[]> => {
  if (actor.profile !== "admin" && actor.profile !== "supervisor") {
    throw new Error("ERR_NO_PERMISSION");
  }

  const where: any = { companyId };
  if (filter?.status) where.status = filter.status;

  if (actor.profile === "supervisor") {
    const allowedQueueIds = (actor.queues || []).map(q => Number(q.id));
    if (filter?.queueId) {
      if (!allowedQueueIds.includes(Number(filter.queueId))) {
        throw new Error("ERR_NO_PERMISSION");
      }
      where.queueId = filter.queueId;
    } else {
      where.queueId = { [Op.in]: allowedQueueIds };
    }
  } else if (filter?.queueId) {
    where.queueId = filter.queueId;
  }

  return QueueWaitAlert.findAll({
    where,
    order: [["alertedAt", "DESC"]],
    include: [
      { model: Ticket, as: "ticket", attributes: ["id", "status", "lastMessage", "updatedAt"] },
      { model: Queue, as: "queue", attributes: ["id", "name", "color"] }
    ]
  });
};
