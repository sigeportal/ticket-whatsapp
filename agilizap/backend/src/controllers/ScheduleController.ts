import { confinedPath } from "../security/media";
import uploadConfig from "../config/upload";
import { Request, Response } from "express";
import { getIO } from "../libs/socket";

import AppError from "../errors/AppError";

import CreateService from "../services/ScheduleServices/CreateService";
import ListService from "../services/ScheduleServices/ListService";
import UpdateService from "../services/ScheduleServices/UpdateService";
import ShowService from "../services/ScheduleServices/ShowService";
import DeleteService from "../services/ScheduleServices/DeleteService";
import { reviewSchedule, reconcileOverdueSchedules } from "../services/ScheduleServices/ScheduleReconciliationService";
import Schedule from "../models/Schedule";
import path from "path";
import fs from "fs";
import { head } from "lodash";

type IndexQuery = {
  searchParam?: string;
  contactId?: number | string;
  userId?: number | string;
  pageNumber?: string | number;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { contactId, userId, pageNumber, searchParam } = req.query as IndexQuery;
  const { companyId } = req.user;

  const { schedules, count, hasMore } = await ListService({
    searchParam,
    contactId,
    userId: req.user.profile === "admin" ? userId : req.user.id,
    pageNumber,
    companyId
  });

  return res.json({ schedules, count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const {
    body,
    sendAt,
    contactId,
    userId,
    sendConfirmation,
    confirmationMessage
  } = req.body;
  const { companyId } = req.user;

  const schedule = await CreateService({
    body,
    sendAt,
    contactId,
    companyId,
    userId,
    sendConfirmation,
    confirmationMessage
  });

  const io = getIO();
  io.to(`user-${schedule.userId}`)
    .to(`company-${companyId}-admin`)
    .to(`company-${companyId}-mainchannel`)
    .emit(`company-${companyId}-schedule`, {
      action: "create",
      schedule
    });

  return res.status(200).json(schedule);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { scheduleId } = req.params;
  const { companyId } = req.user;

  const schedule = await ShowService(scheduleId, companyId);

  return res.status(200).json(schedule);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (req.user.profile !== "admin" && req.user.profile !== "supervisor") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const { scheduleId } = req.params;
  const scheduleData = req.body;
  const { companyId } = req.user;

  const schedule = await UpdateService({ scheduleData, id: scheduleId, companyId });

  const io = getIO();
  io.to(`user-${schedule.userId}`)
    .to(`company-${companyId}-admin`)
    .to(`company-${companyId}-mainchannel`)
    .emit(`company-${companyId}-schedule`, {
      action: "update",
      schedule
    });

  return res.status(200).json(schedule);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { scheduleId } = req.params;
  const { companyId } = req.user;

  await DeleteService(scheduleId, companyId);

  const io = getIO();
  io.to(`company-${companyId}-admin`)
    .to(`company-${companyId}-mainchannel`)
    .emit(`company-${companyId}-schedule`, {
      action: "delete",
      scheduleId
    });

  return res.status(200).json({ message: "Schedule deleted" });
};

export const review = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (req.user.profile !== "admin" && req.user.profile !== "supervisor") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const { scheduleId } = req.params;
  const { action } = req.body;
  const { companyId, id: userId } = req.user;

  const schedule = await reviewSchedule({
    scheduleId,
    companyId,
    userId: Number(userId),
    action
  });

  return res.status(200).json(schedule);
};

export const reconcile = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (req.user.profile !== "admin" && req.user.profile !== "supervisor") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const { companyId } = req.user;
  const schedules = await reconcileOverdueSchedules({ companyId });

  return res.status(200).json({ count: schedules.length, schedules });
};

export const mediaUpload = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  const files = req.files as Express.Multer.File[];
  const file = head(files);

  try {
    const schedule = await Schedule.findByPk(id);
    schedule.mediaPath = file.filename;
    schedule.mediaName = file.originalname;

    await schedule.save();
    return res.send({ mensagem: "Arquivo Anexado" });
  } catch (err: any) {
    throw new AppError(err.message);
  }
};

export const deleteMedia = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;

  try {
    const schedule = await Schedule.findByPk(id);
    const filePath = confinedPath(uploadConfig.directory, schedule.mediaPath);
    const fileExists = fs.existsSync(filePath);
    if (fileExists) {
      fs.unlinkSync(filePath);
    }
    schedule.mediaPath = null;
    schedule.mediaName = null;
    await schedule.save();
    return res.send({ mensagem: "Arquivo Excluído" });
  } catch (err: any) {
    throw new AppError(err.message);
  }
};
