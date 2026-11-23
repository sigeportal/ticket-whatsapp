import AppError from "../../errors/AppError";
import Task from "../../models/Task";
import User from "../../models/User";
import { TASK_INCLUDES } from "./ListTasksService";

interface UpdateTaskRequest {
  taskId: string | number;
  companyId: number;
  title?: string;
  description?: string | null;
  priority?: string;
  dueDate?: string | Date | null;
  completed?: boolean;
  assignedUserId?: number | null;
}

const VALID_PRIORITIES = new Set(["low", "medium", "high"]);

const UpdateTaskService = async ({
  taskId,
  companyId,
  title,
  description,
  priority,
  dueDate,
  completed,
  assignedUserId
}: UpdateTaskRequest): Promise<Task> => {
  const task = await Task.findOne({
    where: { id: taskId, companyId }
  });

  if (!task) {
    throw new AppError("ERR_TASK_NOT_FOUND", 404);
  }

  const updates: any = {};

  if (title !== undefined) {
    const cleanTitle = String(title).trim();
    if (!cleanTitle) {
      throw new AppError("ERR_TASK_TITLE_REQUIRED", 400);
    }
    updates.title = cleanTitle;
  }

  if (description !== undefined) {
    updates.description = description ? String(description).trim() : null;
  }

  if (priority !== undefined) {
    if (!VALID_PRIORITIES.has(priority)) {
      throw new AppError("ERR_TASK_INVALID_PRIORITY", 400);
    }
    updates.priority = priority;
  }

  if (dueDate !== undefined) {
    if (dueDate === null || dueDate === "") {
      updates.dueDate = null;
    } else {
      const parsed = new Date(dueDate);
      if (Number.isNaN(parsed.getTime())) {
        throw new AppError("ERR_TASK_INVALID_DUE_DATE", 400);
      }
      updates.dueDate = parsed;
    }
  }

  if (assignedUserId !== undefined) {
    if (assignedUserId === null || assignedUserId === 0) {
      updates.assignedUserId = null;
    } else {
      const assignee = await User.findOne({
        where: { id: Number(assignedUserId), companyId }
      });
      if (!assignee) {
        throw new AppError("ERR_TASK_INVALID_ASSIGNEE", 400);
      }
      updates.assignedUserId = assignee.id;
    }
  }

  if (completed !== undefined) {
    const nextCompleted = Boolean(completed);
    updates.completed = nextCompleted;
    updates.completedAt = nextCompleted ? new Date() : null;
  }

  await task.update(updates);
  await task.reload({ include: TASK_INCLUDES });
  return task;
};

export default UpdateTaskService;
