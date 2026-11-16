import { Router } from "express";
import isAuth from "../middleware/isAuth";
import { HealthController } from "../controllers/HealthController";

const healthRoutes = Router();

// Fast liveness probes
healthRoutes.get("/health", HealthController.live);
healthRoutes.get("/health/live", HealthController.live);

// Dependency readiness probe
healthRoutes.get("/health/ready", HealthController.ready);

// Independent WhatsApp connections observability
healthRoutes.get("/health/whatsapp", isAuth, HealthController.whatsapp);

// Operational metrics and alert statuses
healthRoutes.get("/health/metrics", isAuth, HealthController.metrics);

export default healthRoutes;
