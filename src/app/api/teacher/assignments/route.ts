import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isWorkflowResponse,
  requireClassAccess,
  requireWorkflowContext,
  writeAuditLog,
} from "@/lib/server/workflow-auth";
import {
  safeStorageName,
  validateTeacherUpload,
} from "@/lib/server/upload-validation";

export const runtime = "nodejs";

const schema = z.object({
  classId: z.string().uuid(),
  subjectId: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(2).max(180),
  instructions: z.string().trim().max(4000).optional().nullable(),
  dueAt: z.string().datetime().optional().nullable(),
  points: z.coerce.number().int().min(0).max(10000).default(100),
  publish: z.boolean().optional().default(true),
});

type AssignmentAttachment = {
  path: string;
  name: string;
  size: number;
  mimeType: string;
};

function deadlineLabel(value?: string | null) {
  if (!value) return "No deadline set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Deadline set";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function reminderTime(dueAt: string, offsetMs: number) {
  const dueDate = new Date(dueAt);
  if (Number.isNaN(dueDate.getTime())) return null;
  const scheduled = new Date(dueDate.getTime() - offsetMs);
  if (scheduled.getTime() <= Date.now()) return null;
  return scheduled.toISOString();
}

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function parsePayload(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("multipart/form-data")) {
    return {
      body: schema.parse(await request.json()),
      files: [] as File[],
    };
  }

  const formData = await request.formData();
  return {
    body: schema.parse({
      classId: textValue(formData, "classId"),
      subjectId: textValue(formData, "subjectId") || null,
      title: textValue(formData, "title"),
      instructions: textValue(formData, "instructions") || null,
      dueAt: textValue(formData, "dueAt") || null,
      points: textValue(formData, "points") || 100,
      publish: textValue(formData, "publish") !== "false",
    }),
    files: formData
      .getAll("files")
      .filter((file): file is File => file instanceof File && file.size > 0),
  };
}

