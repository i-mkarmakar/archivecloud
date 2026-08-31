"use client";

import { InputOTP, REGEXP_ONLY_DIGITS } from "@heroui/react/input-otp";

export function OtpInput({
  value,
  onChange,
  onComplete,
  isDisabled = false,
  isInvalid = false,
  autoFocus = false,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  isDisabled?: boolean;
  isInvalid?: boolean;
  autoFocus?: boolean;
  className?: string;
}) {
  return (
    <InputOTP
      className={className}
      maxLength={6}
      value={value}
      onChange={onChange}
      onComplete={onComplete}
      pattern={REGEXP_ONLY_DIGITS}
      isDisabled={isDisabled}
      isInvalid={isInvalid}
      autoFocus={autoFocus}
    >
      <InputOTP.Group>
        <InputOTP.Slot index={0} />
        <InputOTP.Slot index={1} />
        <InputOTP.Slot index={2} />
      </InputOTP.Group>
      <InputOTP.Separator />
      <InputOTP.Group>
        <InputOTP.Slot index={3} />
        <InputOTP.Slot index={4} />
        <InputOTP.Slot index={5} />
      </InputOTP.Group>
    </InputOTP>
  );
}
