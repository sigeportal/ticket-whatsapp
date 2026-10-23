import { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import { loadSession } from "../security/session";
import { confinedPath } from "../security/media";
import { canAccessTicket, deny } from "../security/policy";
import uploadConfig from "../config/upload";
import Message from "../models/Message";
import Ticket from "../models/Ticket";
import Files from "../models/Files";
import FilesOptions from "../models/FilesOptions";
import Queue from "../models/Queue";
import QueueOption from "../models/QueueOption";
import Schedule from "../models/Schedule";
import Campaign from "../models/Campaign";
import QuickMessage from "../models/QuickMessage";
import Announcement from "../models/Announcement";

const privateMedia = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const bearer = /^Bearer (\S+)$/.exec(req.headers.authorization || "");
  const actor = await loadSession(bearer?.[1] || req.cookies?.mediaAccess);
  const relative = req.path.replace(/^\//, "");
  let target = confinedPath(uploadConfig.directory, relative);
  const basename = path.basename(target);
  let allowed = false;
  // Preserve persisted filenames and URLs; authorize the database reference, never a tenant guessed from a path.
  const messages = await Message.findAll({ where: { mediaUrl: relative } });
  for (const message of messages) {
    if (message.companyId !== actor.companyId) deny(); // Ambiguous legacy shared filename requires manual reconciliation.
    if (canAccessTicket(actor, await Ticket.findByPk(message.ticketId))) allowed = true;
  }
  if (relative.startsWith("files/") || relative.startsWith("fileList/")) {
    const [, id, name] = relative.split("/");
    const file = await Files.findByPk(id);
    if (file?.companyId === actor.companyId && actor.profile === "admin" &&
        await FilesOptions.findOne({ where: { fileId: id, path: name } })) allowed = true;
  }
  if (relative.startsWith("quickMessage/")) {
    const records = await QuickMessage.findAll({ where: { mediaPath: basename } });
    for (const record of records) {
      if (record.companyId !== actor.companyId) deny();
      if (actor.profile === "admin" || record.geral || Number(record.userId) === actor.id) allowed = true;
    }
  }
  if (!relative.includes("/") && await Announcement.findOne({ where: { mediaPath: basename, companyId: actor.companyId } })) allowed = true;
  if (!relative.includes("/")) {
    for (const model of [Queue, Schedule, Campaign, QuickMessage] as any[]) {
      const records = await model.findAll({ where: { mediaPath: basename } });
      for (const record of records) {
        if (record.companyId !== actor.companyId) deny();
        if (actor.profile === "admin" || model === Queue && actor.queues.some(q => q.id === record.id) ||
            model === QuickMessage && Number(record.userId) === actor.id ||
            model === Schedule && Number(record.userId) === actor.id) allowed = true;
      }
    }
    const options = await QueueOption.findAll({ where: { mediaPath: basename }, include: [Queue] });
    for (const option of options) {
      if (option.queue?.companyId !== actor.companyId) deny();
      if (actor.profile === "admin" || actor.queues.some(q => q.id === option.queueId)) allowed = true;
    }
  }
  if (relative.startsWith("announcements/") && await Announcement.findOne({ where: { mediaPath: basename, companyId: actor.companyId } })) allowed = true;
  if (!allowed) deny();
  if (relative.startsWith("announcements/") && !fs.existsSync(target)) {
    target = confinedPath(uploadConfig.directory, basename);
  }
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
  // Documents are attachments; media may be rendered by the authorized panel.
  if (!/\.(jpg|jpeg|png|gif|webp|mp3|ogg|opus|wav|mp4|m4a|webm)$/i.test(basename)) {
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(basename)}"`);
  }
  res.sendFile(target, error => { if (error) next(error); });
};
export default privateMedia;
