import { Router } from "express";
import { HealthController } from "../controllers/HealthController";

const healthRoutes = Router();

// Fast liveness probes
healthRoutes.get("/health", HealthController.live);
healthRoutes.get("/health/live", HealthController.live);

// Dependency readiness probe
healthRoutes.get("/health/ready", HealthController.ready);

// Independent WhatsApp connections observability
healthRoutes.get("/health/whatsapp", HealthController.whatsapp);

// Operational metrics and alert statuses
healthRoutes.get("/health/metrics", HealthController.metrics);

export default healthRoutes;
