import { Request, Response, NextFunction } from "express";
import { deny } from "../security/policy";
import { logger } from "../utils/logger";
const isSuper = (req: Request, res: Response, next: NextFunction): void => {
  const allowed = res.locals.actor?.super && req.user.profile === "admin" && process.env.PLATFORM_MAINTENANCE_ENABLED === "true";
  logger.info({ event: "platform_maintenance_access", actorId: req.user.id, companyId: req.user.companyId,
    method: req.method, route: req.route?.path, allowed: !!allowed });
  if (!allowed) deny();
  next();
};
export default isSuper;
