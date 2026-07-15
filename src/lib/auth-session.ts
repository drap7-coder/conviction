import { auth } from "../../auth";

export async function getOptionalSession() {
  if (!process.env.AUTH_SECRET) return null;
  return auth();
}
