import { Request, Response, NextFunction } from "express";
import { authorizeRequest } from "../security/authorizeRequest";
import AppError from "../errors/AppError";
import { loadSession } from "../security/session";
const isAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const match = /^Bearer (\S+)$/.exec(req.headers.authorization || "");
  if (!match) throw new AppError("ERR_SESSION_EXPIRED", 401);
  const user = await loadSession(match[1]);
  req.user = { id: String(user.id), profile: user.profile, companyId: user.companyId, email: user.email };
  res.locals.actor = user;
  await authorizeRequest(req, user);
  next();
};
export default isAuth;
