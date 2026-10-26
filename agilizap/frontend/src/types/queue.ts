import { Company } from "./company";
import { User } from "./user";

export interface QueueOption {
  id: number;
  title: string;
  message?: string;
  option?: string;
  queueId: number;
  parentId?: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface QueueSchedule {
  weekday: string;
  weekdayEn: string;
  startTime: string;
  endTime: string;
  inActivity: boolean;
}

export interface Queue {
  id: number;
  name: string;
  color: string;
  greetingMessage?: string;
  outOfHoursMessage?: string;
  schedules?: QueueSchedule[];
  orderQueue?: number;
  companyId: number;
  company?: Company;
  users?: User[];
  options?: QueueOption[];
  integrationId?: number;
  promptId?: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}
