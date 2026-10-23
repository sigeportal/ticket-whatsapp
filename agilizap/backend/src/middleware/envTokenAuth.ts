import { Request, Response, NextFunction } from "express";
import AppError from "../errors/AppError";
const envTokenAuth = (_req: Request, _res: Response, _next: NextFunction): void => {
  throw new AppError("ERR_PUBLIC_SIGNUP_DISABLED", 403);
};
export default envTokenAuth;
