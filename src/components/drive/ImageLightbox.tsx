"use client";

import {
  ArrowChevronLeft,
  ArrowChevronRight,
  ArrowDownToLine,
  ArrowUpRightFromSquare,
  CircleInfo,
  Minus,
  Plus,
  Target,
  Xmark,
} from "@gravity-ui/icons";
import { Skeleton } from "@heroui/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const ZOOM_STEP = 0.25;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;

export function ImageLightbox({
  open,
  src,
  fileName,
  loading,
  error,
  hasPrev = false,
  hasNext = false,
  onClose,
  onDownload,
  onOpenExternal,
  onInfo,
  onPrev,
  onNext,
}: {
  open: boolean;
  src: string;
  fileName: string;
  loading?: boolean;
  error?: string;
  hasPrev?: boolean;
  hasNext?: boolean;
  onClose: () => void;
  onDownload?: () => void;
  onOpenExternal?: () => void;
  onInfo?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!open) return;
    setZoom(1);
  }, [open, src]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") onPrev?.();
      if (event.key === "ArrowRight") onNext?.();
      if (event.key === "+" || event.key === "=") {
        setZoom((value) => Math.min(MAX_ZOOM, value + ZOOM_STEP));
      }
      if (event.key === "-") {
        setZoom((value) => Math.max(MIN_ZOOM, value - ZOOM_STEP));
      }
      if (event.key === "0") setZoom(1);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, onPrev, onNext]);

  if (!open) return null;

  const zoomPercent = Math.round(zoom * 100);

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black/80 backdrop-blur-[2px]">
      <header className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <p className="min-w-0 truncate text-sm font-semibold text-white sm:text-base">
          {fileName || "Image"}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          {onInfo ? (
            <button
              type="button"
              aria-label="File details"
              title="Details"
              onClick={onInfo}
              className="flex h-9 w-9 items-center justify-center rounded-full text-white/90 transition hover:bg-white/10"
            >
              <CircleInfo className="h-5 w-5" />
            </button>
          ) : null}
          {onOpenExternal ? (
            <button
              type="button"
              aria-label="Open in new tab"
              title="Open in new tab"
              onClick={onOpenExternal}
              className="flex h-9 w-9 items-center justify-center rounded-full text-white/90 transition hover:bg-white/10"
            >
              <ArrowUpRightFromSquare className="h-5 w-5" />
            </button>
          ) : null}
          {onDownload ? (
            <button
              type="button"
              aria-label="Download"
              title="Download"
              onClick={onDownload}
              className="flex h-9 w-9 items-center justify-center rounded-full text-white/90 transition hover:bg-white/10"
            >
              <ArrowDownToLine className="h-5 w-5" />
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Close preview"
            title="Close"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/90 transition hover:bg-white/10"
          >
            <Xmark className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-24 pt-2 sm:px-16">
        <button
          type="button"
          aria-label="Close preview backdrop"
          className="absolute inset-0 cursor-default"
          onClick={onClose}
        />

        {hasPrev ? (
          <button
            type="button"
            aria-label="Previous image"
            onClick={(event) => {
              event.stopPropagation();
              onPrev?.();
            }}
            className="absolute left-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/60 sm:left-4"
          >
            <ArrowChevronLeft className="h-5 w-5" />
          </button>
        ) : null}

        {hasNext ? (
          <button
            type="button"
            aria-label="Next image"
            onClick={(event) => {
              event.stopPropagation();
              onNext?.();
            }}
            className="absolute right-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/60 sm:right-4"
          >
            <ArrowChevronRight className="h-5 w-5" />
          </button>
        ) : null}

        <div className="relative z-[1] flex max-h-full max-w-full items-center justify-center overflow-auto">
          {loading ? (
            <div
              className="skeleton--shimmer relative overflow-hidden"
              role="status"
              aria-busy="true"
              aria-label="Loading preview"
            >
              <Skeleton
                animationType="none"
                className="h-[40vh] w-[min(70vw,520px)] rounded-xl bg-white/20"
              />
            </div>
          ) : null}
          {error ? (
            <p className="max-w-md text-center text-sm text-red-300">{error}</p>
          ) : null}
          {!loading && !error && src ? (
            <button
              type="button"
              aria-label={zoom > 1 ? "Zoom out image" : "Zoom in image"}
              className="border-0 bg-transparent p-0"
              onClick={(event) => {
                event.stopPropagation();
                setZoom((value) => (value > 1 ? 1 : 2));
              }}
            >
              <img
                src={src}
                alt={fileName || "Image preview"}
                draggable={false}
                className={cn(
                  "max-h-[calc(100dvh-10rem)] max-w-[min(100%,92vw)] select-none object-contain transition-transform duration-150",
                  zoom > 1 && "cursor-zoom-out",
                  zoom <= 1 && "cursor-zoom-in",
                )}
                style={{ transform: `scale(${zoom})` }}
              />
            </button>
          ) : null}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-5 z-10 flex justify-center px-4">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-black/70 px-2 py-1.5 text-white shadow-lg backdrop-blur-sm">
          <button
            type="button"
            aria-label="Zoom out"
            disabled={zoom <= MIN_ZOOM}
            onClick={() =>
              setZoom((value) => Math.max(MIN_ZOOM, value - ZOOM_STEP))
            }
            className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/10 disabled:opacity-40"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="min-w-12 text-center text-xs font-semibold tabular-nums">
            {zoomPercent}%
          </span>
          <button
            type="button"
            aria-label="Zoom in"
            disabled={zoom >= MAX_ZOOM}
            onClick={() =>
              setZoom((value) => Math.min(MAX_ZOOM, value + ZOOM_STEP))
            }
            className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/10 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
          </button>
          <span className="mx-0.5 h-4 w-px bg-white/20" aria-hidden />
          <button
            type="button"
            aria-label="Fit to screen"
            title="Fit to screen"
            onClick={() => setZoom(1)}
            className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/10"
          >
            <Target className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
