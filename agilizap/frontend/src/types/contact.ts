import { Company } from "./company";

export interface ContactCustomField {
  id?: number;
  name: string;
  value: string;
  contactId?: number;
}

export interface Contact {
  id: number;
  name: string;
  number: string;
  email?: string;
  profilePicUrl?: string;
  isGroup: boolean;
  isLid?: boolean;
  active?: boolean;
  companyId: number;
  company?: Company;
  extraInfo?: ContactCustomField[];
  whatsappId?: number;
  optOutCampaign?: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}
