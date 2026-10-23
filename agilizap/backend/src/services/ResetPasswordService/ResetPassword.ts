import { logger } from "../../utils/logger";
import { Op, literal } from "sequelize";
import { hash } from "bcryptjs";
import User from "../../models/User";
import AppError from "../../errors/AppError";
import { validatePassword } from "../../security/policy";
import { hashResetToken } from "../../security/passwordReset";
import { disconnectUser } from "../../libs/socket";
const ResetPassword = async (email: string, token: string, password: string): Promise<void> => {
  validatePassword(password);
  if (typeof email !== "string" || typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) {
    throw new AppError("ERR_INVALID_RESET_TOKEN", 400);
  }
  const passwordHash = await hash(password, 12);
  // Conditional UPDATE consumes the token atomically; never check then write.
  const [count, users] = await User.update({
    passwordHash, mustChangePassword: false, resetTokenHash: null, resetTokenExpiresAt: null,
    tokenVersion: literal('"tokenVersion" + 1') as any
  }, {
    where: { email, resetTokenHash: hashResetToken(token), resetTokenExpiresAt: { [Op.gt]: new Date() } },
    returning: true
  });
  if (count !== 1) throw new AppError("ERR_INVALID_RESET_TOKEN", 400);
  users.forEach(user => {
    disconnectUser(user.id);
    logger.info({ event: "password_reset_completed", companyId: user.companyId, targetId: user.id });
  });
};
export default ResetPassword;
