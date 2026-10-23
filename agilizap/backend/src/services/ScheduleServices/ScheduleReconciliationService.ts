import { Op } from "sequelize";
import moment from "moment";
import Schedule from "../../models/Schedule";
import AppError from "../../errors/AppError";
import { logAuditEvent } from "../../security/audit";
import { getIO } from "../../libs/socket";

interface ReconcileOptions {
  companyId?: number;
  gracePeriodSeconds?: number;
}

export const reconcileOverdueSchedules = async (
  options: ReconcileOptions = {}
): Promise<Schedule[]> => {
  const { companyId, gracePeriodSeconds = 60 } = options;
  const cutoff = moment().subtract(gracePeriodSeconds, "seconds").toDate();

  const whereCondition: any = {
    status: {
      [Op.in]: ["PENDENTE", "AGENDADA"]
    },
    sentAt: null,
    sendAt: {
      [Op.lt]: cutoff
    }
  };

  if (companyId) {
    whereCondition.companyId = companyId;
  }

  const overdueSchedules = await Schedule.findAll({
    where: whereCondition
  });

  const updatedSchedules: Schedule[] = [];

  for (const schedule of overdueSchedules) {
    const previousStatus = schedule.status;
    const previousSendAt = schedule.sendAt;

    await schedule.update({
      status: "EM_REVISAO",
      interruptionReason: "Agendamento vencido durante indisponibilidade do sistema; requer revisao humana"
    });

    try {
      await logAuditEvent({
        companyId: schedule.companyId,
        resource: "schedule",
        action: "flag_overdue_review",
        result: "success",
        targetId: schedule.id,
        details: {
          previousStatus,
          originalSendAt: previousSendAt,
          detectedAt: new Date(),
          gracePeriodSeconds
        }
      });
    } catch (auditErr) {
      // Non-fatal logging
    }

    try {
      const io = getIO();
      io.to(`company-${schedule.companyId}-admin`)
        .to(`user-${schedule.userId}`)
        .emit("schedule", {
          action: "update",
          schedule
        });
    } catch (socketErr) {
      // Ignored if socket not initialized in test harness
    }

    updatedSchedules.push(schedule);
  }

  return updatedSchedules;
};

interface ReviewScheduleRequest {
  scheduleId: number | string;
  companyId: number;
  userId: number;
  action: "approve" | "cancel";
}

export const reviewSchedule = async ({
  scheduleId,
  companyId,
  userId,
  action
}: ReviewScheduleRequest): Promise<Schedule> => {
  const schedule = await Schedule.findOne({
    where: { id: scheduleId, companyId }
  });

  if (!schedule) {
    throw new AppError("ERR_NO_SCHEDULE_FOUND", 404);
  }

  if (schedule.status !== "EM_REVISAO") {
    throw new AppError("ERR_SCHEDULE_NOT_IN_REVIEW", 400);
  }

  if (action === "approve") {
    await schedule.update({
      status: "PENDENTE",
      sendAt: new Date(),
      reviewedBy: userId,
      reviewedAt: new Date(),
      interruptionReason: null
    });

    await logAuditEvent({
      companyId,
      userId,
      resource: "schedule",
      action: "review_approve",
      result: "success",
      targetId: schedule.id,
      details: {
        message: "Envio de agendamento vencido aprovado manualmente por operador",
        newSendAt: schedule.sendAt
      }
    });
  } else if (action === "cancel") {
    await schedule.update({
      status: "CANCELADA",
      reviewedBy: userId,
      reviewedAt: new Date()
    });

    await logAuditEvent({
      companyId,
      userId,
      resource: "schedule",
      action: "review_cancel",
      result: "success",
      targetId: schedule.id,
      details: {
        message: "Envio de agendamento vencido cancelado por operador"
      }
    });
  } else {
    throw new AppError("ERR_INVALID_REVIEW_ACTION", 400);
  }

  try {
    const io = getIO();
    io.to(`company-${companyId}-admin`)
      .to(`user-${schedule.userId}`)
      .emit("schedule", {
        action: "update",
        schedule
      });
  } catch (socketErr) {
    // Ignored in tests
  }

  return schedule;
};
