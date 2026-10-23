import { logger } from "../../utils/logger";
import { validateUserChange } from "../../security/policy";
import { disconnectUser } from "../../libs/socket";
import Queue from "../../models/Queue";
import Whatsapp from "../../models/Whatsapp";
import { literal } from "sequelize";
import * as Yup from "yup";

import AppError from "../../errors/AppError";
import ShowUserService from "./ShowUserService";
import Company from "../../models/Company";
import User from "../../models/User";

interface UserData {
  email?: string;
  password?: string;
  name?: string;
  profile?: string;
  companyId?: number;
  queueIds?: number[];
  whatsappId?: number;
  allTicket?: string;
  blocked?: boolean;
}

interface Request {
  userData: UserData;
  userId: string | number;
  companyId: number;
  requestUserId: number;
}

interface Response {
  id: number;
  name: string;
  email: string;
  profile: string;
}

const UpdateUserService = async ({
  userData,
  userId,
  companyId,
  requestUserId
}: Request): Promise<Response | undefined> => {
  const user = await ShowUserService(userId);

  const requestUser = await User.findByPk(requestUserId);

  validateUserChange(requestUser, user, userData);
  for (const queueId of userData.queueIds || []) {
    if (!await Queue.findOne({ where: { id: queueId, companyId } })) throw new AppError("ERR_NO_PERMISSION", 403);
  }
  if (userData.whatsappId && !await Whatsapp.findOne({ where: { id: userData.whatsappId, companyId } })) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const schema = Yup.object().shape({
    name: Yup.string().min(2),
    email: Yup.string().email(),
    profile: Yup.string(),
    password: Yup.string(),
	allTicket: Yup.string()
  });

  const { email, password, profile, name, queueIds, whatsappId, allTicket, blocked } = userData;

  try {
    await schema.validate({ email, password, profile, name, allTicket });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  await user.update({
    email, blocked,
    password: password || undefined,
    tokenVersion: literal('"tokenVersion" + 1') as any,
    profile,
    name,
    whatsappId: whatsappId === undefined ? user.whatsappId : whatsappId || null,
	allTicket
  });

  if (queueIds !== undefined) await user.$set("queues", queueIds);
  disconnectUser(user.id);
  logger.info({ event: "user_access_updated", actorId: requestUserId, companyId, targetId: user.id,
    fields: Object.keys(userData).filter(key => ["profile", "queueIds", "whatsappId", "allTicket", "blocked"].includes(key)) });

  await user.reload();

  const company = await Company.findByPk(user.companyId);

  const serializedUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    profile: user.profile,
    companyId: user.companyId,
    company,
    queues: user.queues
  };

  return serializedUser;
};

export default UpdateUserService;
