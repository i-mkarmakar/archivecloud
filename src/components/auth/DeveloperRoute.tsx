"use client";

import { Card } from "@heroui/react";
import { type ReactNode } from "react";
import { useDeveloperMode } from "@/context/DeveloperModeContext";

export function DeveloperRoute({ children }: { children: ReactNode }) {
  const { loading, developerModeEnabled } = useDeveloperMode();

  if (loading) {
    return (
      <Card className="p-6 text-sm text-muted">Loading Developer Console...</Card>
    );
  }

  if (!developerModeEnabled) {
    return (
      <Card className="p-6 text-sm text-muted">
        Enable Developer Console in Settings to access this area.
      </Card>
    );
  }

  return children;
}
