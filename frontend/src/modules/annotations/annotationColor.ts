export const PALETTE = [
  "#2563eb", "#dc2626", "#16a34a", "#ca8a04",
  "#9333ea", "#0891b2", "#db2777", "#65a30d",
];

export function annotationColor(labelColor: string | null, index: number): string {
  return labelColor || PALETTE[index % PALETTE.length];
}
