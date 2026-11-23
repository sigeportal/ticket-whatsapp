import AppError from "../../errors/AppError";
import Task from "../../models/Task";

const DeleteTaskService = async (
  taskId: string | number,
  companyId: number
): Promise<void> => {
  const task = await Task.findOne({
    where: { id: taskId, companyId }
  });

  if (!task) {
    throw new AppError("ERR_TASK_NOT_FOUND", 404);
  }

  await task.destroy();
};

export default DeleteTaskService;
