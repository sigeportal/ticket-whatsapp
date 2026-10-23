import "../bootstrap";
import { requireSecret } from "../security/config";
export default {
  secret: requireSecret("JWT_SECRET"), expiresIn: "15m",
  refreshSecret: requireSecret("JWT_REFRESH_SECRET"), refreshExpiresIn: "7d"
};
