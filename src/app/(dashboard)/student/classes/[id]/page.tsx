import { notFound } from "next/navigation";
import { StudentClassroomDetail } from "@/components/student/student-classes-panel";
import { getDashboardData } from "@/lib/dashboard/server-data";

export default async function StudentClassDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const data = await getDashboardData();
  const classRecord = data.classes.find((item) => item.id === id);

  if (!classRecord || classRecord.enrollmentStatus !== "enrolled") {
    notFound();
  }

  const initialTab =
    tab === "stream" ||
    tab === "classwork" ||
    tab === "materials" ||
    tab === "people"
      ? tab
      : "stream";

  return (
    <StudentClassroomDetail classRecord={classRecord} initialTab={initialTab} />
  );
}
