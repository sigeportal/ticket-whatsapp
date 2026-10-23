import { validateRuntimeConfig } from "./security/config";
import { securityHeaders, trustedOrigin } from "./middleware/securityHttp";
import { publicAssets } from "./middleware/publicAssets";
import privateMedia from "./middleware/privateMedia";
import * as Sentry from "@sentry/node";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import "express-async-errors";
import "reflect-metadata";
import "./bootstrap";

import bodyParser from 'body-parser';
import uploadConfig from "./config/upload";
import "./database";
import AppError from "./errors/AppError";
import { messageQueue, sendScheduledMessages } from "./queues";
import routes from "./routes";
import { logger } from "./utils/logger";

Sentry.init({ dsn: process.env.SENTRY_DSN, beforeSend(event) {
  delete event.request;
  delete event.breadcrumbs;
  return event;
} });

validateRuntimeConfig();
const app = express();
app.disable("x-powered-by");
// Accept only explicit proxy IPs/subnets, never arbitrary hop counts or forwarded addresses.
if (process.env.TRUSTED_PROXIES) app.set("trust proxy", process.env.TRUSTED_PROXIES.split(",").map(p => p.trim()));
app.use(securityHeaders);

app.set("queues", {
  messageQueue,
  sendScheduledMessages
});

const bodyparser = require('body-parser');
app.use(bodyParser.json({ limit: '10mb' }));

const allowedOrigins = [
  process.env.FRONTEND_URL,
  ...(process.env.NODE_ENV !== "production" ? ["http://localhost:3000", "http://localhost:3001"] : [])
];

app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    }
  })
);
app.use(cookieParser());
app.use(trustedOrigin);
app.use(express.json());
app.use(Sentry.Handlers.requestHandler());
app.use("/assets", publicAssets);
app.use("/public/logotipos", publicAssets);
app.use("/public", privateMedia);
app.use(routes);

app.use(Sentry.Handlers.errorHandler());

app.use(async (err: Error, req: Request, res: Response, _: NextFunction) => {
  if (err instanceof AppError) {
    logger.warn({ event: "request_denied", code: err.message, status: err.statusCode, actorId: req.user?.id, companyId: req.user?.companyId });
    return res.status(err.statusCode).json({ error: err.message });
  }

  if ((err as any).code?.startsWith("LIMIT_")) return res.status(413).json({ error: "ERR_UPLOAD_LIMIT" });
  logger.error({ event: "request_failed", name: err.name });
  return res.status(500).json({ error: "Internal server error" });
});

export default app;
