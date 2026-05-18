import { describe, expect, it } from "vitest";
import { can, canAccessPath, homeForRole } from "@/lib/permissions";

describe("permissions", () => {
  it("keeps student-only actions scoped", () => {
    expect(can("student", "submitAssignment")).toBe(true);
    expect(can("teacher", "submitAssignment")).toBe(false);
  });

  it("allows teachers to grade and mark attendance", () => {
    expect(can("teacher", "gradeAssignment")).toBe(true);
    expect(can("teacher", "markAttendance")).toBe(true);
  });

  it("keeps admin routes restricted", () => {
    expect(canAccessPath("student", "/admin")).toBe(false);
    expect(canAccessPath("admin", "/admin")).toBe(true);
    expect(homeForRole("teacher")).toBe("/teacher");
  });
});
