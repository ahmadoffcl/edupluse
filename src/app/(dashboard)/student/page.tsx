import Link from "next/link";
import {
  ClassroomEmptyHome,
  ClassroomHomeFrame,
} from "@/components/dashboard/classroom-home-frame";
import { StudentClassesPanel } from "@/components/student/student-classes-panel";
import { Button } from "@/components/ui/button";
import { getCurrentAppSession } from "@/lib/auth/server";
import { getDashboardData } from "@/lib/dashboard/server-data";

export default async function StudentDashboardPage() {
  const [data, session] = await Promise.all([
    getDashboardData(),
    getCurrentAppSession(),
  ]);
  const enrolledClasses = data.classes.filter(
    (classRecord) => classRecord.enrollmentStatus === "enrolled",
  );

  if (enrolledClasses.length === 0) {
    return (
      <ClassroomEmptyHome
        role="student"
        title="Join a class to get started"
        userName={session?.displayName}
        userPhotoUrl={session?.photoURL}
      >
        <Button asChild className="rounded-full bg-[#0b57d0] px-7 text-white hover:bg-[#0842a0]">
          <Link href="/student/classes">Join class</Link>
        </Button>
      </ClassroomEmptyHome>
    );
  }

  return (
    <ClassroomHomeFrame
      role="student"
      userName={session?.displayName}
      userPhotoUrl={session?.photoURL}
      className="p-4 sm:p-6"
    >
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
    </ClassroomHomeFrame>
  );
}
