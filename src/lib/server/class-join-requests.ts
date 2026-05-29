import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

type DbRecord = Record<string, unknown>;

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export function isMissingClassJoinRequestTable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };

  return (
    candidate.code === "42P01" ||
    candidate.code === "PGRST205" ||
    Boolean(
      candidate.message?.includes("class_join_requests") ||
      candidate.message?.includes("Could not find the table"),
    )
  );
}

export async function requestClassJoins({
  supabase,
  orgId,
  studentId,
  studentName,
  classIds,
}: {
  supabase: SupabaseClient;
  orgId: string;
  studentId: string;
  studentName: string;
  classIds: string[];
}) {
  const uniqueClassIds = Array.from(new Set(classIds.filter(Boolean)));
  if (uniqueClassIds.length === 0) {
    return { ok: true, created: 0, setupPending: false };
  }

  const { data: classes, error: classError } = await supabase
    .from("classes")
    .select("id,name,teacher_id")
    .eq("org_id", orgId)
    .in("id", uniqueClassIds);

  if (classError) {
    return {
      ok: false,
      created: 0,
      setupPending: false,
      error: "Unable to verify selected classes.",
    };
  }

  const classRows = ((classes ?? []) as DbRecord[]).filter((row) =>
    Boolean(stringValue(row.id)),
  );
  if (classRows.length === 0) {
    return { ok: true, created: 0, setupPending: false };
  }

  const { data: enrollments, error: enrollmentError } = await supabase
    .from("enrollments")
    .select("class_id")
    .eq("org_id", orgId)
    .eq("student_id", studentId)
    .in(
      "class_id",
      classRows.map((row) => stringValue(row.id)),
    );

  if (enrollmentError) {
    return {
      ok: false,
      created: 0,
      setupPending: false,
      error: "Unable to check existing enrollment.",
    };
  }

  const enrolledClassIds = new Set(
    ((enrollments ?? []) as DbRecord[]).map((row) => stringValue(row.class_id)),
  );
  const requestRows = classRows
    .filter((row) => !enrolledClassIds.has(stringValue(row.id)))
    .map((row) => ({
      org_id: orgId,
      class_id: stringValue(row.id),
      student_id: studentId,
      status: "pending",
      requested_at: new Date().toISOString(),
      reviewed_at: null,
      reviewed_by: null,
      updated_at: new Date().toISOString(),
    }));

  if (requestRows.length === 0) {
    return { ok: true, created: 0, setupPending: false };
  }

  const { error: requestError } = await supabase
    .from("class_join_requests")
    .upsert(requestRows, {
      onConflict: "class_id,student_id",
    });

  if (requestError) {
    if (isMissingClassJoinRequestTable(requestError)) {
      return { ok: false, created: 0, setupPending: true };
    }

    return {
      ok: false,
      created: 0,
      setupPending: false,
      error: "Unable to request class access.",
    };
  }

  const teacherNotifications = classRows
    .filter((row) => {
      const classId = stringValue(row.id);
      return (
        requestRows.some((request) => request.class_id === classId) &&
        Boolean(stringValue(row.teacher_id))
      );
    })
    .map((row) => ({
      org_id: orgId,
      recipient_id: stringValue(row.teacher_id),
      title: "Class join request",
      body: `${studentName} requested to join ${stringValue(row.name, "your class")}.`,
      kind: "class_request",
      action_url: `/teacher/classes/${stringValue(row.id)}?tab=people`,
      metadata: {
        classId: stringValue(row.id),
        studentId,
      },
    }));

  if (teacherNotifications.length > 0) {
    const { error: notificationError } = await supabase
      .from("notifications")
      .insert(teacherNotifications);

    if (notificationError) {
      const fallbackNotifications = teacherNotifications.map(
        (notification) => ({
          org_id: notification.org_id,
          recipient_id: notification.recipient_id,
          title: notification.title,
          body: notification.body,
          kind: notification.kind,
        }),
      );
      await supabase.from("notifications").insert(fallbackNotifications);
    }
  }

  return {
    ok: true,
    created: requestRows.length,
    setupPending: false,
  };
}
