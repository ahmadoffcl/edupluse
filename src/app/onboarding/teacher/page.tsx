import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

const teacherSteps = [
  {
    title: "Professional information",
    subtitle: "Set the academic profile students and admins will recognize.",
    fields: [
      { label: "Institution", placeholder: "Your institute" },
      { label: "Department", placeholder: "Computer Science" },
      { label: "Subjects taught", placeholder: "Data Structures, Physics" },
      { label: "Qualification", placeholder: "Professor, Lecturer" },
      { label: "Experience level", placeholder: "5 years" },
    ],
  },
  {
    title: "Teaching details",
    subtitle: "Define when, where, and how you teach.",
    fields: [
      { label: "Classes", placeholder: "BSCS Semester 3" },
      { label: "Sections", placeholder: "A, B" },
      { label: "Available timings", placeholder: "Mon-Wed 10:00 AM" },
      { label: "Office hours", placeholder: "Friday 2:00 PM" },
      { label: "Teaching mode", placeholder: "Physical, Online, Hybrid" },
    ],
  },
  {
    title: "Classroom setup",
    subtitle: "Create the first real class before students start joining.",
    fields: [
      { label: "Class name", placeholder: "Data Structures - BSCS 3A" },
      { label: "Syllabus", placeholder: "Upload later" },
      { label: "Class description", placeholder: "Core concepts and labs" },
      { label: "Attendance settings", placeholder: "Default policy" },
      { label: "Grading system", placeholder: "Marks, rubrics, or points" },
    ],
    emptyTitle: "No students enrolled yet",
    emptyText:
      "Generate invite codes after saving the class, then students can join through the invite flow.",
  },
  {
    title: "Public teacher profile",
    subtitle:
      "Shape how students see your teaching identity across the platform.",
    fields: [
      { label: "Display name", placeholder: "Professor Hassan" },
      { label: "Username", placeholder: "@prof_hassan" },
      { label: "Teacher tagline", placeholder: "Teaching Data Structures" },
      {
        label: "Short introduction",
        placeholder: "Write a short welcome note",
      },
    ],
  },
];

export default function TeacherOnboardingPage() {
  return (
    <OnboardingFlow
      audience="teacher"
      title="Build your teaching workspace"
      description="A dedicated setup experience for educators to prepare classes, schedules, and public profiles."
      finishHref="/teacher"
      steps={teacherSteps}
    />
  );
}
