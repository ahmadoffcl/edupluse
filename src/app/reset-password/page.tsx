import { Suspense } from "react";
import { AuthPanel } from "@/components/auth/auth-panel";

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <AuthPanel mode="reset" />
    </Suspense>
  );
}
