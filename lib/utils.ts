import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * cn — une clases condicionales (clsx) y resuelve conflictos de Tailwind
 * (tailwind-merge). Convención shadcn/ui.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
