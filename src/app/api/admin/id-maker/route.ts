import { NextResponse } from "next/server";
import type { UserRecord } from "firebase-admin/auth";
import { z } from "zod";
import { getCurrentAppSession } from "@/lib/auth/server";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";

export const runtime = "nodejs";

const accountSchema = z.object({
  role: z.enum(["student", "teacher"]),
  displayName: z.string().trim().min(2).max(120),
  email: z
    .string()
    .trim()
    .email()
    .transform((value) => value.toLowerCase()),
  phone: z
    .string()
    .trim()
    .max(32)
    .regex(/^[0-9+\-() ]*$/)
    .optional()
    .transform((value) => value || null),
  password: z.string().min(6).max(128),
});

const schema = z.object({
  users: z.array(accountSchema).min(1).max(100),
});

type AccountInput = z.infer<typeof accountSchema>;
type SupabaseServiceClient = NonNullable<
  ReturnType<typeof getSupabaseServiceClient>
>;

function isAdminRole(role: Role) {
  return role === "admin" || role === "super_admin";
}

function errorCode(error: unknown) {
  return typeof error === "object" && error
    ? (error as { code?: string }).code
    : undefined;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to create account.";
}

function isMissingProfileColumn(error: unknown, column: string) {
  const message = errorMessage(error);
  const code = errorCode(error);

  return (
    code === "PGRST204" ||
    code === "42703" ||
    (message.includes(column) &&
      (message.includes("schema cache") || message.includes("does not exist")))
  );
}

function isMissingOptionalProfileColumn(error: unknown) {
  return (
    isMissingProfileColumn(error, "phone") ||
    isMissingProfileColumn(error, "onboarding_completed_at")
  );
}

async function ensureOrganization(
  supabase: SupabaseServiceClient,
  session: NonNullable<Awaited<ReturnType<typeof getCurrentAppSession>>>,
) {
  const { error } = await supabase.from("organizations").upsert(
    {
      id: session.orgId,
      name: session.orgName,
      slug: session.orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      tenant_type: "hybrid_institute",
      status: "active",
    },
    { onConflict: "id" },
  );

  if (error) throw error;
}

async function actorProfileId(supabase: SupabaseServiceClient, uid: string) {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("firebase_uid", uid)
    .maybeSingle();

  return typeof data?.id === "string" ? data.id : null;
}

async function createOrUpdateFirebaseUser(
  account: AccountInput,
): Promise<{ user: UserRecord; created: boolean }> {
  const auth = getFirebaseAdminAuth();

  if (!auth) {
    throw new Error("Firebase Admin credentials are not configured.");
  }

  try {
    const user = await auth.createUser({
      email: account.email,
      password: account.password,
      displayName: account.displayName,
      emailVerified: true,
      disabled: false,
    });

    return { user, created: true };
  } catch (error) {
    if (errorCode(error) !== "auth/email-already-exists") {
      throw error;
    }

    const existing = await auth.getUserByEmail(account.email);
    const user = await auth.updateUser(existing.uid, {
      password: account.password,
      displayName: account.displayName,
      emailVerified: true,
      disabled: false,
    });

    return { user, created: false };
  }
}

async function upsertProfile({
  supabase,
  account,
  firebaseUid,
}: {
  supabase: SupabaseServiceClient;
  account: AccountInput;
  firebaseUid: string;
}) {
  const now = new Date().toISOString();
  const payload = {
    firebase_uid: firebaseUid,
    email: account.email,
    display_name: account.displayName,
    phone: account.phone,
    onboarding_completed_at: now,
  };

  let result = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "firebase_uid" })
    .select("id")
    .single();

  if (result.error && isMissingOptionalProfileColumn(result.error)) {
    const fallbackPayload = {
      firebase_uid: payload.firebase_uid,
      email: payload.email,
      display_name: payload.display_name,
    };
    result = await supabase
      .from("profiles")
      .upsert(fallbackPayload, { onConflict: "firebase_uid" })
      .select("id")
      .single();
  }

  if (result.error) throw result.error;

  return result.data.id as string;
}

async function activateMembership({
  supabase,
  orgId,
  profileId,
  role,
}: {
  supabase: SupabaseServiceClient;
  orgId: string;
  profileId: string;
  role: "student" | "teacher";
}) {
  const { error } = await supabase.from("memberships").upsert(
    {
      org_id: orgId,
      profile_id: profileId,
      role,
      status: "active",
    },
    { onConflict: "org_id,profile_id,role" },
  );

  if (error) throw error;
}

async function recordAudit({
  supabase,
  orgId,
  actorId,
  profileId,
  role,
  created,
}: {
  supabase: SupabaseServiceClient;
  orgId: string;
  actorId: string | null;
  profileId: string;
  role: "student" | "teacher";
  created: boolean;
}) {
  await supabase.from("audit_logs").insert({
    org_id: orgId,
    actor_id: actorId,
    action: created ? "admin.id_maker.created" : "admin.id_maker.linked",
    entity: "profiles",
    entity_id: profileId,
    metadata: {
      role,
    },
  });
}

export async function POST(request: Request) {
  const session = await getCurrentAppSession();
  const supabase = getSupabaseServiceClient();

  if (!session || !isAdminRole(session.role)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  if (!supabase) {
    return NextResponse.json(
      { error: "Workspace data is unavailable." },
      { status: 503 },
    );
  }

  if (!getFirebaseAdminAuth()) {
    return NextResponse.json(
      { error: "Firebase Admin credentials are not configured." },
      { status: 503 },
    );
  }

  const rawBody = await request.json().catch(() => null);
  const parsedBody = schema.safeParse(rawBody);

  if (!parsedBody.success) {
    return NextResponse.json(
      {
        error:
          "Each account needs a valid name, email, phone number, and password of at least 6 characters.",
      },
      { status: 400 },
    );
  }

  let actorId: string | null = null;

  try {
    await ensureOrganization(supabase, session);
    actorId = await actorProfileId(supabase, session.uid);
  } catch {
    return NextResponse.json(
      { error: "Workspace tables are not ready for account creation." },
      { status: 500 },
    );
  }

  const seenEmails = new Set<string>();
  const results = [];

  for (const account of parsedBody.data.users) {
    if (seenEmails.has(account.email)) {
      results.push({
        ok: false,
        email: account.email,
        displayName: account.displayName,
        role: account.role,
        status: "failed",
        message: "Duplicate email in this batch.",
      });
      continue;
    }

    seenEmails.add(account.email);

    try {
      const { user, created } = await createOrUpdateFirebaseUser(account);
      const profileId = await upsertProfile({
        supabase,
        account,
        firebaseUid: user.uid,
      });
      await activateMembership({
        supabase,
        orgId: session.orgId,
        profileId,
        role: account.role,
      });
      await recordAudit({
        supabase,
        orgId: session.orgId,
        actorId,
        profileId,
        role: account.role,
        created,
      }).catch(() => undefined);

      results.push({
        ok: true,
        email: account.email,
        displayName: account.displayName,
        role: account.role,
        status: created ? "created" : "linked",
        message: created
          ? "Login account created."
          : "Existing Firebase account linked and password updated.",
      });
    } catch (error) {
      results.push({
        ok: false,
        email: account.email,
        displayName: account.displayName,
        role: account.role,
        status: "failed",
        message: errorMessage(error),
      });
    }
  }

  return NextResponse.json({
    ok: results.some((result) => result.ok),
    results,
  });
}
