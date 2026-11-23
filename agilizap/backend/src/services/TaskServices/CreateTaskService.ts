import AppError from "../../errors/AppError";
import Task from "../../models/Task";
import User from "../../models/User";
import { TASK_INCLUDES } from "./ListTasksService";

interface CreateTaskRequest {
  title: string;
  description?: string | null;
  priority?: string;
  dueDate?: string | Date | null;
  assignedUserId?: number | null;
  userId: number;
  companyId: number;
}

const VALID_PRIORITIES = new Set(["low", "medium", "high"]);

const CreateTaskService = async ({
  title,
  description,
  priority = "medium",
  dueDate,
  assignedUserId,
  userId,
  companyId
}: CreateTaskRequest): Promise<Task> => {
  const cleanTitle = String(title || "").trim();
  if (!cleanTitle) {
    throw new AppError("ERR_TASK_TITLE_REQUIRED", 400);
  }

  const safePriority = VALID_PRIORITIES.has(priority) ? priority : "medium";
  const resolvedAssigneeId = assignedUserId ? Number(assignedUserId) : userId;

  const assignee = await User.findOne({
    where: { id: resolvedAssigneeId, companyId }
  });
  if (!assignee) {
    throw new AppError("ERR_TASK_INVALID_ASSIGNEE", 400);
  }

  const parsedDueDate = dueDate ? new Date(dueDate) : null;
  if (parsedDueDate && Number.isNaN(parsedDueDate.getTime())) {
    throw new AppError("ERR_TASK_INVALID_DUE_DATE", 400);
  }

  const created = await Task.create({
    title: cleanTitle,
    description: description ? String(description).trim() : null,
    priority: safePriority,
    dueDate: parsedDueDate,
    completed: false,
    completedAt: null,
    userId,
    assignedUserId: resolvedAssigneeId,
    companyId
  });

  await created.reload({ include: TASK_INCLUDES });
  return created;
};

export default CreateTaskService;
