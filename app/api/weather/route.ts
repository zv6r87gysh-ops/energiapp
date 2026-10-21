import { postcodeSchema, type Weather } from "../../../lib/weather/contracts";
import { parseLocation, parseForecast } from "../../../lib/weather/provider";
export const dynamic = "force-dynamic";
const agent = "Energihem/1.0 https://github.com/zv6r87gysh-ops/energiapp";
const locations = new Map<
  string,
  { value: ReturnType<typeof parseLocation>; until: number }
>();
const forecasts = new Map<
  string,
  { data: Weather; modified: string | null; until: number }
>();
const pending = new Map<string, Promise<Weather>>();
const cooldown = new Map<string, number>();
const headers = { "Cache-Control": "no-store" };
function prune() {
  for (const [k, v] of locations)
    if (v.until <= Date.now()) locations.delete(k);
  for (const [k, until] of cooldown)
    if (until <= Date.now()) cooldown.delete(k);
  // Keep caches bounded, including entries retained for conditional requests.
  for (const map of [locations, forecasts, cooldown])
    while (map.size > 100) map.delete(map.keys().next().value!);
}
async function load(postcode: string): Promise<Weather> {
  prune();
  const cached = forecasts.get(postcode);
  if (cached && cached.until > Date.now()) return cached.data;
  if ((cooldown.get(postcode) ?? 0) > Date.now())
    throw Error("Vänta före nytt försök");
  try {
    let location = locations.get(postcode)?.value;
    if (!location) {
      const r = await fetch(`https://api.zippopotam.us/se/${postcode}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) throw Error("Postnumret kunde inte slås upp");
      location = parseLocation(await r.json(), postcode);
      locations.set(postcode, {
        value: location,
        until: Date.now() + 86400000,
      });
    }
    const r = await fetch(
      `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${location.latitude}&lon=${location.longitude}`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
        headers: {
          "User-Agent": agent,
          Accept: "application/json",
          ...(cached?.modified ? { "If-Modified-Since": cached.modified } : {}),
        },
      },
    );
    if (!r.ok && r.status !== 304) throw Error("Väderkällan svarade inte");
    const now = Date.now();
    const expires = Date.parse(r.headers.get("Expires") ?? "");
    const until = Math.max(
      now + 60000,
      Number.isFinite(expires) ? expires : now + 1800000,
    );
    const data =
      r.status === 304 && cached
        ? {
            ...cached.data,
            fetchedAt: new Date(now).toISOString(),
            expiresAt: new Date(until).toISOString(),
          }
        : parseForecast(await r.json(), location, until, now);
    if (now - Date.parse(data.issuedAt) > 6 * 3600000)
      throw Error("Inaktuell prognos");
    forecasts.set(postcode, {
      data,
      until,
      modified: r.headers.get("Last-Modified") ?? cached?.modified ?? null,
    });
    return data;
  } catch (e) {
    cooldown.set(postcode, Date.now() + 60000);
    throw e;
  }
}
export async function GET(request: Request) {
  const postcode = postcodeSchema.safeParse(
    new URL(request.url).searchParams.get("postcode"),
  );
  if (!postcode.success)
    return Response.json(
      {
        status: "invalid",
        data: null,
        message: "Ange ett svenskt postnummer med fem siffror.",
      },
      { status: 400, headers },
    );
  try {
    let job = pending.get(postcode.data);
    if (!job) {
      job = load(postcode.data);
      pending.set(postcode.data, job);
    }
    const data = await job;
    return Response.json({ status: "available", data }, { headers });
  } catch {
    return Response.json(
      {
        status: "unavailable",
        data: null,
        message:
          "Väderprognosen eller postnumret kunde inte verifieras. Försök igen senare. Inga demovärden används.",
      },
      { status: 502, headers },
    );
  } finally {
    pending.delete(postcode.data);
  }
}
