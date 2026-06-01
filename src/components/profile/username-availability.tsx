"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Info, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isValidUsername,
  normalizeUsername,
  usernameValidationMessage,
} from "@/lib/username";

type UsernameMode = "current" | "new";
type AvailabilityStatus =
  | "idle"
  | "invalid"
  | "checking"
  | "available"
  | "taken"
  | "error";

export function useUsernameAvailability(
  value: string,
  mode: UsernameMode = "current",
) {
  const username = useMemo(() => normalizeUsername(value), [value]);
  const localMessage = useMemo(
    () => usernameValidationMessage(value),
    [value],
  );
  const [status, setStatus] = useState<AvailabilityStatus>(
    username ? "checking" : "idle",
  );
  const [message, setMessage] = useState(localMessage ?? "");

  useEffect(() => {
    if (!username) {
      setStatus("idle");
      setMessage("Choose a public @username.");
      return;
    }

    if (!isValidUsername(username)) {
      setStatus("invalid");
      setMessage(localMessage ?? "Username format is not valid.");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setStatus("checking");
      setMessage("Checking username...");

      try {
        const params = new URLSearchParams({ username, mode });
        const response = await fetch(
          `/api/profile/username-availability?${params.toString()}`,
          { cache: "no-store", signal: controller.signal },
        );
        const payload = (await response.json().catch(() => null)) as {
          available?: boolean;
          message?: string;
        } | null;

        if (!response.ok) {
          throw new Error(payload?.message ?? "Unable to check username.");
        }

        setStatus(payload?.available ? "available" : "taken");
        setMessage(
          payload?.message ??
            (payload?.available
              ? `@${username} is available.`
              : `@${username} is already taken.`),
        );
      } catch (error) {
        if (controller.signal.aborted) return;
        setStatus("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to check username right now.",
        );
      }
    }, 320);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [localMessage, mode, username]);

  return {
    username,
    status,
    message,
    isChecking: status === "checking",
    isAvailable: status === "available",
    canSubmit: Boolean(username) && status === "available",
  };
}

export function UsernameAvailabilityNote({
  status,
  message,
}: {
  status: AvailabilityStatus;
  message: string;
}) {
  const positive = status === "available";
  const negative =
    status === "taken" || status === "invalid" || status === "error";
  const Icon =
    status === "checking"
      ? Loader2
      : positive
        ? CheckCircle2
        : negative
          ? XCircle
          : Info;

  return (
    <p
      className={cn(
        "flex min-h-5 items-center gap-1.5 text-xs font-medium",
        positive && "text-emerald-600 dark:text-emerald-300",
        negative && "text-destructive",
        !positive && !negative && "text-muted-foreground",
      )}
    >
      <Icon
        className={cn("size-3.5", status === "checking" && "animate-spin")}
      />
      {message}
    </p>
  );
}
