import type { User } from "./user";

export type ChatPerson = Pick<User, "id" | "name" | "online">;

export interface ChatParticipant {
  userId: number;
  unreads: number;
  user?: ChatPerson;
}

export interface InternalChat {
  id: number;
  uuid: string;
  title: string;
  ownerId: number;
  companyId: number;
  users: ChatParticipant[];
  lastMessage?: string;
  updatedAt?: string;
}

export interface InternalChatMessage {
  id: number;
  chatId: number;
  senderId: number;
  sender?: ChatPerson;
  message: string;
  createdAt: string;
}

export interface ChatPage<T> {
  records: T[];
  hasMore: boolean;
  count?: number;
}

export interface ChatEvent {
  action: "create" | "update" | "delete" | "new-message";
  id?: number | string;
  record?: InternalChat;
  chat?: InternalChat;
  newMessage?: InternalChatMessage;
}
