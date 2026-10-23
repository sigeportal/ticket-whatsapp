import fs from "fs";
import path from "path";
import crypto from "crypto";
import Company from "../../models/Company";
import User from "../../models/User";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import Setting from "../../models/Setting";
import Schedule from "../../models/Schedule";
import Whatsapp from "../../models/Whatsapp";
import Queue from "../../models/Queue";
import AuditLog from "../../models/AuditLog";
import QueueWaitAlert from "../../models/QueueWaitAlert";
import { logger } from "../../utils/logger";
import { confinedPath } from "../../security/media";
import { BackupManifest } from "./BackupService";

export interface RestoreOptions {
  restoreMedia?: boolean;
  /**
   * If true (default), resets all restored WhatsApp connections to 'DISCONNECTED'
   * to strictly prevent two environments (e.g., production and restored test)
   * from concurrently competing for the same WhatsApp Web session keys.
   */
  preventSessionCollision?: boolean;
  targetMediaDir?: string;
}

export interface RestoreResult {
  backupId: string;
  restoredAt: string;
  tablesRestored: string[];
  recordsRestored: number;
  mediaFilesRestored: number;
  durationMs: number;
  rpoCompliant: boolean;
  rtoCompliant: boolean;
  sessionCollisionPrevented: boolean;
}

function calculateSha256(content: string | Buffer): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

export class RestoreService {
  /**
   * Restores database and media files from a backup directory with strict integrity validation
   * and WhatsApp session collision safeguards.
   */
  static async restoreBackup(backupFolder: string, options: RestoreOptions = {}): Promise<RestoreResult> {
    const startTime = Date.now();
    const manifestPath = path.join(backupFolder, "manifest.json");

    if (!fs.existsSync(manifestPath)) {
      throw new Error("ERR_BACKUP_MANIFEST_NOT_FOUND");
    }

    const manifestRaw = fs.readFileSync(manifestPath, "utf8");
    const manifest: BackupManifest = JSON.parse(manifestRaw);

    logger.info({ event: "restore_started", backupId: manifest.backupId, manifestTimestamp: manifest.timestamp });

    // 1. Verify Table Integrity before restoring any data
    for (const [tableName, meta] of Object.entries(manifest.tables)) {
      const filePath = path.join(backupFolder, `${tableName}.json`);
      if (!fs.existsSync(filePath)) {
        throw new Error(`ERR_BACKUP_FILE_MISSING: ${tableName}.json`);
      }
      const content = fs.readFileSync(filePath, "utf8");
      const currentHash = calculateSha256(content);
      if (currentHash !== meta.sha256) {
        logger.error({ event: "restore_integrity_failed", table: tableName, expected: meta.sha256, actual: currentHash });
        throw new Error(`ERR_BACKUP_INTEGRITY_COMPROMISED: ${tableName}`);
      }
    }

    let recordsRestored = 0;
    const tablesRestored: string[] = [];

    // 2. Restore Tables (in dependency-aware order)
    const tableOrder: { name: string; model: any }[] = [
      { name: "Companies", model: Company },
      { name: "Users", model: User },
      { name: "Contacts", model: Contact },
      { name: "Queues", model: Queue },
      { name: "Whatsapps", model: Whatsapp },
      { name: "Tickets", model: Ticket },
      { name: "Messages", model: Message },
      { name: "Settings", model: Setting },
      { name: "Schedules", model: Schedule },
      { name: "AuditLogs", model: AuditLog },
      { name: "QueueWaitAlerts", model: QueueWaitAlert }
    ];

    for (const item of tableOrder) {
      if (!manifest.tables[item.name]) continue;

      const filePath = path.join(backupFolder, `${item.name}.json`);
      const rows: any[] = JSON.parse(fs.readFileSync(filePath, "utf8"));

      for (const row of rows) {
        // Enforce WhatsApp collision safeguard
        if (item.name === "Whatsapps" && options.preventSessionCollision !== false) {
          row.status = "DISCONNECTED";
          row.qrcode = null;
        }

        try {
          await item.model.upsert(row);
          recordsRestored++;
        } catch (e: any) {
          logger.warn({ event: "restore_row_warning", table: item.name, error: e.message });
        }
      }
      tablesRestored.push(item.name);
    }

    // 3. Restore Media files if requested
    let mediaFilesRestored = 0;
    if (options.restoreMedia !== false) {
      const mediaBackupDir = path.join(backupFolder, "media");
      const targetMediaDir = options.targetMediaDir || process.env.TEST_MEDIA_ROOT || path.resolve(process.cwd(), "public");

      if (fs.existsSync(mediaBackupDir)) {
        fs.mkdirSync(targetMediaDir, { recursive: true });
        const files = fs.readdirSync(mediaBackupDir);

        for (const file of files) {
          const srcFile = path.join(mediaBackupDir, file);
          const safeDest = confinedPath(targetMediaDir, file);
          fs.copyFileSync(srcFile, safeDest);
          mediaFilesRestored++;
        }
      }
    }

    const durationMs = Date.now() - startTime;
    const backupAgeHours = (Date.now() - new Date(manifest.timestamp).getTime()) / (1000 * 60 * 60);

    const rpoCompliant = backupAgeHours <= (manifest.rpoTargetHours || 24);
    const rtoCompliant = (durationMs / 1000) <= ((manifest.rtoTargetHours || 4) * 3600);
    const sessionCollisionPrevented = options.preventSessionCollision !== false;

    logger.info({
      event: "restore_completed",
      backupId: manifest.backupId,
      recordsRestored,
      mediaFilesRestored,
      durationMs,
      rpoCompliant,
      rtoCompliant,
      sessionCollisionPrevented
    });

    return {
      backupId: manifest.backupId,
      restoredAt: new Date().toISOString(),
      tablesRestored,
      recordsRestored,
      mediaFilesRestored,
      durationMs,
      rpoCompliant,
      rtoCompliant,
      sessionCollisionPrevented
    };
  }
}
