export function localDateKey(value: string | Date) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function calendarDayDifference(start: string | Date, end: string | Date) {
  const startDate = typeof start === "string" ? new Date(start) : start;
  const endDate = typeof end === "string" ? new Date(end) : end;
  const startDay = Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const endDay = Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  return Math.max(0, Math.floor((endDay - startDay) / 86400000));
}

export function dateKeyAfter(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

export function challengeElapsedDays(start: string | Date, end: string | Date, pausedDays = 0) {
  return Math.max(0, calendarDayDifference(start, end) - Math.max(0, pausedDays));
}

export function pausedDaysAfterResume(pausedDays: number, pausedAt: string, resumedAt: string | Date) {
  if (!pausedAt) return Math.max(0, pausedDays);
  return Math.max(0, pausedDays) + calendarDayDifference(pausedAt, resumedAt);
}

export function challengeHasEnded(start: string | Date, now: string | Date, pausedDays: number, totalDays: number) {
  return challengeElapsedDays(start, now, pausedDays) >= totalDays;
}
