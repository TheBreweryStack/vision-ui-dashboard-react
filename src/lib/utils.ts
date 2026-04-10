import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Avoid JS Date timezone shifting for YYYY-MM-DD strings
export function parseDateOnly(date: string) {
  return new Date(`${date}T00:00:00`);
}

// Check if a trade group is an expired option (open option past expiration date)
export function isExpiredOption(group: {
  status: string;
  trade_type: string;
  expiration_date: string | null;
}): boolean {
  if (group.status !== 'open') return false;
  if (group.trade_type === 'stock') return false;
  if (!group.expiration_date) return false;
  
  const expDate = parseDateOnly(group.expiration_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return expDate < today;
}
