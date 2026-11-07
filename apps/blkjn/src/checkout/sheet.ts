export function neutralizeSheetCell(value: string): string {
  if (/^[=+\-@\t\r]/.test(value)) return `'${value}`;
  return value;
}

export function neutralizeRow(row: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, neutralizeSheetCell(value)]));
}
