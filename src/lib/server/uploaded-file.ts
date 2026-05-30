import "server-only";
import type { UploadedFileMetadata } from "@/lib/uploads/types";

export function parseUploadedFileMetadata(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return null;

  try {
    const parsed = JSON.parse(value) as Partial<UploadedFileMetadata>;
    if (
      (parsed.bucket === "resources" || parsed.bucket === "submissions") &&
      typeof parsed.path === "string" &&
      typeof parsed.name === "string" &&
      typeof parsed.mimeType === "string" &&
      typeof parsed.size === "number" &&
      Number.isFinite(parsed.size) &&
      parsed.size > 0
    ) {
      return parsed as UploadedFileMetadata;
    }
  } catch {
    return null;
  }

  return null;
}

export function parseUploadedFileMetadataList(
  value: FormDataEntryValue | null,
) {
  if (typeof value !== "string" || !value.trim()) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) =>
        parseUploadedFileMetadata(
          typeof item === "string" ? item : JSON.stringify(item),
        ),
      )
      .filter((item): item is UploadedFileMetadata => Boolean(item));
  } catch {
    return [];
  }
}

export function assertOrgStoragePath({
  metadata,
  orgId,
  bucket,
  prefix,
}: {
  metadata: UploadedFileMetadata;
  orgId: string;
  bucket: UploadedFileMetadata["bucket"];
  prefix?: string;
}) {
  if (metadata.bucket !== bucket) return false;
  if (!metadata.path.startsWith(`${orgId}/`)) return false;
  if (prefix && !metadata.path.startsWith(`${orgId}/${prefix}/`)) return false;
  return true;
}
