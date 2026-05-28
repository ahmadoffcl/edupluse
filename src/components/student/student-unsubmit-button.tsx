"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function StudentUnsubmitButton({
  assignmentId,
  className,
}: {
  assignmentId: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function unsubmit() {
    setBusy(true);

    try {
      const response = await fetch(`/api/student/submissions/${assignmentId}`, {
        method: "DELETE",
      });
      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!response.ok || result?.ok === false) {
        throw new Error(result?.error ?? "Unable to unsubmit assignment.");
      }

      toast.success("Assignment unsubmitted.");
      router.refresh();
    } catch (error) {
      toast.error("Unsubmit failed", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className={className}
      disabled={busy}
      onClick={unsubmit}
    >
      <RotateCcw />
      {busy ? "Unsubmitting..." : "Unsubmit"}
    </Button>
  );
}
