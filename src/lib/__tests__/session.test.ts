import { describe, expect, it } from "vitest";
import { signAppSession, verifyAppSession } from "@/lib/auth/session";

describe("app session", () => {
  it("signs and verifies a session", async () => {
    const token = await signAppSession({
      uid: "user-1",
      email: "user@example.com",
      displayName: "Test User",
      role: "admin",
      orgId: "org-1",
      orgName: "Test Org",
      deviceSessionId: "device-1",
    });

    const session = await verifyAppSession(token);
    expect(session?.role).toBe("admin");
    expect(session?.orgId).toBe("org-1");
  });

  it("rejects tampered tokens", async () => {
    const token = await signAppSession({
      uid: "user-1",
      email: "user@example.com",
      displayName: "Test User",
      role: "student",
      orgId: "org-1",
      orgName: "Test Org",
      deviceSessionId: "device-1",
    });

    await expect(verifyAppSession(`${token}x`)).resolves.toBeNull();
  });
});
