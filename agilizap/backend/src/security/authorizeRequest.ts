import { Request } from "express";
import User from "../models/User";
import Ticket from "../models/Ticket";
import Message from "../models/Message";
import TicketNote from "../models/TicketNote";
import Queue from "../models/Queue";
import QueueOption from "../models/QueueOption";
import Whatsapp from "../models/Whatsapp";
import Contact from "../models/Contact";
import Schedule from "../models/Schedule";
import Campaign from "../models/Campaign";
import ContactList from "../models/ContactList";
import ContactListItem from "../models/ContactListItem";
import Files from "../models/Files";
import FilesOptions from "../models/FilesOptions";
import Prompt from "../models/Prompt";
import QueueIntegrations from "../models/QueueIntegrations";
import Tag from "../models/Tag";
import QuickMessage from "../models/QuickMessage";
import Chat from "../models/Chat";
import ChatUser from "../models/ChatUser";
import Announcement from "../models/Announcement";
import Invoices from "../models/Invoices";
import { canAccessTicket, deny } from "./policy";

export const ticketAccess = async (actor: any, id: any): Promise<Ticket> => {
  const ticket = await Ticket.findByPk(id);
  if (!canAccessTicket(actor, ticket)) deny();
  return ticket;
};
export const tenantRecord = async (actor: any, model: any, id: any): Promise<any> => {
  const record = await model.findByPk(id);
  if (!record || Number(record.companyId) !== Number(actor.companyId)) deny();
  return record;
};
const resources: Record<string, [any, string]> = {
  announcements: [Announcement, "id"], users: [User, "userId"], contacts: [Contact, "contactId"], queue: [Queue, "queueId"],
  whatsapp: [Whatsapp, "whatsappId"], whatsappsession: [Whatsapp, "whatsappId"],
  schedules: [Schedule, "scheduleId"], campaigns: [Campaign, "id"],
  "contact-lists": [ContactList, "id"], "contact-list-items": [ContactListItem, "id"],
  files: [Files, "fileId"], prompt: [Prompt, "promptId"], queueIntegration: [QueueIntegrations, "integrationId"],
  tags: [Tag, "tagId"], "quick-messages": [QuickMessage, "id"], chats: [Chat, "id"], invoices: [Invoices, "Invoiceid"]
};
export const authorizeRequest = async (req: Request, actor: any): Promise<void> => {
  const routePath = String(req.route?.path || req.path);
  const resource = routePath.split("/")[1];
  if (req.baseUrl.toLowerCase() === "/auth" && ["me", "logout"].includes(resource)) return;
  const write = !["GET", "HEAD"].includes(req.method);
  const body = req.body || {};
  if (body.blocked !== undefined && (resource !== "users" || actor.profile !== "admin" || typeof body.blocked !== "boolean")) deny();
  if (write && Object.keys(body).some(key => ["super", "tokenVersion", "passwordHash", "resetPassword",
      "resetTokenHash", "resetTokenExpiresAt", "mustChangePassword", "mfaLastStep",
      "mediaPath", "mediaUrl", "path"].includes(key))) deny();
  if (write && body.id !== undefined) {
    const mappedId = resources[resource]?.[1];
    const routeId = (mappedId && req.params[mappedId]) || req.params.id || req.params.userId || req.params.ticketId || req.params.queueId ||
      req.params.scheduleId || req.params.promptId || req.params.integrationId || req.params.tagId || req.params.fileId;
    if (resource !== "files" && (routeId === undefined || String(body.id) !== String(routeId))) deny();
  }
  for (const value of [body.companyId, req.query.companyId]) {
    if (value !== undefined && Number(value) !== actor.companyId) deny();
  }
  if (resource === "queue-options" && actor.profile !== "admin") deny();
  if (resource === "queue-alerts" && actor.profile !== "admin" && actor.profile !== "supervisor") deny();
  if (req.method === "DELETE" && resource !== "auth" && actor.profile !== "admin") deny();
  if (["settings", "prompt", "queueIntegration", "whatsapp", "whatsappsession", "whatsapp-restart",
       "campaign-settings", "plans", "campaigns", "contact-lists", "contact-list-items", "files", "invoices", "subscription"].includes(resource) && actor.profile !== "admin") deny();
  if (write && ["queue", "queue-options", "companies"].includes(resource) && actor.profile !== "admin") deny();
  // Legacy reports aggregate the entire company. Queue-scoped supervisor reports need scoped queries first.
  if (resource === "dashboard" && actor.profile !== "admin") deny();
  if (resource === "companies" && req.params.id && Number(req.params.id) !== actor.companyId) deny();
  if (resource === "chats" && req.params.id && req.method === "GET" && req.path.split("/").length === 3) {
    const chat = await Chat.findOne({ where: { uuid: req.params.id, companyId: actor.companyId } });
    if (!chat || !await ChatUser.findOne({ where: { chatId: chat.id, userId: actor.id } })) deny();
    return;
  }
  if (resource === "chats" && Array.isArray(body.users)) {
    for (const user of body.users) await tenantRecord(actor, User, user.id);
  }
  const mapping = resources[resource];
  if (mapping) {
    const id = req.params[mapping[1]] || (["schedules", "files", "invoices"].includes(resource) ? req.params.id || req.params.fileListId : null);
    if (id) {
      const record = await tenantRecord(actor, mapping[0], id);
      if (resource === "schedules" && actor.profile !== "admin" && actor.profile !== "supervisor" && Number(record.userId) !== Number(actor.id)) deny();
      if (resource === "quick-messages" && actor.profile !== "admin" && (write || !record.geral) && Number(record.userId) !== Number(actor.id)) deny();
    }
  }
  if (resource === "schedules" && write && body.userId !== undefined && Number(body.userId) !== Number(actor.id) && actor.profile !== "admin" && actor.profile !== "supervisor") deny();
  if (resource === "chats" && req.params.id && actor.profile !== "admin") {
    if (!await ChatUser.findOne({ where: { chatId: req.params.id, userId: actor.id } })) deny();
  }
  if (Array.isArray(body.tags)) for (const tag of body.tags) await tenantRecord(actor, Tag, tag.id);
  if (req.params.tagId) await tenantRecord(actor, Tag, req.params.tagId);
  if (routePath.endsWith("/export") && actor.profile !== "admin") deny();
  let ticket: Ticket;
  if (body.ticketId) await ticketAccess(actor, body.ticketId);
  if (req.params.ticketId) ticket = await ticketAccess(actor, req.params.ticketId);
  if (resource === "tickets" && req.params.uuid) {
    ticket = await Ticket.findOne({ where: { uuid: req.params.uuid } });
    if (!canAccessTicket(actor, ticket)) deny();
  }
  if (resource === "tickets" && routePath.endsWith("/closeAll") && actor.profile !== "admin") deny();
  const messageId = req.params.messageId || (resource === "message" ? body.messageId : null);
  if (messageId) {
    const message = await tenantRecord(actor, Message, messageId);
    await ticketAccess(actor, message.ticketId);
  }
  if (body.quotedMsg?.id) {
    const quoted = await tenantRecord(actor, Message, body.quotedMsg.id);
    await ticketAccess(actor, quoted.ticketId);
    if (ticket && quoted.ticketId !== ticket.id) deny();
    // Never trust client-supplied quoted message content or remote identifiers.
    body.quotedMsg = quoted;
  }
  if (resource === "ticket-notes") {
    if (req.method === "POST" && !body.ticketId) deny();
    if (req.params.id) {
      const note = await TicketNote.findByPk(req.params.id);
      if (!note) deny();
      ticket = await ticketAccess(actor, note.ticketId);
      if (body.id !== undefined && String(body.id) !== String(req.params.id)) deny();
    } else if (body.ticketId || req.query.ticketId) {
      ticket = await ticketAccess(actor, body.ticketId || req.query.ticketId);
      const contactId = body.contactId || req.query.contactId;
      if (contactId && Number(contactId) !== ticket.contactId) deny();
    }
  }
  if (resource === "queue-options" && (body.parentId || req.query.parentId) && Number(body.parentId || req.query.parentId) > 0) {
    const parent = await QueueOption.findByPk(body.parentId || req.query.parentId);
    if (!parent) deny();
    await tenantRecord(actor, Queue, parent.queueId);
    if (body.queueId && Number(body.queueId) !== parent.queueId) deny();
  }
  if (resource === "queue-options" && !req.params.queueOptionId && !body.queueId && !req.query.queueId) deny();
  if (resource === "queue-options" && req.params.queueOptionId) {
    const option = await QueueOption.findByPk(req.params.queueOptionId);
    if (!option) deny();
    await tenantRecord(actor, Queue, option.queueId);
  }
  for (const [field, model] of Object.entries({ contactId: Contact, userId: User, queueId: Queue,
    whatsappId: Whatsapp, promptId: Prompt, integrationId: QueueIntegrations,
    contactListId: ContactList, fileId: Files, fileListId: Files })) {
    for (const id of [body[field], req.query[field], req.params[field]]) {
      if (id !== undefined && id !== null && id !== "" && Number(id) !== 0) {
        const record = await tenantRecord(actor, model, id);
        if (field === "queueId" && actor.profile !== "admin" && !actor.queues.some((q: any) => q.id === record.id)) deny();
      }
    }
  }
  for (const id of body.queueIds || []) {
    const queue = await tenantRecord(actor, Queue, id);
    if (actor.profile !== "admin" && !actor.queues.some((q: any) => q.id === queue.id)) deny();
  }
  if (resource === "tickets" && write && !ticket && body.userId === undefined && actor.profile !== "admin") body.userId = actor.id;
  const assignedUserId = body.userId === undefined ? ticket?.userId : body.userId;
  if (resource === "tickets" && write && assignedUserId) {
    const target = await User.findByPk(assignedUserId, { include: [Queue] });
    const queueId = body.queueId === undefined ? ticket?.queueId : Number(body.queueId);
    // Closing an existing ticket does not reassign it or require its owner to join a queue.
    const closingWithoutReassignment = actor.profile === "admin" && ticket && body.status === "closed" &&
      body.userId === undefined && body.queueId === undefined;
    if (!target || target.companyId !== actor.companyId ||
        (!closingWithoutReassignment && !target.queues.some(q => q.id === queueId))) deny();
  }
  if (resource === "tickets" && write && actor.profile === "user") {
    if (body.userId !== undefined && Number(body.userId) !== Number(actor.id)) deny();
    if (ticket?.userId && ticket.userId !== Number(actor.id)) deny();
    if (!ticket && (body.queueId === undefined || body.queueId === null)) deny();
    if (ticket && body.queueId !== undefined && Number(body.queueId) !== ticket.queueId) deny();
  }
  if (resource === "files" && req.params.fileListId) {
    if (body.fileId !== undefined && String(body.fileId) !== req.params.fileListId) deny();
    for (const id of (Array.isArray(body.id) ? body.id : [body.id]).filter(Boolean)) {
      const option = await FilesOptions.findByPk(id);
      if (!option || String(option.fileId) !== req.params.fileListId) deny();
    }
  }
};
