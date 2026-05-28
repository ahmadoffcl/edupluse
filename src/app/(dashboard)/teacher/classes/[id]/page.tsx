import { notFound } from "next/navigation";
import { TeacherClassroomDetail } from "@/components/teacher/classroom-dashboard";
import { getTeacherWorkflowData } from "@/lib/dashboard/teacher-workflow";

export default async function TeacherClassDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const data = await getTeacherWorkflowData();
  const classRecord = data.classes.find((item) => item.id === id);

  if (!classRecord) {
    notFound();
  }

  const initialTab =
    tab === "classwork" ||
    tab === "materials" ||
    tab === "people" ||
    tab === "stream"
      ? tab
      : "stream";

  return (
    <TeacherClassroomDetail
      data={data}
      classRecord={classRecord}
      initialTab={initialTab}
    />
  );
}
