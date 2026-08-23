import { auth } from "../../auth";
import { isAuthConfigured } from "@/lib/auth-readiness";

export async function getOptionalSession() {
  if (!isAuthConfigured()) return null;
  return auth();
}
