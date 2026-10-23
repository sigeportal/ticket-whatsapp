import { Request, Response, NextFunction } from "express";

import AppError from "../errors/AppError";
import Company from "../models/Company";
import Whatsapp from "../models/Whatsapp";

type HeaderParams = {
  Bearer: string;
};

const tokenAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const match = /^Bearer (\S{32,})$/.exec(req.headers.authorization || "");
    if (!match) throw new Error();
    const token = match[1];
    const whatsapp = await Whatsapp.findOne({ where: { token } });
    if (whatsapp && (await Company.findByPk(whatsapp.companyId))?.status !== false) {
      req.params = {
        whatsappId: whatsapp.id.toString()
      }
    } else {
      throw new Error();
    }
  } catch (err) {
    throw new AppError(
      "Acesso não permitido",
      401
    );
  }

  return next();
};

export default tokenAuth;
