import * as Yup from "yup";
import { i18n } from "../translate/i18n";

// Match the backend policy, including bcrypt's UTF-8 byte limit.
export const passwordSchema = Yup.string().test(
  "password-policy",
  () => i18n.t("backendErrors.ERR_PASSWORD_POLICY"),
  value => !value || (value.length >= 8 && new TextEncoder().encode(value).length <= 72 &&
    /[A-Z]/.test(value) && /[a-z]/.test(value) && /[0-9]/.test(value))
);
