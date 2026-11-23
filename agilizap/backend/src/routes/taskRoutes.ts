import express from "express";
import isAuth from "../middleware/isAuth";
import * as TaskController from "../controllers/TaskController";

const taskRoutes = express.Router();

taskRoutes.get("/tasks", isAuth, TaskController.index);
taskRoutes.post("/tasks", isAuth, TaskController.store);
taskRoutes.put("/tasks/:taskId", isAuth, TaskController.update);
taskRoutes.delete("/tasks/:taskId", isAuth, TaskController.remove);

export default taskRoutes;
