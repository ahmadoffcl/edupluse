import { TeacherClassroomHome } from "@/components/teacher/classroom-dashboard";
import { getTeacherWorkflowData } from "@/lib/dashboard/teacher-workflow";
import { getFeatureFlags } from "@/lib/server/feature-flags";

export default async function TeacherDashboardPage() {
  const [data, flags] = await Promise.all([
    getTeacherWorkflowData(),
    getFeatureFlags(),
  ]);

  return (
    <TeacherClassroomHome
      data={data}
      smartLearningEnabled={flags.smartLearningEnabled}
    />
  );
}
