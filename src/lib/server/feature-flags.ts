import "server-only";
import { getCurrentAppSession } from "@/lib/auth/server";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

type FeatureFlags = {
  smartLearningEnabled: boolean;
};

const defaultFlags: FeatureFlags = {
  smartLearningEnabled: false,
};

function isMissingFeatureTable(error: unknown) {
  const candidate = error as { message?: string; code?: string };
  return (
    candidate?.code === "42P01" ||
    Boolean(candidate?.message?.includes("organization_feature_flags"))
  );
}

export async function getFeatureFlags(): Promise<FeatureFlags> {
  const session = await getCurrentAppSession();
  const supabase = getSupabaseServiceClient();
  if (!session || !supabase) return defaultFlags;

  const { data, error } = await supabase
    .from("organization_feature_flags")
    .select("smart_learning_enabled")
    .eq("org_id", session.orgId)
    .maybeSingle();

  if (error) {
    if (!isMissingFeatureTable(error)) {
      console.warn("Feature flags unavailable", error.code);
    }
    return defaultFlags;
  }

  return {
    smartLearningEnabled: Boolean(data?.smart_learning_enabled),
  };
}
