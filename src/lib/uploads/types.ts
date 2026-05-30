export type UploadPurpose =
  | "teacher_resource"
  | "assignment_attachment"
  | "student_submission"
  | "student_note";

export type UploadedFileMetadata = {
  bucket: "resources" | "submissions";
  path: string;
  name: string;
  size: number;
  mimeType: string;
};
