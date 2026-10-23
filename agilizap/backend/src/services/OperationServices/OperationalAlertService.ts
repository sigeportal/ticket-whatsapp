import fs from "fs";
import { Op } from "sequelize";
import Whatsapp from "../../models/Whatsapp";
import Message from "../../models/Message";
import QueueWaitAlert from "../../models/QueueWaitAlert";
import Company from "../../models/Company";
import { logger } from "../../utils/logger";

export interface AlertEvaluationResult {
  timestamp: string;
  alerts: OperationalAlertItem[];
  systemHealthy: boolean;
}

export interface OperationalAlertItem {
  id: string;
  type: "WHATSAPP_DISCONNECTED" | "MESSAGE_DELIVERY_FAILURE" | "QUEUE_WAIT_OVERDUE" | "DISK_SPACE_HIGH" | "AI_BUDGET_EXCEEDED";
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  message: string;
  details: any;
  actionRequired: string;
}

// In-memory alert cache to prevent alert flooding/duplicate spam
const activeAlerts = new Map<string, { lastAlertedAt: number; count: number }>();

export class OperationalAlertService {
  /**
   * Evaluates system operational conditions and generates deduplicated alerts.
   */
  static async evaluateOperationalAlerts(): Promise<AlertEvaluationResult> {
    const alerts: OperationalAlertItem[] = [];
    const now = Date.now();

    // 1. WhatsApp Disconnections (> 5 minutes in DISCONNECTED status)
    try {
      const fiveMinutesAgo = new Date(now - 5 * 60 * 1000);
      const disconnectedWhatsapps = await Whatsapp.findAll({
        where: {
          status: "DISCONNECTED",
          updatedAt: { [Op.lte]: fiveMinutesAgo }
        }
      });

      for (const w of disconnectedWhatsapps) {
        alerts.push({
          id: `whatsapp_disconnected_${w.id}`,
          type: "WHATSAPP_DISCONNECTED",
          severity: "HIGH",
          message: `Conexão WhatsApp "${w.name}" (ID ${w.id}) desconectada há mais de 5 minutos.`,
          details: { whatsappId: w.id, companyId: w.companyId, lastUpdate: w.updatedAt },
          actionRequired: "Acessar o painel administrativo e escanear o QR Code ou verificar conectividade do aparelho."
        });
      }
    } catch (e: any) {
      logger.warn({ event: "alert_eval_whatsapp_error", error: e.message });
    }

    // 2. Message Delivery Failures / Uncertain status
    try {
      const failedMessagesCount = await Message.count({
        where: {
          status: { [Op.in]: ["failed", "uncertain"] }
        }
      });

      if (failedMessagesCount > 0) {
        alerts.push({
          id: `message_failures_${failedMessagesCount}`,
          type: "MESSAGE_DELIVERY_FAILURE",
          severity: failedMessagesCount > 10 ? "HIGH" : "MEDIUM",
          message: `${failedMessagesCount} mensagem(ns) em estado de falha ou incerto requerem atenção do operador.`,
          details: { failedCount: failedMessagesCount },
          actionRequired: "Verificar mensagens pendentes de retry na listagem de mensagens."
        });
      }
    } catch (e: any) {
      logger.warn({ event: "alert_eval_message_error", error: e.message });
    }

    // 3. Unresolved Queue Wait Alerts (from Etapa 4)
    try {
      const unresolvedWaitAlerts = await QueueWaitAlert.count({
        where: { resolvedAt: null }
      });

      if (unresolvedWaitAlerts > 0) {
        alerts.push({
          id: `queue_wait_unresolved_${unresolvedWaitAlerts}`,
          type: "QUEUE_WAIT_OVERDUE",
          severity: "HIGH",
          message: `${unresolvedWaitAlerts} atendimento(s) em fila de espera ultrapassaram o tempo limite de 10 minutos úteis.`,
          details: { count: unresolvedWaitAlerts },
          actionRequired: "Supervisores devem redistribuir ou assumir os tickets pendentes."
        });
      }
    } catch (e: any) {
      logger.warn({ event: "alert_eval_wait_error", error: e.message });
    }

    // 4. Disk Space Evaluation (> 80% usage threshold)
    try {
      const diskUsage = this.getDiskUsagePercentage();
      if (diskUsage > 80) {
        alerts.push({
          id: `disk_space_high_${Math.round(diskUsage)}`,
          type: "DISK_SPACE_HIGH",
          severity: diskUsage > 90 ? "CRITICAL" : "HIGH",
          message: `Uso de disco elevado: ${diskUsage.toFixed(1)}% ocupado.`,
          details: { usagePercent: diskUsage },
          actionRequired: "Executar rotação de logs e verificar retenção de mídias/backups."
        });
      }
    } catch (e: any) {
      // Disk check may fail in some restricted environments; log as warning
    }

    // Deduplicate and emit structured log for newly triggered alerts
    const deduplicatedAlerts: OperationalAlertItem[] = [];
    const DEDUPLICATION_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

    for (const alert of alerts) {
      const existing = activeAlerts.get(alert.id);
      if (!existing || now - existing.lastAlertedAt > DEDUPLICATION_INTERVAL_MS) {
        activeAlerts.set(alert.id, { lastAlertedAt: now, count: (existing?.count || 0) + 1 });
        deduplicatedAlerts.push(alert);
        logger.warn({
          event: "operational_alert_triggered",
          alertType: alert.type,
          severity: alert.severity,
          message: alert.message
        });
      } else {
        // Still include in current report, but don't re-log spam
        deduplicatedAlerts.push(alert);
      }
    }

    return {
      timestamp: new Date().toISOString(),
      alerts: deduplicatedAlerts,
      systemHealthy: deduplicatedAlerts.length === 0
    };
  }

  /**
   * Helper to estimate disk usage percentage safely.
   */
  static getDiskUsagePercentage(): number {
    try {
      const fsAny = fs as any;
      if (typeof fsAny.statfsSync === "function") {
        const stats = fsAny.statfsSync(process.cwd());
        const total = stats.blocks * stats.bsize;
        const free = stats.bfree * stats.bsize;
        if (total > 0) {
          return ((total - free) / total) * 100;
        }
      }
    } catch {
      // Fallback
    }
    return 0;
  }
}
