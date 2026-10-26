import { Contact } from "./contact";
import { Message } from "./message";
import { Queue } from "./queue";
import { User } from "./user";
import { Company } from "./company";

export type TicketStatus = "pending" | "open" | "closed" | string;

export interface Tag {
  id: number;
  name: string;
  color: string;
  companyId?: number;
}

export interface Ticket {
  id: number;
  uuid: string;
  status: TicketStatus;
  unreadMessages: number;
  lastMessage?: string;
  isGroup: boolean;
  userId?: number;
  user?: User;
  contactId: number;
  contact?: Contact;
  whatsappId?: number;
  whatsapp?: any;
  queueId?: number;
  queue?: Queue;
  companyId: number;
  company?: Company;
  chatbot?: boolean;
  queueOptionId?: number;
  useIntegration?: boolean;
  integrationId?: number;
  typebotSessionId?: string;
  typebotStatus?: boolean;
  promptId?: number;
  fromMe?: boolean;
  amountUsedBotQueues?: number;
  closedAt?: string | Date;
  legalHold?: boolean;
  legalHoldReason?: string;
  legalHoldAt?: string | Date;
  lastClientMessageAt?: string | Date;
  lastHumanResponseAt?: string | Date;
  currentWaitEpisodeId?: string;
  tags?: Tag[];
  messages?: Message[];
  createdAt: string | Date;
  updatedAt: string | Date;
}
