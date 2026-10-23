import { Request, Response } from "express";
import AppError from "../errors/AppError";
import {
  listQueueWaitAlerts,
  checkAndTriggerQueueWaitAlerts
} from "../services/TicketServices/QueueWaitAlertService";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, profile, id } = req.user;

  if (profile !== "admin" && profile !== "supervisor") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const { status, queueId } = req.query as Record<string, string>;

  try {
    const alerts = await listQueueWaitAlerts(
      companyId,
      req.user as any,
      {
        status,
        queueId: queueId ? Number(queueId) : undefined
      }
    );

    return res.status(200).json(alerts);
  } catch (err: any) {
    if (err.message === "ERR_NO_PERMISSION") {
      throw new AppError("ERR_NO_PERMISSION", 403);
    }
    throw err;
  }
};

export const checkOverdue = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, profile } = req.user;

  if (profile !== "admin" && profile !== "supervisor") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const alerts = await checkAndTriggerQueueWaitAlerts({
    companyId
  });

  return res.status(200).json({
    message: "Verificação de tempo de espera realizada com sucesso",
    triggeredCount: alerts.length,
    alerts
  });
};
