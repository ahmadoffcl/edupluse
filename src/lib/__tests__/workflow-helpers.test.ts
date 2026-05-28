import { describe, expect, it } from "vitest";
import {
  createInviteCode,
  createInviteToken,
  hashInviteSecret,
  inviteStatus,
} from "@/lib/server/invite-tokens";
import {
  fileExtension,
  validateTeacherUpload,
} from "@/lib/server/upload-validation";
import {
  engagementHeavyPerformance,
  performanceBand,
} from "@/lib/server/performance";
import { canManageTeacherOwnedRecord } from "@/lib/server/access-policy";
import { summarizeAttendance } from "@/lib/server/attendance";

describe("invite helpers", () => {
  it("hashes invite secrets and keeps raw tokens non-trivial", () => {
    const token = createInviteToken();
    const code = createInviteCode();

    expect(token.length).toBeGreaterThan(24);
    expect(code).toMatch(/^[A-F0-9]{8}$/);
    expect(hashInviteSecret(" ABC ")).toBe(hashInviteSecret("ABC"));
    expect(hashInviteSecret(token)).not.toBe(token);
  });

  it("resolves invite lifecycle status", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const past = new Date(Date.now() - 60_000).toISOString();

    expect(inviteStatus({ expires_at: future })).toBe("pending");
    expect(inviteStatus({ expires_at: past })).toBe("expired");
    expect(inviteStatus({ expires_at: future, revoked_at: future })).toBe(
      "revoked",
    );
    expect(
      inviteStatus({ expires_at: future, used_count: 2, max_uses: 2 }),
    ).toBe("used");
  });
});

describe("upload validation", () => {
  it("allows classroom document types and blocks executable content", () => {
    const pdf = new File(["content"], "lesson.pdf", {
      type: "application/pdf",
    });
    const script = new File(["alert(1)"], "attack.html", {
      type: "text/html",
    });

    expect(fileExtension("lesson.plan.pdf")).toBe("pdf");
    expect(validateTeacherUpload(pdf)).toEqual({ ok: true });
    expect(validateTeacherUpload(script)).toMatchObject({ ok: false });
  });
});

describe("performance scoring", () => {
  it("rewards engagement and penalizes missing work", () => {
    const strong = engagementHeavyPerformance({
      attendancePercent: 95,
      submittedPercent: 100,
      averageScore: 90,
      xp: 1400,
      missingCount: 0,
      lateCount: 0,
      recentActivityCount: 9,
    });
    const risky = engagementHeavyPerformance({
      attendancePercent: 50,
      submittedPercent: 35,
      averageScore: 60,
      xp: 80,
      missingCount: 4,
      lateCount: 2,
      recentActivityCount: 1,
    });

    expect(strong).toBeGreaterThan(risky);
    expect(performanceBand(strong)).toBe("high_momentum");
    expect(performanceBand(risky)).toBe("at_risk");
  });
});

describe("teacher access policy", () => {
  it("allows admins and only the owning teacher to manage teacher records", () => {
    expect(
      canManageTeacherOwnedRecord({
        role: "teacher",
        profileId: "teacher-1",
        ownerId: "teacher-1",
      }),
    ).toBe(true);
    expect(
      canManageTeacherOwnedRecord({
        role: "teacher",
        profileId: "teacher-1",
        ownerId: "teacher-2",
      }),
    ).toBe(false);
    expect(
      canManageTeacherOwnedRecord({
        role: "admin",
        profileId: null,
        ownerId: "teacher-2",
      }),
    ).toBe(true);
  });
});

describe("attendance summary", () => {
  it("counts late as present engagement and calculates the percentage", () => {
    expect(
      summarizeAttendance([
        { status: "present" },
        { status: "late" },
        { status: "absent" },
        { status: "excused" },
      ]),
    ).toEqual({
      present: 2,
      absent: 1,
      excused: 1,
      total: 4,
      attendancePercent: 50,
    });
  });
});
