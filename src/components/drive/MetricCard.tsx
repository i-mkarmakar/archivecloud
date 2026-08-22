import { Card } from "@heroui/react";
import type { IconComponent } from "@/types/icons";

export function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: IconComponent;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{label}</p>
          <p className="mt-2 text-2xl font-extrabold">{value}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-secondary text-foreground">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}
