import { Request, Response } from "express";
import sequelize from "../database";
import Whatsapp from "../models/Whatsapp";
import Message from "../models/Message";
import QueueWaitAlert from "../models/QueueWaitAlert";
import Company from "../models/Company";
import { messageQueue, sendScheduledMessages, campaignQueue } from "../queues";
import { OperationalAlertService } from "../services/OperationServices/OperationalAlertService";
import { logger } from "../utils/logger";
import { Op } from "sequelize";

export class HealthController {
  /**
   * Fast liveness probe. Returns 200 as long as the Express process is active.
   */
  static async live(_req: Request, res: Response): Promise<Response> {
    return res.status(200).json({
      status: "ok",
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Readiness probe. Tests essential database and cache dependencies with strict timeouts.
   * Does NOT expose any sensitive credentials, URLs, or connection strings.
   */
  static async ready(_req: Request, res: Response): Promise<Response> {
    const checks: { database: string; redis: string } = {
      database: "unknown",
      redis: "unknown"
    };

    let isHealthy = true;

    // 1. Database check with 3s timeout
    try {
      const dbPromise = sequelize.query("SELECT 1;");
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("DB_TIMEOUT")), 3000)
      );
      await Promise.race([dbPromise, timeoutPromise]);
      checks.database = "healthy";
    } catch (err: any) {
      isHealthy = false;
      checks.database = err.message === "DB_TIMEOUT" ? "timeout" : "unhealthy";
      logger.warn({ event: "readiness_db_failed", error: err.message });
    }

    // 2. Redis/Cache check with 3s timeout
    try {
      // Test Bull queue redis client ping if available
      const redisClient = (messageQueue as any).client;
      if (redisClient && typeof redisClient.ping === "function") {
        const pingPromise = redisClient.ping();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("REDIS_TIMEOUT")), 3000)
        );
        await Promise.race([pingPromise, timeoutPromise]);
        checks.redis = "healthy";
      } else {
        // In environments where redisClient is mocked or disabled
        checks.redis = "healthy";
      }
    } catch (err: any) {
      isHealthy = false;
      checks.redis = err.message === "REDIS_TIMEOUT" ? "timeout" : "unhealthy";
      logger.warn({ event: "readiness_redis_failed", error: err.message });
    }

    const statusCode = isHealthy ? 200 : 503;
    return res.status(statusCode).json({
      status: isHealthy ? "ok" : "degraded",
      checks,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Independent WhatsApp connection observability.
   * Separated from core application health so that a disconnected phone session
   * does not mark the entire API or web service as down.
   */
  static async whatsapp(req: Request, res: Response): Promise<Response> {
    try {
      const whereCompany = req.user?.companyId ? { companyId: req.user.companyId } : {};
      const connections = await Whatsapp.findAll({
        where: whereCompany,
        attributes: ["id", "name", "status", "companyId", "updatedAt", "isDefault"]
      });

      const summary = {
        total: connections.length,
        connected: connections.filter(c => c.status === "CONNECTED").length,
        disconnected: connections.filter(c => c.status === "DISCONNECTED").length,
        qrcode: connections.filter(c => c.status === "qrcode").length,
        other: connections.filter(c => !["CONNECTED", "DISCONNECTED", "qrcode"].includes(c.status)).length
      };

      return res.status(200).json({
        status: "ok",
        summary,
        connections
      });
    } catch (err: any) {
      logger.error({ event: "health_whatsapp_error", error: err.message });
      return res.status(500).json({ error: "ERR_FETCHING_WHATSAPP_HEALTH" });
    }
  }

  /**
   * Comprehensive operational metrics endpoint.
   */
  static async metrics(_req: Request, res: Response): Promise<Response> {
    try {
      // 1. Memory metrics
      const mem = process.memoryUsage();
      const memory = {
        rssMb: Math.round(mem.rss / (1024 * 1024)),
        heapTotalMb: Math.round(mem.heapTotal / (1024 * 1024)),
        heapUsedMb: Math.round(mem.heapUsed / (1024 * 1024))
      };

      // 2. Queue metrics (safe counts)
      let queues: any = { status: "active" };
      try {
        if (messageQueue && typeof (messageQueue as any).getJobCounts === "function") {
          queues.messageQueue = await (messageQueue as any).getJobCounts();
        }
        if (sendScheduledMessages && typeof (sendScheduledMessages as any).getJobCounts === "function") {
          queues.scheduledQueue = await (sendScheduledMessages as any).getJobCounts();
        }
      } catch {
        // Mocks or in-memory
      }

      // 3. Messages reliability counts
      const messageStats = {
        failed: await Message.count({ where: { status: "failed" } }).catch(() => 0),
        uncertain: await Message.count({ where: { status: "uncertain" } }).catch(() => 0),
        pending: await Message.count({ where: { status: "pending" } }).catch(() => 0)
      };

      // 4. Active Queue Wait Alerts
      const unresolvedAlerts = await QueueWaitAlert.count({
        where: { resolvedAt: null }
      }).catch(() => 0);

      // 5. AI Monthly Spend summary
      const aiCompanies = await Company.findAll({
        attributes: ["id", "name", "aiMonthlyBudgetLimit", "aiMonthlySpent", "aiBudgetPeriod"]
      }).catch(() => []);

      // 6. Operational alerts check
      const alertsEval = await OperationalAlertService.evaluateOperationalAlerts().catch(() => ({
        timestamp: new Date().toISOString(),
        alerts: [],
        systemHealthy: true
      }));

      return res.status(200).json({
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        memory,
        queues,
        messageStats,
        unresolvedQueueAlerts: unresolvedAlerts,
        aiSpend: aiCompanies.map(c => ({
          companyId: c.id,
          name: c.name,
          budgetLimit: c.aiMonthlyBudgetLimit,
          spent: c.aiMonthlySpent,
          period: c.aiBudgetPeriod
        })),
        activeOperationalAlerts: alertsEval.alerts
      });
    } catch (err: any) {
      logger.error({ event: "health_metrics_error", error: err.message });
      return res.status(500).json({ error: "ERR_FETCHING_METRICS" });
    }
  }
}
