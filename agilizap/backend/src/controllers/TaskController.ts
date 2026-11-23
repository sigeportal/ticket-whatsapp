import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import ListTasksService from "../services/TaskServices/ListTasksService";
import CreateTaskService from "../services/TaskServices/CreateTaskService";
import UpdateTaskService from "../services/TaskServices/UpdateTaskService";
import DeleteTaskService from "../services/TaskServices/DeleteTaskService";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id: userId, profile } = req.user;
  const { status, priority, searchParam, scope } = req.query as Record<string, string | undefined>;

  const tasks = await ListTasksService({
    companyId,
    userId: Number(userId),
    profile,
    status,
    priority,
    searchParam,
    scope
  });

  return res.status(200).json({ tasks });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id: userId } = req.user;
  const { title, description, priority, dueDate, assignedUserId } = req.body;

  const task = await CreateTaskService({
    title,
    description,
    priority,
    dueDate,
    assignedUserId,
    userId: Number(userId),
    companyId
  });

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-task`, {
    action: "create",
    task
  });

  return res.status(201).json(task);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { taskId } = req.params;
  const { title, description, priority, dueDate, completed, assignedUserId } = req.body;

  const task = await UpdateTaskService({
    taskId,
    companyId,
    title,
    description,
    priority,
    dueDate,
    completed,
    assignedUserId
  });

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-task`, {
    action: "update",
    task
  });

  return res.status(200).json(task);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { taskId } = req.params;

  await DeleteTaskService(taskId, companyId);

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-task`, {
    action: "delete",
    taskId: Number(taskId)
  });

  return res.status(200).json({ message: "Task deleted" });
};
