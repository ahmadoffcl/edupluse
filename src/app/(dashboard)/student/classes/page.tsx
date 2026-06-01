import { StudentClassesPanel } from "@/components/student/student-classes-panel";
import { getDashboardData } from "@/lib/dashboard/server-data";

export default async function StudentClassesPage() {
  const data = await getDashboardData();

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="rounded-[1.75rem] border border-[#e1e7ef] bg-white p-5 shadow-[0_12px_34px_rgba(60,64,67,0.08)] sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0b57d0]">
          Classes
        </p>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-[#202124] sm:text-4xl">
              Your classrooms
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5f6368]">
              Open enrolled classes, join by code, and request access to
              available sections from one clean workspace.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center sm:min-w-80">
            <div className="rounded-2xl bg-[#f1f6ff] px-3 py-2">
              <p className="text-lg font-semibold text-[#0b57d0]">
                {data.classes.filter((item) => item.enrollmentStatus === "enrolled").length}
              </p>
              <p className="text-[11px] text-[#5f6368]">Enrolled</p>
            </div>
            <div className="rounded-2xl bg-[#fff8e1] px-3 py-2">
              <p className="text-lg font-semibold text-[#8a5a00]">
                {data.classes.filter((item) => item.enrollmentStatus === "pending").length}
              </p>
              <p className="text-[11px] text-[#5f6368]">Pending</p>
            </div>
            <div className="rounded-2xl bg-[#eef7ee] px-3 py-2">
              <p className="text-lg font-semibold text-[#137333]">
                {data.classes.filter((item) => item.enrollmentStatus !== "enrolled").length}
              </p>
              <p className="text-[11px] text-[#5f6368]">Discover</p>
            </div>
          </div>
        </div>
      </section>
      <StudentClassesPanel classes={data.classes} />
    </div>
  );
}
