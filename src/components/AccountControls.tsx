import { auth } from "../../auth";
import { isAuthConfigured } from "@/lib/auth-readiness";
import { AccountMenu } from "@/components/AccountMenu";

export async function AccountControls() {
  const authConfigured = isAuthConfigured();
  const session = authConfigured ? await auth() : null;
  const user = session?.user
    ? {
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        image: session.user.image ?? null,
      }
    : null;

  return <AccountMenu authConfigured={authConfigured} user={user} />;
}
