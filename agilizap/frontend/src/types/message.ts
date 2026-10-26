import { Contact } from "./contact";
import { Ticket } from "./ticket";
import { Company } from "./company";
import { Queue } from "./queue";

export type MessageAck = 0 | 1 | 2 | 3 | 4 | number;

export interface MessageReaction {
  type: string;
  userId: number;
}

export interface Message {
  id: string;
  remoteJid?: string;
  participant?: string;
  dataJson?: string;
  ack: MessageAck;
  read: boolean;
  fromMe: boolean;
  body: string;
  status: string;
  operationId?: string;
  uncertainReason?: string;
  retries?: number;
  reactions?: MessageReaction[];
  mediaUrl?: string | null;
  mediaType?: string;
  isDeleted: boolean;
  isEdited?: boolean;
  isForwarded?: boolean;
  quotedMsgId?: string;
  quotedMsg?: Message;
  ticketId: number;
  ticket?: Ticket;
  contactId?: number;
  contact?: Contact;
  companyId: number;
  company?: Company;
  queueId?: number;
  queue?: Queue;
  createdAt: string | Date;
  updatedAt: string | Date;
}
