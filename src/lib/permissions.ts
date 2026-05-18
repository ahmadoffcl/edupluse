import type { Role } from "@/lib/types";

export const roleWeights: Record<Role, number> = {
  student: 10,
  teacher: 20,
  admin: 30,
  super_admin: 40,
};

const permissions = {
  viewStudentDashboard: ["student", "teacher", "admin", "super_admin"],
  submitAssignment: ["student"],
  gradeAssignment: ["teacher", "admin", "super_admin"],
  markAttendance: ["teacher", "admin", "super_admin"],
  manageUsers: ["admin", "super_admin"],
  manageOrganizations: ["super_admin"],
  moderateContent: ["admin", "super_admin"],
  viewAnalytics: ["teacher", "admin", "super_admin"],
  useAiAssistant: ["student", "teacher", "admin", "super_admin"],
} as const;

export type Permission = keyof typeof permissions;

export function can(role: Role, permission: Permission) {
  return (permissions[permission] as readonly Role[]).includes(role);
}

export function canAccessPath(role: Role, pathname: string) {
  if (pathname.startsWith("/student")) {
    return role === "student" || role === "admin" || role === "super_admin";
  }

  if (pathname.startsWith("/teacher")) {
    return role === "teacher" || role === "admin" || role === "super_admin";
  }

  if (pathname.startsWith("/admin")) {
    return role === "admin" || role === "super_admin";
  }

  return true;
}

export function homeForRole(role: Role) {
  if (role === "teacher") return "/teacher";
  if (role === "admin" || role === "super_admin") return "/admin";
  return "/student";
}
