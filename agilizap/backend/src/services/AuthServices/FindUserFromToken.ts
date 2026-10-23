import { loadSession } from "../../security/session";
import { verify } from "jsonwebtoken";
import ShowUserService from "../UserServices/ShowUserService";
import authConfig from "../../config/auth";
import User from "../../models/User";

interface RefreshTokenPayload {
  id: string;
  tokenVersion: number;
  companyId: number;
}

export default async function FindUserFromToken(token: string): Promise<User> {
  const user = await loadSession(token, true);
  return user;
}
