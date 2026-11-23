import { Op } from "sequelize";
import Task from "../../models/Task";
import User from "../../models/User";

interface ListTasksRequest {
  companyId: number;
  userId: number;
  profile: string;
  status?: string;
  priority?: string;
  searchParam?: string;
  scope?: string;
}

export const TASK_INCLUDES = [
  { model: User, as: "user", attributes: ["id", "name"] },
  { model: User, as: "assignedUser", attributes: ["id", "name"] }
];

const ListTasksService = async ({
  companyId,
  userId,
  profile,
  status,
  priority,
  searchParam,
  scope
}: ListTasksRequest): Promise<Task[]> => {
  const where: any = { companyId };

  const canViewAll = profile === "admin" || profile === "supervisor";
  if (!canViewAll || scope !== "all") {
    where[Op.or] = [{ userId }, { assignedUserId: userId }];
  }

  if (status === "pending") {
    where.completed = false;
  } else if (status === "completed") {
    where.completed = true;
  }

  if (priority && ["low", "medium", "high"].includes(priority)) {
    where.priority = priority;
  }

  if (searchParam && searchParam.trim()) {
    const term = `%${searchParam.trim()}%`;
    const searchCondition = {
      [Op.or]: [
        { title: { [Op.iLike]: term } },
        { description: { [Op.iLike]: term } }
      ]
    };
    where[Op.and] = where[Op.and] ? [...where[Op.and], searchCondition] : [searchCondition];
  }

  const tasks = await Task.findAll({
    where,
    include: TASK_INCLUDES,
    order: [
      ["completed", "ASC"],
      ["dueDate", "ASC NULLS LAST"],
      ["createdAt", "DESC"]
    ]
  });

  return tasks;
};

export default ListTasksService;
