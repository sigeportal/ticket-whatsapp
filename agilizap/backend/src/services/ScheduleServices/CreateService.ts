import * as Yup from "yup";

import AppError from "../../errors/AppError";
import Schedule from "../../models/Schedule";
import { sendScheduleNotification } from "./SendScheduleNotificationService";

interface Request {
  body: string;
  sendAt: string;
  contactId: number | string;
  companyId: number | string;
  userId?: number | string;
  sendConfirmation?: boolean;
  confirmationMessage?: string;
}

const CreateService = async ({
  body,
  sendAt,
  contactId,
  companyId,
  userId,
  sendConfirmation,
  confirmationMessage
}: Request): Promise<Schedule> => {
  const schema = Yup.object().shape({
    body: Yup.string().required().min(5),
    sendAt: Yup.string().required()
  });

  try {
    await schema.validate({ body, sendAt });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const schedule = await Schedule.create(
    {
      body,
      sendAt,
      contactId,
      companyId,
      userId,
      status: 'PENDENTE'
    }
  );

  await schedule.reload();

  if (sendConfirmation) {
    await sendScheduleNotification({
      contactId,
      companyId,
      userId,
      sendAt,
      body,
      confirmationMessage
    });
  }

  return schedule;
};

export default CreateService;
