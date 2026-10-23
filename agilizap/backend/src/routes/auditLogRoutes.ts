import express from "express";
import isAuth from "../middleware/isAuth";
import * as AuditLogController from "../controllers/AuditLogController";

const auditLogRoutes = express.Router();

auditLogRoutes.get("/audit-logs", isAuth, AuditLogController.index);
auditLogRoutes.get("/audit-logs/export", isAuth, AuditLogController.exportLogs);

export default auditLogRoutes;
