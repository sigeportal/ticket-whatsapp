import { logger } from "../utils/logger";
import { Request, Response } from "express";
import SendMail from "../services/ForgotPassWordServices/SendMail";
import ResetPassword from "../services/ResetPasswordService/ResetPassword";
export const store = async (req: Request, res: Response): Promise<Response> => {
  try { await SendMail(req.body.email); } catch (_) { logger.error({ event: "password_reset_request_failed" }); }
  return res.status(202).json({ message: "Se a conta existir, enviaremos as instruções de recuperação." });
};
export const resetPasswords = async (req: Request, res: Response): Promise<Response> => {
  await ResetPassword(req.body.email, req.body.token, req.body.password);
  return res.status(200).json({ message: "Senha redefinida com sucesso" });
};
