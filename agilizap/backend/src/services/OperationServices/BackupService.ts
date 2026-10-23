import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Op } from "sequelize";
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

export interface BackupManifest {
  backupId: string;
  timestamp: string;
  version: string;
  rpoTargetHours: number;
  rtoTargetHours: number;
  tables: {
    [tableName: string]: {
      count: number;
      sha256: string;
    };
  };
  media: {
    count: number;
    totalBytes: number;
    sha256: string;
  };
  manifestSha256?: string;
}

export interface BackupOptions {
  destinationDir?: string;
  companyId?: number;
  includeMedia?: boolean;
}

function calculateSha256(content: string | Buffer): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

export class BackupService {
  /**
   * Generates a structured, integrity-verified backup of database and media files.
   */
  static async createBackup(options: BackupOptions = {}): Promise<{
    backupPath: string;
    manifest: BackupManifest;
  }> {
    const backupId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const destBase = options.destinationDir || path.resolve(process.cwd(), "backups");

    const backupFolder = path.join(destBase, `backup-${backupId}`);
    fs.mkdirSync(backupFolder, { recursive: true });

    logger.info({ event: "backup_started", backupId, timestamp, backupFolder });

    try {
      const manifest: BackupManifest = {
        backupId,
        timestamp,
        version: "1.0.0",
        rpoTargetHours: 24,
        rtoTargetHours: 4,
        tables: {},
        media: { count: 0, totalBytes: 0, sha256: "" }
      };

      const whereCompany = options.companyId ? { companyId: options.companyId } : {};

      // 1. Export tables
      const tablesToExport: { name: string; model: any; where?: any }[] = [
        { name: "Companies", model: Company, where: options.companyId ? { id: options.companyId } : {} },
        { name: "Users", model: User, where: whereCompany },
        { name: "Contacts", model: Contact, where: whereCompany },
        { name: "Tickets", model: Ticket, where: whereCompany },
        { name: "Messages", model: Message, where: options.companyId ? { companyId: options.companyId } : {} },
        { name: "Settings", model: Setting, where: whereCompany },
        { name: "Schedules", model: Schedule, where: whereCompany },
        { name: "Whatsapps", model: Whatsapp, where: whereCompany },
        { name: "Queues", model: Queue, where: whereCompany },
        { name: "AuditLogs", model: AuditLog, where: whereCompany },
        { name: "QueueWaitAlerts", model: QueueWaitAlert, where: whereCompany }
      ];

      for (const table of tablesToExport) {
        let rows: any[] = [];
        try {
          rows = await table.model.findAll({ where: table.where || {} });
        } catch (e: any) {
          logger.warn({ event: "backup_table_skipped", table: table.name, reason: e.message });
        }

        const serialized = JSON.stringify(rows.map(r => r.toJSON ? r.toJSON() : r), null, 2);
        const tableSha = calculateSha256(serialized);
        fs.writeFileSync(path.join(backupFolder, `${table.name}.json`), serialized, "utf8");

        manifest.tables[table.name] = {
          count: rows.length,
          sha256: tableSha
        };
      }

      // 2. Export Media if requested (with path confinement and hash verification)
      if (options.includeMedia !== false) {
        const mediaSourceDir = process.env.TEST_MEDIA_ROOT || path.resolve(process.cwd(), "public");
        const mediaBackupDir = path.join(backupFolder, "media");
        fs.mkdirSync(mediaBackupDir, { recursive: true });

        let mediaCount = 0;
        let mediaBytes = 0;
        const mediaHashes: string[] = [];

        if (fs.existsSync(mediaSourceDir)) {
          const files = fs.readdirSync(mediaSourceDir);
          for (const file of files) {
            const fullPath = path.join(mediaSourceDir, file);
            const stat = fs.statSync(fullPath);
            if (stat.isFile()) {
              // Ensure path is confined and safe
              const safePath = confinedPath(mediaSourceDir, file);
              const data = fs.readFileSync(safePath);
              const fileHash = calculateSha256(data);
              fs.writeFileSync(path.join(mediaBackupDir, file), data);

              mediaCount++;
              mediaBytes += stat.size;
              mediaHashes.push(fileHash);
            }
          }
        }

        manifest.media = {
          count: mediaCount,
          totalBytes: mediaBytes,
          sha256: calculateSha256(mediaHashes.sort().join(","))
        };
      }

      // 3. Save manifest with master checksum
      const manifestString = JSON.stringify(manifest, null, 2);
      manifest.manifestSha256 = calculateSha256(manifestString);
      fs.writeFileSync(path.join(backupFolder, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

      logger.info({
        event: "backup_completed",
        backupId,
        tablesCount: Object.keys(manifest.tables).length,
        mediaCount: manifest.media.count
      });

      return { backupPath: backupFolder, manifest };
    } catch (err: any) {
      logger.error({ event: "backup_failed", backupId, error: err.message });
      throw err;
    }
  }

  /**
   * Rotates backups in destination directory, retaining only the latest `maxCopies`.
   */
  static rotateBackups(destinationDir: string, maxCopies: number = 7): string[] {
    if (!fs.existsSync(destinationDir)) return [];

    const entries = fs.readdirSync(destinationDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && d.name.startsWith("backup-"))
      .map(d => {
        const full = path.join(destinationDir, d.name);
        return { name: d.name, full, mtime: fs.statSync(full).mtime.getTime() };
      })
      .sort((a, b) => b.mtime - a.mtime); // Newest first

    const removed: string[] = [];
    if (entries.length > maxCopies) {
      const toDelete = entries.slice(maxCopies);
      for (const item of toDelete) {
        fs.rmSync(item.full, { recursive: true, force: true });
        removed.push(item.name);
        logger.info({ event: "backup_rotated", removedBackup: item.name });
      }
    }

    return removed;
  }
}
