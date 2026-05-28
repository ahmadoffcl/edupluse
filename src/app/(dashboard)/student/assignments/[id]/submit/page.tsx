import { notFound } from "next/navigation";
import { StudentAssignmentDetail } from "@/components/student/student-assignment-detail";
import { getDashboardData } from "@/lib/dashboard/server-data";

export default async function StudentAssignmentSubmitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getDashboardData();
  const assignment = data.assignments.find((item) => item.id === id);

  if (!assignment) {
    notFound();
  }

  return <StudentAssignmentDetail assignment={assignment} uploadFocused />;
}
