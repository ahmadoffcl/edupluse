import { TeacherClassroomHome } from "@/components/teacher/classroom-dashboard";
import { getTeacherWorkflowData } from "@/lib/dashboard/teacher-workflow";

export default async function TeacherClassesPage() {
  const data = await getTeacherWorkflowData();

  return <TeacherClassroomHome data={data} />;
}
