import gracefulShutdown from "http-graceful-shutdown";
import app from "./app";
import { initIO } from "./libs/socket";
import { logger } from "./utils/logger";
import { StartAllWhatsAppsSessions } from "./services/WbotServices/StartAllWhatsAppsSessions";
import Company from "./models/Company";
import { startQueueProcess, stopQueueProcess } from "./queues";
import { TransferTicketQueue } from "./wbotTransferTicketQueue";
import sequelize from "./database";
import cron from "node-cron";

const port = +(process.env.PORT || 8080);
const server = app.listen(port, "0.0.0.0", async () => {
  try {
    const companies = await Company.findAll();
    const sessionPromises = [];

    for (const c of companies) {
      sessionPromises.push(StartAllWhatsAppsSessions(c.id));
    }

    await Promise.all(sessionPromises);
    startQueueProcess();
    logger.info(`Server started on port: ${process.env.PORT}`);
  } catch (error) {
    logger.error("Error starting server:", error);
    process.exit(1);
  }
});

let isShuttingDown = false;

async function handleCriticalError(type: string, error: any) {
  logger.error({
    event: "process_critical_error",
    type,
    message: error?.message || String(error),
    stack: error?.stack
  });

  if (process.env.NODE_ENV === "production" && !isShuttingDown) {
    isShuttingDown = true;
    logger.warn({ event: "supervised_shutdown_initiated", reason: type });
    try {
      await stopQueueProcess();
      await sequelize.close();
    } catch (cleanupErr: any) {
      logger.error({ event: "shutdown_cleanup_error", error: cleanupErr.message });
    }
    process.exit(1);
  }
}

process.on("uncaughtException", err => {
  handleCriticalError("uncaughtException", err);
});

process.on("unhandledRejection", (reason, p) => {
  handleCriticalError("unhandledRejection", reason);
});

const cronJob = cron.schedule("* * * * *", async () => {
  try {
    logger.info(`Serviço de transferência de tickets iniciado`);
    await TransferTicketQueue();
  } catch (error) {
    logger.error("Error in cron job:", error);
  }
});

server.requestTimeout = 60000;
server.headersTimeout = 15000;
initIO(server);

// Configure graceful shutdown to handle all outstanding requests and background workers
gracefulShutdown(server, {
  signals: "SIGINT SIGTERM",
  timeout: 30000, // 30 seconds
  onShutdown: async () => {
    isShuttingDown = true;
    logger.info({ event: "graceful_shutdown_started" });
    try {
      cronJob.stop();
    } catch (e: any) {
      logger.warn(`Erro ao parar cron: ${e.message}`);
    }
    try {
      await stopQueueProcess();
    } catch (e: any) {
      logger.warn(`Erro ao fechar queues: ${e.message}`);
    }
    try {
      await sequelize.close();
    } catch (e: any) {
      logger.warn(`Erro ao fechar banco: ${e.message}`);
    }
  },
  finally: () => {
    logger.info({ event: "graceful_shutdown_complete" });
  }
});
