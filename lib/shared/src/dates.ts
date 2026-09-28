function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Local-calendar YYYY-MM-DD. Deliberately not `toISOString().slice(0, 10)`,
// which is the UTC date and flips a day early/late around local midnight.
export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Computed per call, never cached at module level, so an app left open past
// midnight rolls over to the new day.
export function todayStr(): string {
  return toDateStr(new Date());
}
