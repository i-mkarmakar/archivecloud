const legacyColorMap: Record<string, string> = {
  "text-muted": "#64748b",
  "text-lime-500": "#94a3b8",
  "text-cyan-400": "#cbd5e1",
  "text-yellow-400": "#e2e8f0",
  "text-orange-500": "#475569",
};

export const defaultFolderColor = "#1e9df1";

export const folderColorOptions = ["#000000", "#ffffff", "#1e9df1"];

export function normalizeFolderColor(color?: string | null) {
  if (color?.startsWith("#")) return color;
  return legacyColorMap[color ?? ""] ?? defaultFolderColor;
}