export async function POST(request: Request) {
  const context = await requireWorkflowContext([
    "teacher",
    "admin",
    "super_admin",
  ]);
  if (isWorkflowResponse(context)) return context;
  if (!context.profileId) {
    return NextResponse.json(
      { ok: false, error: "Profile is not ready yet." },
      { status: 404 },
    );
  }

  const profileId = context.profileId;
  const parsed = await parsePayload(request).catch((error) => {
    if (error instanceof z.ZodError) {
      return {
        error: error.issues[0]?.message ?? "Assignment details are invalid.",
      };
    }
    return { error: "Assignment details are invalid." };
  });
  if ("error" in parsed) {
    return NextResponse.json(
      { ok: false, error: parsed.error },
      { status: 400 },
    );
  }

  const { body, files } = parsed;
  const classAccess = await requireClassAccess(context, body.classId);
  if (classAccess && isWorkflowResponse(classAccess)) return classAccess;

  const attachments: AssignmentAttachment[] = [];
  for (const file of files) {
    const validation = validateTeacherUpload(file);
    if (!validation.ok) {
      return NextResponse.json(
        { ok: false, error: validation.error },
        { status: 400 },
      );
    }

    const safeName = safeStorageName(file.name);
    const filePath = `${context.session.orgId}/assignments/${profileId}/${randomUUID()}-${safeName}`;
    const { error: uploadError } = await context.supabase.storage
      .from("resources")
      .upload(filePath, Buffer.from(await file.arrayBuffer()), {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { ok: false, error: "Unable to upload assignment file." },
        { status: 500 },
      );
    }

    attachments.push({
      path: filePath,
      name: file.name,
      size: file.size,
      mimeType: file.type,
    });
  }

  const status = body.publish ? "published" : "draft";
  const assignmentPayload = {
    org_id: context.session.orgId,
    class_id: body.classId,
    subject_id: body.subjectId || null,
    teacher_id: profileId,
    title: body.title,
    instructions: body.instructions || null,
    due_at: body.dueAt || null,
    points: body.points,
    status,
    published_at: body.publish ? new Date().toISOString() : null,
    attachments,
  };

  let assignmentResult = await context.supabase
    .from("assignments")
    .insert(assignmentPayload)
    .select("id,title,status")
    .single();

  if (assignmentResult.error) {
    const fallbackPayload = { ...assignmentPayload };
    delete (fallbackPayload as { attachments?: AssignmentAttachment[] })
      .attachments;
    delete (fallbackPayload as { published_at?: string | null }).published_at;
    assignmentResult = await context.supabase
      .from("assignments")
      .insert(fallbackPayload)
      .select("id,title,status")
      .single();
  }

  if (assignmentResult.error || !assignmentResult.data) {
    if (attachments.length) {
      await context.supabase.storage
        .from("resources")
        .remove(attachments.map((attachment) => attachment.path));
    }

    return NextResponse.json(
      { ok: false, error: "Unable to create assignment." },
      { status: 500 },
    );
  }

  const data = assignmentResult.data;
  const { data: enrollments } = await context.supabase
    .from("enrollments")
    .select("student_id")
    .eq("org_id", context.session.orgId)
    .eq("class_id", body.classId);
  const notifications = (
    (enrollments ?? []) as Array<{ student_id: string }>
  ).flatMap((enrollment) => {
    type AssignmentNotification = {
      org_id: string;
      recipient_id: string;
      title: string;
      body: string;
      kind: string;
      action_url: string;
      metadata: {
        assignmentId: string;
        classId: string;
        dueAt: string | null | undefined;
      };
      scheduled_for?: string;
    };
    const actionUrl = `/student/assignments/${data.id}`;
    const base = {
      org_id: context.session.orgId,
      recipient_id: enrollment.student_id,
      action_url: actionUrl,
      metadata: {
        assignmentId: data.id,
        classId: body.classId,
        dueAt: body.dueAt,
      },
    };
    const rows: AssignmentNotification[] = [
      {
        ...base,
        title: "New assignment",
        body: `${body.title} has been posted. Deadline: ${deadlineLabel(body.dueAt)}.`,
        kind: "assignment",
      },
    ];

    if (body.dueAt) {
      const oneDay = reminderTime(body.dueAt, 24 * 60 * 60 * 1000);
      const oneHour = reminderTime(body.dueAt, 60 * 60 * 1000);
      if (oneDay) {
        rows.push({
          ...base,
          title: "Assignment due tomorrow",
          body: `${body.title} is due on ${deadlineLabel(body.dueAt)}.`,
          kind: "assignment_reminder",
          scheduled_for: oneDay,
        });
      }
      if (oneHour) {
        rows.push({
          ...base,
          title: "Assignment due in 1 hour",
          body: `${body.title} is due at ${deadlineLabel(body.dueAt)}.`,
          kind: "assignment_reminder",
          scheduled_for: oneHour,
        });
      }
    }

    return rows;
  });

  if (notifications.length) {
    const { error: notificationError } = await context.supabase
      .from("notifications")
      .insert(notifications);

    if (notificationError) {
      const fallbackNotifications = notifications.map((notification) => ({
        org_id: notification.org_id,
        recipient_id: notification.recipient_id,
        title: notification.title,
        body: notification.body,
        kind: notification.kind,
      }));
      const { error: fallbackNotificationError } = await context.supabase
        .from("notifications")
        .insert(fallbackNotifications);

      if (fallbackNotificationError) {
        console.warn(
          "Assignment notifications skipped",
          fallbackNotificationError.code,
        );
      }
    }
  }

  await writeAuditLog(context, {
    action: "teacher.assignment.created",
    entity: "assignments",
    entityId: data.id,
    metadata: {
      classId: body.classId,
      status,
      attachments: attachments.length,
    },
  });

  return NextResponse.json({ ok: true, assignment: data });
}
