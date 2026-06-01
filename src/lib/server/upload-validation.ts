import "server-only";

const maxDocumentSize = 25 * 1024 * 1024;
const maxMediaSize = 150 * 1024 * 1024;
const maxBannerSize = 6 * 1024 * 1024;
const allowedBannerMimeTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const allowedMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "audio/mpeg",
  "audio/wav",
  "audio/webm",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

const blockedExtensions = new Set([
  "exe",
  "bat",
  "cmd",
  "com",
  "dll",
  "js",
  "mjs",
  "cjs",
  "ts",
  "tsx",
  "jsx",
  "html",
  "htm",
  "svg",
  "php",
  "py",
  "rb",
  "sh",
  "ps1",
  "zip",
  "rar",
  "7z",
  "tar",
  "gz",
]);

export function fileExtension(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export function validateTeacherUpload(file: {
  name: string;
  type: string;
  size: number;
}) {
  const extension = fileExtension(file.name);

  if (!extension || blockedExtensions.has(extension)) {
    return {
      ok: false as const,
      error: "This file type is not allowed for classroom uploads.",
    };
  }

  if (!allowedMimeTypes.has(file.type)) {
    return {
      ok: false as const,
      error: "This file format is not supported yet.",
    };
  }

  const maxSize = file.type.startsWith("video/")
    ? maxMediaSize
    : maxDocumentSize;

  if (file.size > maxSize) {
    return {
      ok: false as const,
      error: file.type.startsWith("video/")
        ? "Video uploads must be 150MB or smaller."
        : "Document uploads must be 25MB or smaller.",
    };
  }

  return { ok: true as const };
}

export function validateClassBannerUpload(file: {
  name: string;
  type: string;
  size: number;
}) {
  const extension = fileExtension(file.name);

  if (!extension || blockedExtensions.has(extension)) {
    return {
      ok: false as const,
      error: "This image type is not allowed for class banners.",
    };
  }

  if (!allowedBannerMimeTypes.has(file.type)) {
    return {
      ok: false as const,
      error: "Use a JPG, PNG, or WEBP banner image.",
    };
  }

  if (file.size > maxBannerSize) {
    return {
      ok: false as const,
      error: "Banner images must be 6MB or smaller.",
    };
  }

  return { ok: true as const };
}

export function resourceTypeFromMime(mimeType: string) {
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "pdf";
  return "rich_note";
}

export function safeStorageName(name: string) {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}
