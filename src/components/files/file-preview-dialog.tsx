"use client";

import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Download,
  ExternalLink,
  FileArchive,
  FileImage,
  FileText,
  FileVideo,
  Loader2,
  Maximize2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type PreviewableFile = {
  name: string;
  mimeType?: string | null;
  signedUrl?: string | null;
  downloadName?: string | null;
  source?: "resource" | "assignment" | "submission" | "external";
};

function fileExtension(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function previewKind(file: PreviewableFile) {
  const mime = file.mimeType ?? "";
  const extension = fileExtension(file.name);

  if (mime === "application/pdf" || extension === "pdf") return "pdf";
  if (
    mime.startsWith("image/") ||
    ["png", "jpg", "jpeg", "webp", "gif"].includes(extension)
  ) {
    return "image";
  }
  if (mime.startsWith("video/") || ["mp4", "webm", "mov"].includes(extension)) {
    return "video";
  }
  if (mime.startsWith("audio/") || ["mp3", "wav", "webm"].includes(extension)) {
    return "audio";
  }
  if (mime.startsWith("text/") || ["txt", "csv"].includes(extension)) {
    return "text";
  }
  if (["doc", "docx", "ppt", "pptx", "xls", "xlsx"].includes(extension)) {
    return "office";
  }
  return "unsupported";
}

function FileKindIcon({ kind }: { kind: ReturnType<typeof previewKind> }) {
  if (kind === "image") return <FileImage className="size-5" />;
  if (kind === "video" || kind === "audio") {
    return <FileVideo className="size-5" />;
  }
  if (kind === "pdf" || kind === "text" || kind === "office") {
    return <FileText className="size-5" />;
  }
  return <FileArchive className="size-5" />;
}

function TextPreview({ url, open }: { url: string; open: boolean }) {
  const [state, setState] = useState<{
    loading: boolean;
    text: string;
    error: string | null;
  }>({ loading: false, text: "", error: null });

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    Promise.resolve()
      .then(() => {
        if (!cancelled) setState({ loading: true, text: "", error: null });
        return fetch(url);
      })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load text preview.");
        return response.text();
      })
      .then((text) => {
        if (!cancelled) {
          setState({
            loading: false,
            text: text.slice(0, 120_000),
            error: null,
          });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setState({
            loading: false,
            text: "",
            error: error instanceof Error ? error.message : "Preview failed.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, url]);

  if (state.loading) {
    return (
      <div className="grid min-h-[320px] place-items-center text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="grid min-h-[320px] place-items-center p-6 text-center text-sm text-muted-foreground">
        {state.error}
      </div>
    );
  }

  return (
    <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-2xl bg-black p-4 text-xs leading-5 text-white">
      {state.text}
    </pre>
  );
}

function PreviewBody({ file, open }: { file: PreviewableFile; open: boolean }) {
  const kind = previewKind(file);
  const url = file.signedUrl;

  if (!url) {
    return (
      <div className="grid min-h-[320px] place-items-center rounded-3xl border border-dashed border-border bg-background/55 p-6 text-center">
        <div>
          <FileArchive className="mx-auto mb-3 size-10 text-primary" />
          <p className="font-semibold">Preview is not available</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            This file does not have a valid signed URL right now. Refresh the
            page and try again.
          </p>
        </div>
      </div>
    );
  }

  if (kind === "pdf") {
    return (
      <iframe
        title={file.name}
        src={url}
        className="h-[72vh] w-full rounded-3xl border border-border bg-background"
      />
    );
  }

  if (kind === "image") {
    return (
      <div className="grid max-h-[72vh] place-items-center overflow-auto rounded-3xl border border-border bg-black/95 p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={file.name}
          className="max-h-[68vh] max-w-full rounded-2xl object-contain"
        />
      </div>
    );
  }

  if (kind === "video") {
    return (
      <video
        controls
        className="max-h-[72vh] w-full rounded-3xl border border-border bg-black"
      >
        <source src={url} type={file.mimeType ?? undefined} />
      </video>
    );
  }

  if (kind === "audio") {
    return (
      <div className="rounded-3xl border border-border bg-background/70 p-6">
        <audio controls className="w-full">
          <source src={url} type={file.mimeType ?? undefined} />
        </audio>
      </div>
    );
  }

  if (kind === "text") {
    return <TextPreview url={url} open={open} />;
  }

  if (kind === "office") {
    return (
      <iframe
        title={file.name}
        src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`}
        className="h-[72vh] w-full rounded-3xl border border-border bg-background"
      />
    );
  }

  return (
    <div className="grid min-h-[320px] place-items-center rounded-3xl border border-dashed border-border bg-background/55 p-6 text-center">
      <div>
        <FileArchive className="mx-auto mb-3 size-10 text-primary" />
        <p className="font-semibold">Preview is not supported yet</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          You can still download the file securely from this classroom.
        </p>
      </div>
    </div>
  );
}

export function FilePreviewButton({
  file,
  className,
  size = "sm",
  variant = "outline",
}: {
  file: PreviewableFile;
  className?: string;
  size?: "sm" | "default";
  variant?: "outline" | "default" | "ghost";
}) {
  const [open, setOpen] = useState(false);
  const kind = useMemo(() => previewKind(file), [file]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button
          type="button"
          size={size}
          variant={variant}
          className={className}
          disabled={!file.signedUrl}
        >
          <Maximize2 /> Preview
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/72 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[90] flex max-h-[92vh] w-[min(94vw,1120px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-[1.75rem] border border-border bg-card p-3 text-card-foreground shadow-2xl outline-none sm:p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                <FileKindIcon kind={kind} />
              </span>
              <div className="min-w-0">
                <Dialog.Title className="truncate text-sm font-semibold sm:text-base">
                  {file.name}
                </Dialog.Title>
                <Dialog.Description className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">{kind}</Badge>
                  {file.source ? (
                    <Badge variant="info">{file.source}</Badge>
                  ) : null}
                </Dialog.Description>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {file.signedUrl ? (
                <>
                  <Button asChild size="sm" variant="outline">
                    <a href={file.signedUrl} target="_blank" rel="noreferrer">
                      <ExternalLink /> Open
                    </a>
                  </Button>
                  <Button asChild size="sm">
                    <a
                      href={file.signedUrl}
                      download={file.downloadName ?? file.name}
                    >
                      <Download /> Download
                    </a>
                  </Button>
                </>
              ) : null}
              <Dialog.Close asChild>
                <Button type="button" size="icon" variant="ghost">
                  <X />
                </Button>
              </Dialog.Close>
            </div>
          </div>
          <div className={cn("min-h-0 flex-1 overflow-auto")}>
            <PreviewBody file={file} open={open} />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function FileDownloadButton({
  file,
  className,
}: {
  file: PreviewableFile;
  className?: string;
}) {
  if (!file.signedUrl) return null;

  return (
    <Button asChild size="sm" variant="ghost" className={className}>
      <a href={file.signedUrl} download={file.downloadName ?? file.name}>
        <Download /> Download
      </a>
    </Button>
  );
}
