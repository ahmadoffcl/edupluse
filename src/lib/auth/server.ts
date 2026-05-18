import "server-only";
import { cookies } from "next/headers";
import { sessionCookieName, verifyAppSession } from "@/lib/auth/session";

export async function getCurrentAppSession() {
  const cookieStore = await cookies();
  return verifyAppSession(cookieStore.get(sessionCookieName)?.value);
}
