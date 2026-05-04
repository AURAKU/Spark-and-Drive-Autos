"use client";

import { Copy, ExternalLink, Maximize2 } from "lucide-react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { classifyUploadedFile, type UploadedFileKind } from "@/lib/uploaded-file-classify";
import { isTrustedPaymentProofUrl } from "@/lib/payment-proof-url";
import { cn } from "@/lib/utils";

function formatWhen(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  try {
    const d = typeof value === "string" ? new Date(value) : value;
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return null;
  }
}

function resolveDisplayUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (typeof window !== "undefined") {
    try {
      return new URL(url, window.location.origin).href;
    } catch {
      return url;
    }
  }
  return url;
}

function canCopyByDefaultClient(displayUrl: string): boolean {
  if (isTrustedPaymentProofUrl(displayUrl)) return true;
  try {
    return new URL(displayUrl, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

export type UploadedFilePreviewProps = {
  url: string;
  publicId?: string | null;
  mimeType?: string | null;
  label?: string;
  uploadedAt?: Date | string | null;
  /** Shown near metadata (e.g. proof status, verification status). */
  statusLabel?: string;
  /** Larger preview chrome for admin review. */
  variant?: "default" | "admin";
  /** Tighter layout for table cells. */
  density?: "comfortable" | "compact";
  className?: string;
  /** Override safe clipboard behavior (defaults to trusted Cloudinary / same-origin). */
  allowCopyUrl?: boolean;
};

function FullscreenPortal({
  open,
  kind,
  url,
  displayUrl,
  onClose,
}: {
  open: boolean;
  kind: UploadedFileKind;
  url: string;
  displayUrl: string;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-black/92 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="flex shrink-0 items-center justify-end gap-2 border-b border-white/10 px-3 py-2">
        <a
          href={displayUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex h-9 items-center gap-1 rounded-md px-3 text-sm font-medium text-zinc-300 hover:bg-white/10 hover:text-white"
        >
          <ExternalLink className="size-4" />
          Open in new tab
        </a>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="text-zinc-900"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          Close
        </Button>
      </div>
      <div
        className="flex min-h-0 flex-1 items-center justify-center p-3 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {kind === "image" ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={url}
            alt=""
            className="max-h-[calc(100vh-6rem)] max-w-full object-contain"
          />
        ) : kind === "pdf" ? (
          <iframe
            title="PDF preview"
            src={displayUrl}
            className="h-[min(85vh,calc(100vh-5rem))] w-full max-w-6xl rounded-lg border border-white/10 bg-zinc-900"
          />
        ) : (
          <div className="max-w-md rounded-xl border border-white/15 bg-white/[0.06] p-6 text-center text-sm text-zinc-300">
            <p className="font-medium text-white">Preview not available</p>
            <p className="mt-2 text-xs text-zinc-500">Open the file in a new tab to review.</p>
            <a
              href={displayUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-secondary px-4 text-sm font-medium text-secondary-foreground hover:bg-secondary/90"
            >
              Open file
            </a>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function UploadedFilePreview({
  url,
  publicId,
  mimeType,
  label,
  uploadedAt,
  statusLabel,
  variant = "default",
  density = "comfortable",
  className,
  allowCopyUrl,
}: UploadedFilePreviewProps) {
  const [imgBroken, setImgBroken] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [copyAllowed, setCopyAllowed] = useState(false);

  const kind = useMemo(() => classifyUploadedFile(url, mimeType), [url, mimeType]);
  const effectiveKind: UploadedFileKind =
    kind === "image" && imgBroken ? "unknown" : kind;

  const displayUrl = useMemo(() => resolveDisplayUrl(url), [url]);

  useEffect(() => {
    if (allowCopyUrl === true) {
      setCopyAllowed(true);
      return;
    }
    if (allowCopyUrl === false) {
      setCopyAllowed(false);
      return;
    }
    setCopyAllowed(canCopyByDefaultClient(displayUrl));
  }, [allowCopyUrl, displayUrl]);

  const copyUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(displayUrl);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy");
    }
  }, [displayUrl]);

  const previewMinH =
    density === "compact"
      ? variant === "admin"
        ? "min-h-[140px]"
        : "min-h-[120px]"
      : variant === "admin"
        ? "min-h-[280px] sm:min-h-[320px]"
        : "min-h-[200px] sm:min-h-[220px]";

  const shell = cn(
    "overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm ring-1 ring-border/50 dark:border-white/10 dark:bg-white/[0.03] dark:ring-transparent",
    variant === "admin" && "border-white/10 bg-black/25 dark:bg-black/30",
    className,
  );

  const metaWhen = formatWhen(uploadedAt);

  return (
    <div className={shell}>
      <div className={cn("relative flex w-full flex-col", previewMinH)}>
        {effectiveKind === "image" ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={url}
            alt=""
            className="h-full max-h-[min(70vh,520px)] w-full flex-1 bg-muted/40 object-contain dark:bg-black/40"
            onError={() => setImgBroken(true)}
          />
        ) : effectiveKind === "pdf" ? (
          <div className="flex min-h-[inherit] flex-1 flex-col bg-muted/30 dark:bg-zinc-950/80">
            <iframe
              title={label ?? "PDF"}
              src={displayUrl}
              className="min-h-[220px] flex-1 w-full border-0 sm:min-h-[260px]"
            />
            <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground dark:border-white/10">
              If the preview is blank, open the PDF in a new tab (some browsers block embedding).
            </p>
          </div>
        ) : (
          <div className="flex min-h-[inherit] flex-1 flex-col items-center justify-center gap-3 bg-muted/40 px-4 py-8 dark:bg-zinc-950/60">
            <p className="text-center text-sm font-medium text-foreground">File attachment</p>
            <p className="text-center text-xs text-muted-foreground">
              We couldn&apos;t infer a preview type. Open the file to review.
            </p>
            <a
              href={displayUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1 rounded-md border border-border bg-secondary px-3 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
            >
              <ExternalLink className="size-4" />
              Open file
            </a>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-border bg-muted/30 px-3 py-2 dark:border-white/10 dark:bg-black/40">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1 text-xs"
            onClick={() => setFullscreen(true)}
          >
            <Maximize2 className="size-3.5" />
            Full screen
          </Button>
          <a
            href={displayUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-muted"
          >
            <ExternalLink className="size-3.5" />
            New tab
          </a>
          {copyAllowed ? (
            <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={() => void copyUrl()}>
              <Copy className="size-3.5" />
              Copy URL
            </Button>
          ) : null}
        </div>
      </div>

      <div className="space-y-1 px-3 py-2 text-xs">
        {label ? <p className="font-medium text-foreground">{label}</p> : null}
        {statusLabel ? (
          <p className="text-muted-foreground">
            Status: <span className="font-semibold text-foreground">{statusLabel}</span>
          </p>
        ) : null}
        {metaWhen ? <p className="text-muted-foreground">Uploaded {metaWhen}</p> : null}
        {publicId ? (
          <p className="truncate font-mono text-[10px] text-muted-foreground/90" title={publicId}>
            {publicId}
          </p>
        ) : null}
      </div>

      <FullscreenPortal
        open={fullscreen}
        kind={effectiveKind === "unknown" ? "unknown" : effectiveKind}
        url={url}
        displayUrl={displayUrl}
        onClose={() => setFullscreen(false)}
      />
    </div>
  );
}
