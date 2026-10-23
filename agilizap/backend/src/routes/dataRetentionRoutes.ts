import express from "express";
import isAuth from "../middleware/isAuth";
import * as DataRetentionController from "../controllers/DataRetentionController";

const dataRetentionRoutes = express.Router();

dataRetentionRoutes.get("/data-retention/preview", isAuth, DataRetentionController.preview);
dataRetentionRoutes.post("/data-retention/purge", isAuth, DataRetentionController.purge);
dataRetentionRoutes.post("/tickets/:ticketId/legal-hold", isAuth, DataRetentionController.updateLegalHold);
dataRetentionRoutes.get("/contacts/:contactId/data-dossier", isAuth, DataRetentionController.exportSubject);
dataRetentionRoutes.post("/contacts/:contactId/anonymize", isAuth, DataRetentionController.anonymizeSubject);
dataRetentionRoutes.post("/contacts/:contactId/campaign-opt-out", isAuth, DataRetentionController.optOut);

export default dataRetentionRoutes;
