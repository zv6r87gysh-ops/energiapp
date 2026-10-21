const zone = "Europe/Stockholm";
export function swedishDate(now: Date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function addDate(date: string, days: number) {
  return new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000)
    .toISOString()
    .slice(0, 10);
}
export function midnightUtc(date: string) {
  const target = Date.parse(`${date}T00:00:00Z`);
  let instant = target;
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(instant)).map((p) => [p.type, p.value]),
    );
    const wall = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    instant += target - wall;
  }
  return instant;
}
export function dayBounds(date: string) {
  return { start: midnightUtc(date), end: midnightUtc(addDate(date, 1)) };
}
export function intervalAt<T extends { start: string; end: string }>(
  intervals: T[],
  now: number,
) {
  return (
    intervals.find(
      (p) => Date.parse(p.start) <= now && Date.parse(p.end) > now,
    ) ?? null
  );
}
export function priceTime(utc: string, includeZone = false) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: includeZone ? "long" : undefined,
  }).format(new Date(utc));
}
