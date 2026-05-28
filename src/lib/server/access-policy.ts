import type { Role } from "@/lib/types";

export function canManageTeacherOwnedRecord({
  role,
  profileId,
  ownerId,
}: {
  role: Role;
  profileId: string | null;
  ownerId: string | null | undefined;
}) {
  if (role === "admin" || role === "super_admin") return true;
  if (role !== "teacher") return false;
  return Boolean(profileId && ownerId && profileId === ownerId);
}
