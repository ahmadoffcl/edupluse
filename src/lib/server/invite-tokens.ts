import "server-only";
import { createHash, randomBytes } from "node:crypto";

const tokenBytes = 24;
const codeBytes = 4;

export function hashInviteSecret(value: string) {
  return createHash("sha256").update(value.trim()).digest("hex");
}

export function createInviteToken() {
  return randomBytes(tokenBytes).toString("base64url");
}

export function createInviteCode() {
  return randomBytes(codeBytes).toString("hex").toUpperCase();
}

export function inviteStatus(invite: {
  accepted_at?: string | null;
  expires_at: string;
  revoked_at?: string | null;
  used_count?: number | null;
  max_uses?: number | null;
}) {
  if (invite.revoked_at) return "revoked";
  if (new Date(invite.expires_at) < new Date()) return "expired";
  if (invite.accepted_at) return "accepted";
  if ((invite.used_count ?? 0) >= (invite.max_uses ?? 1)) return "used";
  return "pending";
}
