import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Shared size for `/blank/*.png` empty-state illustrations. */
export const EMPTY_STATE_PNG_CLASS =
  "mb-6 h-36 w-auto max-w-[15rem] object-contain sm:h-40 sm:max-w-[16.5rem]";
