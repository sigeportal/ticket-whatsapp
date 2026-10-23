import nodemailer from "nodemailer";
import User from "../../models/User";
import { newResetToken, hashResetToken, RESET_TTL_MS } from "../../security/passwordReset";
import { logger } from "../../utils/logger";
const SendMail = async (email: string): Promise<void> => {
  if (typeof email !== "string" || email.length > 254) return;
  const user = await User.findOne({ where: { email } });
  if (!user || user.blocked) return;
  const token = newResetToken();
  const digest = hashResetToken(token);
  try {
    const port = Number(process.env.MAIL_PORT || 587);
    if (!process.env.MAIL_HOST || !process.env.MAIL_FROM || !process.env.MAIL_USER || !process.env.MAIL_PASS ||
        ![465, 587].includes(port)) throw new Error("SMTP configuration");
    await user.update({ resetTokenHash: digest, resetTokenExpiresAt: new Date(Date.now() + RESET_TTL_MS) });
    const transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST, port, secure: port === 465, requireTLS: port === 587,
      auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000
    });
    await transporter.sendMail({
      from: process.env.MAIL_FROM, to: user.email, subject: "Redefinição de senha",
      text: `Código para redefinir sua senha (válido por 30 minutos): ${token}\nAbra o painel e informe o código no formulário de recuperação.`
    });
  } catch (_) {
    await User.update({ resetTokenHash: null, resetTokenExpiresAt: null }, { where: { id: user.id, resetTokenHash: digest } });
    logger.error({ event: "password_reset_delivery_failed", companyId: user.companyId }, "Password reset delivery failed");
  }
};
export default SendMail;
