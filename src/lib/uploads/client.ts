"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { UploadedFileMetadata, UploadPurpose } from "@/lib/uploads/types";

type SignUploadInput = {
  purpose: UploadPurpose;
  file: File;
  classId?: string | null;
  assignmentId?: string | null;
};

type SignedUploadResponse = {
  ok?: boolean;
  error?: string;
  upload?: UploadedFileMetadata & {
    token: string;
  };
};

export async function signAndUploadFile({
  purpose,
  file,
  classId,
  assignmentId,
}: SignUploadInput): Promise<UploadedFileMetadata> {
  const signResponse = await fetch("/api/uploads/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      purpose,
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
      classId,
      assignmentId,
    }),
  });
  const signed = (await signResponse
    .json()
    .catch(() => null)) as SignedUploadResponse | null;

  if (!signResponse.ok || signed?.ok === false || !signed?.upload) {
    throw new Error(signed?.error ?? "Unable to prepare file upload.");
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("File storage is not available on this device.");
  }

  const { error } = await supabase.storage
    .from(signed.upload.bucket)
    .uploadToSignedUrl(signed.upload.path, signed.upload.token, file);

  if (error) {
    throw new Error(error.message || "Unable to upload file.");
  }

  return {
    bucket: signed.upload.bucket,
    path: signed.upload.path,
    name: signed.upload.name,
    size: signed.upload.size,
    mimeType: signed.upload.mimeType,
    publicUrl: signed.upload.publicUrl ?? null,
  };
}
