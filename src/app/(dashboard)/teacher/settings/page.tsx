import { FeaturePage } from "@/components/dashboard/feature-page";

export default function TeacherSettingsPage() {
  return (
    <FeaturePage
      eyebrow="Teacher settings"
      title="Teaching preferences, profile, and workflow controls."
      description="Configure notifications, grading preferences, upload defaults, office hours, and AI assistance."
      action="Save settings"
      items={[
        {
          title: "Profile",
          meta: "Bio, subjects, availability",
          stat: "Complete",
          tone: "success",
        },
        {
          title: "Grading",
          meta: "Rubrics and return targets",
          stat: "4 rubrics",
          tone: "info",
        },
        {
          title: "AI guardrails",
          meta: "Summaries and quiz drafts",
          stat: "Enabled",
          tone: "success",
        },
      ]}
    />
  );
}
