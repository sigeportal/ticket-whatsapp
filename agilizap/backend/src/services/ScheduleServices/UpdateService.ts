import * as Yup from "yup";
import moment from "moment";
import AppError from "../../errors/AppError";
import Schedule from "../../models/Schedule";
import ShowService from "./ShowService";
import { sendScheduleNotification } from "./SendScheduleNotificationService";

interface ScheduleData {
  id?: number;
  body?: string;
  sendAt?: string;
  sentAt?: string;
  contactId?: number;
  companyId?: number;
  ticketId?: number;
  userId?: number;
  status?: string;
  sendConfirmation?: boolean;
  confirmationMessage?: string;
}

interface Request {
  scheduleData: ScheduleData;
  id: string | number;
  companyId: number;
}

const UpdateUserService = async ({
  scheduleData,
  id,
  companyId
}: Request): Promise<Schedule | undefined> => {
  const schedule = await ShowService(id, companyId);

  if (schedule?.companyId !== companyId) {
    throw new AppError("Não é possível alterar registros de outra empresa");
  }

  const schema = Yup.object().shape({
    body: Yup.string().min(5)
  });

  const {
    body,
    sendAt,
    sentAt,
    contactId,
    ticketId,
    userId,
    status,
    sendConfirmation,
    confirmationMessage
  } = scheduleData;

  try {
    await schema.validate({ body });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const updatePayload: any = {
    body,
    sendAt,
    sentAt,
    contactId,
    ticketId,
    userId
  };

  if (status) {
    updatePayload.status = status;
  } else if (sendAt && moment(sendAt).isAfter(moment())) {
    // Rescheduled into future: reset to PENDENTE
    updatePayload.status = "PENDENTE";
    updatePayload.interruptionReason = null;
  }

  await schedule.update(updatePayload);

  await schedule.reload();

  if (sendConfirmation) {
    await sendScheduleNotification({
      contactId: schedule.contactId,
      companyId: schedule.companyId,
      userId: schedule.userId,
      sendAt: schedule.sendAt,
      body: schedule.body,
      confirmationMessage
    });
  }

  return schedule;
};

export default UpdateUserService;
