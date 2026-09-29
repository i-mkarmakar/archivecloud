"use client";

import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** Render children on document.body so fixed overlays escape layout stacking (sidebar). */
export function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
