import pino from 'pino';
import moment from 'moment-timezone';

// Função para obter o timestamp com fuso horário
const timezoned = () => {
  return moment().tz(process.env.TZ || 'America/Campo_Grande').format('DD-MM-YYYY HH:mm:ss');
};

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "token",
  "refreshtoken",
  "secret",
  "jwt",
  "authorization",
  "cookie",
  "apikey",
  "gemini_api_key",
  "openai_api_key",
  "db_pass",
  "redis_password"
]);

/**
 * Sanitizes arbitrary objects or data payloads to prevent accidental credential leakage in logs.
 */
export function sanitizeLogData(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizeLogData);
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey)) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeLogData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

const logger = pino({
  redact: {
    paths: [
      "password",
      "passwordHash",
      "token",
      "refreshToken",
      "authorization",
      "cookie",
      "secret",
      "*.password",
      "*.passwordHash",
      "*.token",
      "*.refreshToken",
      "*.authorization",
      "*.secret",
      "*.jwt",
      "*.apiKey",
      "headers.authorization",
      "headers.cookie"
    ],
    censor: "[REDACTED]"
  },
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      levelFirst: true,
      translateTime: 'SYS:dd-mm-yyyy HH:MM:ss',
      ignore: "pid,hostname"
    },
  },
  timestamp: () => `,"time":"${timezoned()}"`,
});

export { logger };
