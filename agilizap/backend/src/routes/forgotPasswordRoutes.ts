import { Router } from "express";
import * as ForgotController from "../controllers/ForgotController";
import { recoveryLimit } from "../middleware/securityHttp";
const routes = Router();
routes.post("/forgetpassword", recoveryLimit, ForgotController.store);
routes.post("/resetpasswords", recoveryLimit, ForgotController.resetPasswords);
export default routes;
