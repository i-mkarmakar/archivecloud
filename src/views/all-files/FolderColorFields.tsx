"use client";

import { Input } from "@heroui/react";
import {
  folderColorOptions,
  normalizeFolderColor,
} from "@/components/drive/folder-colors";

export function FolderColorFields({
  color,
  onColorChange,
}: {
  color: string;
  onColorChange: (color: string) => void;
}) {
  const normalizedColor = normalizeFolderColor(color);
  return (
    <div className="grid gap-4">
      <div className="grid gap-2 text-sm font-semibold">
        Folder Color
        <Input
          type="color"
          value={normalizedColor}
          onChange={(event) => onColorChange(event.target.value)}
          className="h-12 p-1"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {folderColorOptions.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onColorChange(option)}
            className={
              normalizedColor === option
                ? "h-8 w-8 rounded-lg border-2 border-border"
                : "h-8 w-8 rounded-lg border border-border"
            }
            style={{ backgroundColor: option }}
            aria-label={`Use ${option} folder color`}
          />
        ))}
      </div>
    </div>
  );
}
