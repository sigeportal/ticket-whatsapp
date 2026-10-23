import { verify } from "jsonwebtoken";
import authConfig from "../config/auth";
import User from "../models/User";
import Company from "../models/Company";
import Queue from "../models/Queue";
import AppError from "../errors/AppError";
import { roles } from "./policy";
export const loadSession = async (token: string, refresh = false): Promise<User> => {
  try {
    const claims = verify(token, refresh ? authConfig.refreshSecret : authConfig.secret,
      { algorithms: ["HS256"] }) as any;
    const user = await User.findByPk(claims.id, { include: [Queue, Company] });
    if (!user || user.tokenVersion !== claims.tokenVersion || user.companyId !== claims.companyId ||
        !user.company || user.blocked || user.company?.status === false || !roles.includes(user.profile)) throw new Error();
    return user;
  } catch (_) { throw new AppError("ERR_SESSION_EXPIRED", 401); }
};
