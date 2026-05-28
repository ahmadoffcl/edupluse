export type AttendanceSummaryInput = Array<{
  status: string;
}>;

export function summarizeAttendance(records: AttendanceSummaryInput) {
  const present = records.filter(
    (record) => record.status === "present" || record.status === "late",
  ).length;
  const absent = records.filter((record) => record.status === "absent").length;
  const excused = records.filter(
    (record) => record.status === "excused",
  ).length;
  const total = records.length;

  return {
    present,
    absent,
    excused,
    total,
    attendancePercent: total ? Math.round((present / total) * 100) : 0,
  };
}
