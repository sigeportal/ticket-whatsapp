import Queue from "../models/Queue";
import Company from "../models/Company";
import User from "../models/User";
import Setting from "../models/Setting";

interface SerializedUser {
  id: number;
  name: string;
  email: string;
  profile: string;
  companyId: number;
  company: Company | null;
  super: boolean;
  queues: Queue[];
  allTicket: string,
}

export const SerializeUser = async (user: User): Promise<SerializedUser> => {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    profile: user.profile,
    companyId: user.companyId,
    company: user.company ? {
      id: user.company.id, name: user.company.name, dueDate: user.company.dueDate,
      settings: user.company.settings?.filter(s => ["campaignsEnabled", "scheduleType"].includes(s.key))
    } as any : null,
    super: user.super,
    queues: user.queues,
	allTicket: user.allTicket,
  };
};
