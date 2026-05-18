import { Suspense } from "react";
import { AuthPanel } from "@/components/auth/auth-panel";

export default function SignupPage() {
  return (
    <Suspense>
      <AuthPanel mode="signup" />
    </Suspense>
  );
}
