import Link from "next/link";
import { StudentClassesPanel } from "@/components/student/student-classes-panel";
import { Button } from "@/components/ui/button";
import { getDashboardData } from "@/lib/dashboard/server-data";

export default async function StudentDashboardPage() {
  const data = await getDashboardData();
  const enrolledClasses = data.classes.filter(
    (classRecord) => classRecord.enrollmentStatus === "enrolled",
  );

  if (enrolledClasses.length === 0) {
    return (
      <div className="flex min-h-[calc(100vh-6rem)] flex-col items-center justify-center px-5 py-12 text-center">
        <img
          alt=""
          className="h-auto w-[min(230px,58vw)] select-none object-contain"
          src="/classroom-empty-state.png"
        />
        <p className="mt-8 text-sm font-normal text-[#202124]">
          Join a class to get started
        </p>
        <Button
          asChild
          className="mt-5 rounded-full bg-[#0b57d0] px-7 text-white hover:bg-[#0842a0]"
        >
          <Link href="/student/classes">Join class</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">
          Home
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Open your enrolled classrooms, classwork, and materials.
        </p>
      </div>
      <StudentClassesPanel classes={data.classes} compact />
    </div>
  );
}
