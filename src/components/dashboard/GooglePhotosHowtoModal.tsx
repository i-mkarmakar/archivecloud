"use client";

import { Button } from "@heroui/react";
import { DummyModal } from "@/components/drive/DummyModal";

export function GooglePhotosHowtoModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <DummyModal
      open={open}
      title="Google Photos connected"
      onClose={onClose}
      size="md"
      className="w-[min(100%,42rem)] sm:max-w-2xl"
      bodyClassName="gap-8"
    >
      <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-relaxed text-sky-950">
        You are all set. Google only lets apps pull items you pick yourself, so
        Archive Cloud opens Google&apos;s picker when you copy. After that you
        choose which cloud receives the files.
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-bold text-foreground">
          1. Open the picker
        </h3>
        <p className="text-sm leading-relaxed text-muted">
          Stay on your Google Photos account, then click{" "}
          <span className="font-semibold text-foreground">Copy</span> in the top
          toolbar. That launches Google&apos;s photo picker.
        </p>
        <img
          src="/image2.png"
          alt="Copy button highlighted in the Archive Cloud toolbar"
          className="mt-3 w-full border border-border"
        />
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-bold text-foreground">
          2. Select and finish
        </h3>
        <p className="text-sm leading-relaxed text-muted">
          Tick the photos or videos you want. When you are done, press{" "}
          <span className="font-semibold text-foreground">Done</span> in the
          picker, then close that window so Archive Cloud can keep going.
        </p>
        <img
          src="/image1.png"
          alt="Google Photos picker with Done highlighted"
          className="mt-3 w-full border border-border"
        />
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-bold text-foreground">
          3. Pick where files land
        </h3>
        <p className="text-sm leading-relaxed text-muted">
          Choose another connected cloud and folder, then confirm with Copy
          Here. Your originals stay in Google Photos.
        </p>
        <div className="mt-3 rounded-xl border border-border bg-surface-secondary px-4 py-3 text-sm leading-relaxed text-foreground">
          Tip: Connect Drive, OneDrive, Dropbox, or another cloud first so you
          have a destination ready.
        </div>
      </section>

      <div className="flex justify-end pt-1">
        <Button variant="primary" onPress={onClose}>
          Okay, got it
        </Button>
      </div>
    </DummyModal>
  );
}
