import { Company } from "./company";
import { Queue } from "./queue";

export type UserProfile = "admin" | "user" | "super" | string;

export interface User {
  id: number;
  name: string;
  email: string;
  profile: UserProfile;
  allTicket?: string;
  super?: boolean;
  online?: boolean;
  tokenVersion?: number;
  blocked?: boolean;
  mustChangePassword?: boolean;
  companyId: number;
  company?: Company;
  queues?: Queue[];
  createdAt?: string | Date;
  updatedAt?: string | Date;
}
