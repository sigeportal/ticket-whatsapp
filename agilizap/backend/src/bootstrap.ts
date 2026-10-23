import { validateRuntimeConfig } from "./security/config";
import dotenv from "dotenv";

dotenv.config({
  path: process.env.NODE_ENV === "test" ? ".env.test" : ".env"
});

// Validate before any database, queue or WhatsApp module can start.
validateRuntimeConfig();
