import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

const studentSteps = [
  {
    title: "Academic information",
    subtitle: "Tell EduPulse where you study and what program you are in.",
    fields: [
      { label: "Institution name", placeholder: "Your institute" },
      { label: "Department name", placeholder: "Computer Science" },
      { label: "Degree or program", placeholder: "BSCS, BBA, FSC Pre-Medical" },
      { label: "Semester or year", placeholder: "Semester 3" },
    ],
  },
  {
    title: "Class details",
    subtitle: "Add the identifiers your institute uses for class placement.",
    fields: [
      { label: "Section", placeholder: "A" },
      { label: "Registration number", placeholder: "2026-CS-014" },
      { label: "Student ID", placeholder: "STU-10024" },
      { label: "Campus", placeholder: "Main campus" },
    ],
  },
  {
    title: "Initial enrollment",
    subtitle:
      "Recommended classes appear here when teachers publish real sections.",
    fields: [
      { label: "Search classes", placeholder: "Search by subject or teacher" },
    ],
    emptyTitle: "No live class recommendations yet",
    emptyText:
      "Ask your teacher or admin for an invite code. You can join more classes later.",
  },
  {
    title: "Public identity",
    subtitle:
      "Create the username classmates will see in chats, rankings, and activity.",
    fields: [
      { label: "Username", placeholder: "@ahmad, @zara.dev, @usman_bscs" },
      { label: "Profile photo", placeholder: "Upload later" },
      { label: "Bio or status", placeholder: "Learning data structures" },
    ],
  },
];

export default function StudentOnboardingPage() {
  return (
    <OnboardingFlow
      audience="student"
      title="Set up your learning profile"
      description="A focused setup flow that connects your academic identity, classes, and public username."
      finishHref="/student"
      steps={studentSteps}
    />
  );
}
