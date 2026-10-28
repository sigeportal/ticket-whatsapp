import AppError from "../../errors/AppError";
import { getIO } from "../../libs/socket";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import User from "../../models/User";
import Tag from "../../models/Tag";

interface MessageData {
  id: string;
  ticketId: number;
  body: string;
  contactId?: number;
  fromMe?: boolean;
  read?: boolean;
  mediaType?: string;
  mediaUrl?: string;
  ack?: number;
  queueId?: number;
  isForwarded?: boolean;
  operationId?: string;
  status?: string;
  uncertainReason?: string;
  retries?: number;
}

interface Request {
  messageData: MessageData;
  companyId: number;
}

const mapAckToStatus = (ack?: number): string => {
  if (ack === undefined || ack === null || ack === 0) return "pending";
  if (ack === 1) return "sended";
  if (ack === 2) return "delivered";
  if (ack >= 3) return "read";
  if (ack < 0) return "failed";
  return "pending";
};

const CreateMessageService = async ({
  messageData,
  companyId
}: Request): Promise<Message> => {
  const target = await Ticket.findOne({ where: { id: messageData.ticketId, companyId } });
  if (!target) throw new AppError("ERR_NO_PERMISSION", 403);

  // 1. Idempotency by operationId
  if (messageData.operationId) {
    const existingByOp = await Message.findOne({
      where: { companyId, operationId: messageData.operationId },
      include: [
        "contact",
        {
          model: Ticket,
          as: "ticket",
          include: [
            "contact",
            "queue",
            {
              model: User,
              as: "user",
              attributes: ["id", "name"]
            },
            {
              model: Tag,
              as: "tags",
              attributes: ["id", "name", "color"]
            },
            {
              model: Whatsapp,
              as: "whatsapp",
              attributes: ["name"]
            }
          ]
        }
      ]
    });
    if (existingByOp) {
      return existingByOp;
    }
  }

  // 2. Prevent cross-tenant ID collision
  const existing = await Message.findByPk(messageData.id);
  if (existing && existing.companyId !== companyId) throw new AppError("ERR_NO_PERMISSION", 403);

  const initialStatus = messageData.status || mapAckToStatus(messageData.ack);
  const data = {
    ...messageData,
    status: initialStatus,
    companyId
  };

  const [record] = await Message.findOrCreate({ where: { id: data.id, companyId }, defaults: data });
  await record.update(data);

  const message = await Message.findByPk(messageData.id, {
    include: [
      "contact",
      {
        model: Ticket,
        as: "ticket",
        include: [
          "contact",
          "queue",
          {
            model: User,
            as: "user",
            attributes: ["id", "name"]
          },
          {
            model: Tag,
            as: "tags",
            attributes: ["id", "name", "color"]
          },
          {
            model: Whatsapp,
            as: "whatsapp",
            attributes: ["name"]
          }
        ]
      },
      {
        model: Message,
        as: "quotedMsg", required: false, where: { companyId, ticketId: messageData.ticketId },
        include: ["contact"]
      }
    ]
  });

  if (!message) {
    throw new Error("ERR_CREATING_MESSAGE");
  }

  if (message.ticket.queueId !== null && message.queueId === null) {
    await message.update({ queueId: message.ticket.queueId });
  }

  try {
    const io = getIO();
    io.to(message.ticketId.toString())
      .to(`company-${companyId}-${message.ticket.status}`)
      .to(`company-${companyId}-notification`)
      .to(`queue-${message.ticket.queueId}-${message.ticket.status}`)
      .to(`queue-${message.ticket.queueId}-notification`)
      .emit(`company-${companyId}-appMessage`, {
        action: "create",
        message,
        ticket: message.ticket,
        contact: message.ticket.contact
      });
  } catch (socketErr) {
    // Non-fatal if socket is uninitialized in test harness
  }

  return message;
};

export default CreateMessageService;
