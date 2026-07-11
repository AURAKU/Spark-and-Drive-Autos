"use client";

import { createPortal } from "react-dom";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useMediaFullscreen } from "@/hooks/use-media-fullscreen";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  headerActions?: ReactNode;
  className?: string;
  contentClassName?: string;
  zIndexClass?: string;
  closeLabel?: string;
  /** When false, clicking the backdrop does not close the viewer. */
  closeOnBackdrop?: boolean;
  ariaLabel?: string;
};

export function MediaFullscreenViewer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  headerActions,
  className,
  contentClassName,
  zIndexClass = "z-[100]",
  closeLabel = "Close",
  closeOnBackdrop = false,
  ariaLabel,
}: Props) {
  const portalEl = useMediaFullscreen(open, onClose);

  if (!open || !portalEl) return null;

  return createPortal(
    <div
      className={cn("fixed inset-0 flex flex-col bg-black", zIndexClass, className)}
      style={{ height: "100dvh" }}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel ?? title ?? "Full screen media viewer"}
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between gap-2 bg-gradient-to-b from-black/80 to-transparent px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0 pl-1">
          {title ? <p className="truncate text-sm font-medium text-white">{title}</p> : null}
          {subtitle ? <p className="truncate text-xs text-white/70">{subtitle}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {headerActions}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 text-white hover:bg-white/10 hover:text-white"
            onClick={onClose}
          >
            {closeLabel}
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "relative flex min-h-0 flex-1 items-center justify-center px-2 pb-16 pt-14 sm:px-6",
          contentClassName,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>

      {footer ? (
        <div className="absolute bottom-0 left-0 right-0 z-10" onClick={(e) => e.stopPropagation()}>
          {footer}
        </div>
      ) : null}
    </div>,
    portalEl,
  );
}
