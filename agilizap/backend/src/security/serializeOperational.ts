const hidden = new Set(["password", "passwordHash", "resetPassword", "resetTokenHash", "resetTokenExpiresAt",
  "tokenVersion", "prompt", "queueIntegration", "queueIntegrations", "jsonContent", "session", "token", "qrcode", "apiKey", "voiceKey", "clientSecret", "accessToken", "refreshToken"]);
export const redactOperational = (value: any): any => {
  if (value == null || typeof value !== "object" || value instanceof Date || Buffer.isBuffer(value)) return value;
  if (Array.isArray(value)) return value.map(redactOperational);
  return Object.fromEntries(Object.entries(value).filter(([key]) => !hidden.has(key)).map(([key, item]) => [key, redactOperational(item)]));
};
