import { InviteAcceptanceCard } from "@/components/invite/invite-acceptance-card";
import { PublicNavbar } from "@/components/layout/public-navbar";

export default async function InviteAcceptancePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <>
      <PublicNavbar />
      <main className="grid min-h-screen place-items-center px-4 pt-24">
        <InviteAcceptanceCard token={token} />
      </main>
    </>
  );
}
