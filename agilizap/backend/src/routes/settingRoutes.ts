import { Router } from "express";
import isSuper from "../middleware/isSuper";
import isAuth from "../middleware/isAuth";

import * as SettingController from "../controllers/SettingController";
import multer from "../security/secureUpload";
import uploadConfig from "../config/uploadlogo";
const upload = multer(uploadConfig);

const settingRoutes = Router();

settingRoutes.get("/settings", isAuth, SettingController.index);

settingRoutes.get("/settings/:settingKey", isAuth, SettingController.show);

settingRoutes.put("/settings/:settingKey", isAuth, SettingController.update);

settingRoutes.post(
  "/settings/media-upload",
  isAuth, isSuper,
  upload.array("file"),
  SettingController.mediaUpload
);

export default settingRoutes;
