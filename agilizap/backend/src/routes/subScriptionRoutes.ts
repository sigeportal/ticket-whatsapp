import express from "express";
import isAuth from "../middleware/isAuth";

import * as SubscriptionController from "../controllers/SubscriptionController";

const subscriptionRoutes = express.Router();
subscriptionRoutes.post("/subscription", isAuth, SubscriptionController.createSubscription);
subscriptionRoutes.post("/subscription/create/webhook", isAuth, SubscriptionController.createWebhook);
subscriptionRoutes.post("/subscription/webhook/:type?", isAuth, SubscriptionController.webhook);

export default subscriptionRoutes;
