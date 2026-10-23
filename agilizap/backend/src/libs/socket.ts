import { Server as SocketIO } from "socket.io";
import { Server } from "http";
import AppError from "../errors/AppError";
import { loadSession } from "../security/session";
import { canAccessTicket } from "../security/policy";
import Ticket from "../models/Ticket";
let io: SocketIO;
export const disconnectUser = (id: number | string): void => {
  io?.in(`user-${id}`).disconnectSockets(true);
};
export const enforceTicketRoomAccess = async (ticket: Ticket): Promise<void> => {
  if (!io) return;
  const sockets = await io.in(String(ticket.id)).fetchSockets();
  for (const socket of sockets) {
    try {
      const actor = await loadSession(socket.data.token);
      if (!canAccessTicket(actor, ticket)) socket.leave(String(ticket.id));
    } catch (_) { socket.disconnect(true); }
  }
};
export const initIO = (httpServer: Server): SocketIO => {
  io = new SocketIO(httpServer, { cors: { origin: process.env.FRONTEND_URL, credentials: true } });
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const user = await loadSession(token);
      socket.data.actor = user;
      socket.data.token = token;
      next();
    } catch (_) { next(new Error("ERR_SESSION_EXPIRED")); }
  });
  io.on("connection", socket => {
    let actor = socket.data.actor;
    socket.join(`company-${actor.companyId}-mainchannel`);
    socket.join(`user-${actor.id}`);
    if (actor.profile === "admin") socket.join(`company-${actor.companyId}-admin`);
    const fingerprint = (user: any) => `${user.profile}|${user.companyId}|${user.tokenVersion}|${user.queues.map((q: any) => q.id).sort().join(",")}`;
    const initialAccess = fingerprint(actor);
    const refresh = async () => {
      const current = await loadSession(socket.data.token);
      if (fingerprint(current) !== initialAccess) throw new Error("ERR_SESSION_EXPIRED");
      actor = current;
      for (const room of socket.rooms) {
        if (/^\d+$/.test(room) && !canAccessTicket(actor, await Ticket.findByPk(room))) socket.leave(room);
      }
    };
    socket.use(async (_, next) => {
      try { await refresh(); next(); } catch (_) { socket.disconnect(true); }
    });
    // Also expire idle sockets and remove obsolete queue subscriptions, with no client activity required.
    const check = setInterval(async () => {
      try {
        const previous = actor.queues.map((q: any) => q.id).sort().join(",");
        const profile = actor.profile;
        await refresh();
        if (previous !== actor.queues.map((q: any) => q.id).sort().join(",") || profile !== actor.profile) socket.disconnect(true);
      } catch (_) { socket.disconnect(true); }
    }, 10000);
    socket.on("disconnect", () => clearInterval(check));
    socket.on("joinChatBox", async (id: string) => {
      try {
        if (!/^\d+$/.test(String(id))) return;
        const ticket = await Ticket.findByPk(id);
        if (canAccessTicket(actor, ticket)) socket.join(String(ticket.id));
      } catch (_) { socket.disconnect(true); }
    });
    socket.on("leaveChatBox", (id: string) => { if (/^\d+$/.test(String(id))) socket.leave(String(id)); });
    const rooms = (suffix: string): string[] => actor.profile === "admin"
      ? [`company-${actor.companyId}-${suffix}`]
      : actor.queues.filter((q: any) => q.companyId === actor.companyId).map((q: any) => `queue-${q.id}-${suffix}`);
    socket.on("joinNotification", () => rooms("notification").forEach(room => socket.join(room)));
    socket.on("leaveNotification", () => rooms("notification").forEach(room => socket.leave(room)));
    socket.on("joinTickets", (status: string) => {
      if (["pending", "open", "closed", "group"].includes(status)) rooms(status).forEach(room => socket.join(room));
    });
    socket.on("leaveTickets", (status: string) => {
      if (["pending", "open", "closed", "group"].includes(status)) rooms(status).forEach(room => socket.leave(room));
    });
    socket.emit("ready");
  });
  return io;
};
export const getIO = (): SocketIO => {
  if (!io) throw new AppError("Socket IO not initialized");
  return io;
};
