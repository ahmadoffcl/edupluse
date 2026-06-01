export type UploadPurpose =
  | "class_banner"
  | "teacher_resource"
  | "assignment_attachment"
  | "student_submission"
  | "student_note";

export type UploadedFileMetadata = {
  bucket: "avatars" | "resources" | "submissions";
  path: string;
  name: string;
  size: number;
  mimeType: string;
  publicUrl?: string | null;
};
