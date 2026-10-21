import {
  areaSchema,
  type PricesResponse,
  type PriceDay,
} from "../../../lib/prices/contracts";
import { providerUrl, parsePriceDay } from "../../../lib/prices/provider";
import { swedishDate, addDate } from "../../../lib/prices/time";
export const dynamic = "force-dynamic";
const cache = new Map<string, { expires: number; data: PriceDay }>();
export async function GET(request: Request) {
  const url = new URL(request.url);
  const area = areaSchema.safeParse(url.searchParams.get("area") ?? "SE3");
  const day = url.searchParams.get("day") ?? "today";
  if (!area.success || !["today", "tomorrow"].includes(day))
    return Response.json(
      { message: "Välj SE1–SE4 och idag eller imorgon." },
      { status: 400 },
    );
  const date = addDate(swedishDate(), day === "tomorrow" ? 1 : 0);
  const result = (
    status: PricesResponse["status"],
    data: PriceDay | null,
    message: string,
    http = 200,
  ) =>
    Response.json(
      { status, area: area.data, date, data, message } satisfies PricesResponse,
      { status: http, headers: { "Cache-Control": "no-store" } },
    );
  // Public API contract, terms and complete SE1–SE4 live days verified 2026-10-21.
  if (process.env.ELECTRICITY_PRICES_ENABLED === "false")
    return result(
      "not-configured",
      null,
      "Prishämtningen är avstängd i serverinställningarna.",
      503,
    );
  const key = `${date}-${area.data}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now())
    return result(
      "available",
      cached.data,
      "Spotpriser exklusive moms och avgifter.",
    );
  try {
    const response = await fetch(providerUrl(area.data, date), {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
      headers: { Accept: "application/json" },
    });
    if (response.status === 404 && day === "tomorrow")
      return result(
        "unpublished",
        null,
        "Morgondagens priser har ännu inte publicerats.",
      );
    if (!response.ok)
      throw Error(`Priskällan svarade med HTTP ${response.status}`);
    const data = parsePriceDay(
      await response.json(),
      area.data,
      date,
      new Date().toISOString(),
    );
    for (const [k, v] of cache) if (v.expires <= Date.now()) cache.delete(k);
    cache.set(key, { expires: Date.now() + 300000, data });
    return result(
      "available",
      data,
      "Spotpriser exklusive moms, påslag, energiskatt och nätavgifter.",
    );
  } catch {
    return result(
      "unavailable",
      null,
      "Priserna kunde inte hämtas eller verifieras. Försök igen senare.",
      502,
    );
  }
}
