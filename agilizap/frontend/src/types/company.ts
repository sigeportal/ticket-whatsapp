export interface CompanySchedule {
  weekday: string;
  weekdayEn: string;
  startTime: string;
  endTime: string;
  inActivity: boolean;
}

export interface Company {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  status?: boolean;
  dueDate?: string;
  recurrence?: string;
  schedules?: CompanySchedule[];
  planId?: number;
  aiMonthlyBudgetLimit?: number;
  aiMonthlySpent?: number;
  aiBudgetPeriod?: string;
  aiRequestsCount?: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}
