import express from "express";
import isAuth from "../middleware/isAuth";
import * as QueueWaitAlertController from "../controllers/QueueWaitAlertController";

const queueWaitAlertRoutes = express.Router();

queueWaitAlertRoutes.get("/queue-alerts", isAuth, QueueWaitAlertController.index);
queueWaitAlertRoutes.post("/queue-alerts/check", isAuth, QueueWaitAlertController.checkOverdue);

export default queueWaitAlertRoutes;
