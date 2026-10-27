import { dayBounds } from "../prices/time";
import { solarAltitude, type SceneLocation } from "./atmosphere";

// Find the same apparent-horizon crossings used by the lighting automation.
// Scan the actual Swedish calendar day (including DST); bisect to sub-second precision.
export function sunTimes(date: string, location: SceneLocation) {
  const { start, end } = dayBounds(date);
  let sunrise: number | null = null;
  let sunset: number | null = null;
  const above = (t: number) => solarAltitude(t, location) >= -0.833;
  for (let a = start; a < end; a += 300000) {
    const b = Math.min(a + 300000, end);
    const rising = !above(a) && above(b);
    if (above(a) === above(b)) continue;
    let lo = a,
      hi = b;
    while (hi - lo > 500) {
      const mid = (lo + hi) / 2;
      if (above(mid) === above(a)) lo = mid;
      else hi = mid;
    }
    if (rising) sunrise = (lo + hi) / 2;
    else sunset = (lo + hi) / 2;
  }
  return {
    sunrise,
    sunset,
    polarDay: sunrise === null && sunset === null && above(start),
  };
}
