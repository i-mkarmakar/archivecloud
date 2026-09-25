"use client";

import { Flag } from "@gravity-ui/icons";
import { Button, Label, ListBox, Select, toast } from "@heroui/react";
import { useEffect, useRef, useState, type FormEvent, type Key } from "react";
import {
  TURNSTILE_ENABLED,
  TurnstileField,
  type TurnstileFieldHandle,
} from "@/components/auth/turnstile-field";
import { DummyModal } from "@/components/drive/DummyModal";
import { Input } from "@/components/ui/input";
import { ABUSE_CATEGORIES } from "@/lib/abuse-categories";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  shareUrl: string;
  fileName?: string;
};

const fieldClass =
  "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20";

export function ReportAbuseModal({ open, onClose, shareUrl, fileName }: Props) {
  const turnstileRef = useRef<TurnstileFieldHandle>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [comments, setComments] = useState("");
  const [email, setEmail] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const captchaReady = !TURNSTILE_ENABLED || Boolean(captchaToken);
  const canSubmit =
    Boolean(category) && Boolean(email.trim()) && captchaReady && !submitting;

  useEffect(() => {
    if (!open) {
      setCategory(null);
      setComments("");
      setEmail("");
      setCaptchaToken(null);
      setSubmitting(false);
      turnstileRef.current?.reset();
    }
  }, [open]);

  function onCategoryChange(key: Key | null) {
    setCategory(key == null ? null : String(key));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit || !category) return;
    setSubmitting(true);
    try {
      await apiFetch("/api/report-abuse", {
        method: "POST",
        skipAuth: true,
        body: JSON.stringify({
          category,
          comments: comments.trim() || undefined,
          email: email.trim(),
          shareUrl,
          fileName: fileName || undefined,
          captchaToken: captchaToken || undefined,
        }),
      });
      toast.success("Report submitted. Thank you.");
      onClose();
    } catch (error) {
      toast.danger(
        error instanceof Error ? error.message : "Failed to submit report",
      );
      turnstileRef.current?.reset();
      setCaptchaToken(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DummyModal
      open={open}
      title="Report Abuse"
      onClose={submitting ? () => undefined : onClose}
      size="md"
    >
      <form onSubmit={onSubmit} className="grid gap-4">
        <p className="text-sm text-muted">
          Help us keep the platform safe. Select the reason for this report
          below.
        </p>

        <Select
          fullWidth
          isRequired
          placeholder="Select a reason"
          selectedKey={category}
          onSelectionChange={onCategoryChange}
          className="w-full"
        >
          <Label className="text-sm font-semibold text-foreground">
            Category
          </Label>
          <Select.Trigger className="h-10 min-h-10 rounded-lg">
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover className="w-[var(--trigger-width)]">
            <ListBox>
              {ABUSE_CATEGORIES.map((option) => (
                <ListBox.Item
                  key={option}
                  id={option}
                  textValue={option}
                  className="rounded-md"
                >
                  {option}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        <label className="grid gap-1.5 text-sm font-semibold text-foreground">
          <span>Additional comments (optional)</span>
          <textarea
            value={comments}
            onChange={(event) => setComments(event.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Describe the issue in more detail..."
            className={cn(fieldClass, "h-auto min-h-[6rem] resize-y py-2.5")}
          />
        </label>

        <label
          htmlFor="report-abuse-email"
          className="grid gap-1.5 text-sm font-semibold text-foreground"
        >
          <span>
            Your email <span className="text-destructive">*</span>
          </span>
          <Input
            id="report-abuse-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className={cn(fieldClass, "h-10")}
          />
        </label>

        <TurnstileField
          ref={turnstileRef}
          onTokenChange={setCaptchaToken}
          className="justify-start"
        />

        <div className="flex justify-end gap-3 pt-1">
          <Button
            type="button"
            variant="outline"
            isDisabled={submitting}
            onPress={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="shadow-[0_6px_14px_-8px_color-mix(in_oklch,var(--primary)_45%,transparent)]"
            isDisabled={!canSubmit}
          >
            <Flag className="h-3.5 w-3.5" />
            {submitting ? "Submitting…" : "Submit Report"}
          </Button>
        </div>
      </form>
    </DummyModal>
  );
}
