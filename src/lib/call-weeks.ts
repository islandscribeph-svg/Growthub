import { startOfWeek, endOfWeek, format } from "date-fns";

// Weeks run Monday–Sunday, matching the source spreadsheet's "Dec 15-21" style ranges.
export function weekStartFor(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

export function weekLabel(weekStart: Date): string {
  const end = endOfWeek(weekStart, { weekStartsOn: 1 });
  const sameMonth = weekStart.getMonth() === end.getMonth();
  const startLabel = format(weekStart, sameMonth ? "MMM d" : "MMM d, yyyy");
  const endLabel = format(end, "MMM d, yyyy");
  return `${startLabel} – ${endLabel}`;
}
