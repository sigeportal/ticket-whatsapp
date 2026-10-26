import type { Contact } from "./contact";

export interface ContactList {
  id: number;
  name: string;
  companyId?: number;
  contactsCount?: number | string;
}

export interface ContactListItem extends Pick<Contact, "id" | "name" | "number" | "email" | "companyId"> {
  contactListId: number;
  isWhatsappValid: boolean | null;
}

export interface ContactListStats {
  totalLists: number;
  totalContacts: number;
  validContacts: number;
}

export interface ContactListEvent<T> {
  action: "create" | "update" | "delete" | "reload";
  id?: number | string;
  record?: T;
  records?: T[];
}
