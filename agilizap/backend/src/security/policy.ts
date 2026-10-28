import AppError from "../errors/AppError";
export const roles = ["user", "supervisor", "admin"];
export const deny = (): never => { throw new AppError("ERR_NO_PERMISSION", 403); };
export const canAccessTicket = (actor: any, ticket: any): boolean =>
  !!ticket && Number(actor.companyId) === Number(ticket.companyId) &&
  (actor.profile === "admin" || (ticket.queueId != null &&
    actor.queues?.some((queue: any) => Number(queue.id) === Number(ticket.queueId))));
export function validatePassword(password: unknown): asserts password is string {
  if (typeof password !== "string" || password.length < 8 || Buffer.byteLength(password, "utf8") > 72 ||
      !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    throw new AppError("ERR_PASSWORD_POLICY", 400);
  }
}
export const personalFields = ["name", "email", "password"];
export const adminFields = [...personalFields, "profile", "companyId", "queueIds", "whatsappId", "allTicket", "blocked"];
export const validateUserChange = (actor: any, target: any, data: any): void => {
  if (!actor || !target || actor.companyId !== target.companyId || target.super && !actor.super) deny();
  if (target.super && process.env.PLATFORM_MAINTENANCE_ENABLED !== "true") {
    // Self-service may change personal data and queue membership, never protected privileges.
    if (actor.profile !== "admin" || Number(actor.id) !== Number(target.id) ||
        (data.profile !== undefined && data.profile !== target.profile) ||
        (data.blocked !== undefined && data.blocked !== target.blocked)) deny();
  }
  if (actor.profile !== "admin" && Number(actor.id) !== Number(target.id)) deny();
  const allowed = actor.profile === "admin" ? adminFields : personalFields;
  if (Object.keys(data).some(key => !allowed.includes(key))) deny();
  if (data.companyId !== undefined && Number(data.companyId) !== actor.companyId) deny();
  if (data.blocked !== undefined && typeof data.blocked !== "boolean") deny();
  if (data.profile !== undefined && !roles.includes(data.profile)) deny();
  if (data.password !== undefined && data.password !== "") validatePassword(data.password);
};
