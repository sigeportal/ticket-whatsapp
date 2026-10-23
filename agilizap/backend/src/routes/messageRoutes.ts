import { sendLimit } from "../middleware/securityHttp";
import { Router } from "express";
import multer from "../security/secureUpload";
import isAuth from "../middleware/isAuth";
import uploadConfig from "../config/upload";
import tokenAuth from "../middleware/tokenAuth";

import * as MessageController from "../controllers/MessageController";

const messageRoutes = Router();

const upload = multer(uploadConfig);

messageRoutes.get("/messages/:ticketId", isAuth, MessageController.index);
messageRoutes.post("/messages/:ticketId", isAuth, sendLimit, upload.array("medias"), MessageController.store);
messageRoutes.post("/messages/:messageId/retry", isAuth, MessageController.retry);
messageRoutes.delete("/messages/:messageId", isAuth, MessageController.remove);
messageRoutes.post("/api/messages/send", tokenAuth, sendLimit, upload.array("medias"), MessageController.send);
messageRoutes.post("/messages/edit/:messageId", isAuth, MessageController.edit);
messageRoutes.post('/message/forward', isAuth, MessageController.forwardMessage);
messageRoutes.post('/messages/:messageId/reactions', isAuth, MessageController.addReaction);

export default messageRoutes;
