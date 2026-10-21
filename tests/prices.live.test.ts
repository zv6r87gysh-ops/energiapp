import { describe, it, expect } from "vitest";
import { GET } from "../app/api/electricity-prices/route";
import { priceDaySchema } from "../lib/prices/contracts";
import { dayBounds, swedishDate } from "../lib/prices/time";
// Opt-in: contacts the real public provider, never a fixture.
describe.skipIf(process.env.RUN_LIVE_PRICE_TESTS !== "1")(
  "Publik priskälla – live",
  () => {
    for (const area of ["SE1", "SE2", "SE3", "SE4"])
      it(`hämtar och validerar dagens ${area}`, async () => {
        const response = await GET(
          new Request(
            `http://localhost/api/electricity-prices?area=${area}&day=today`,
          ),
        );
        expect(response.status).toBe(200);
        const payload = await response.json();
        expect(payload.status).toBe("available");
        const data = priceDaySchema.parse(payload.data);
        const date = swedishDate();
        const bounds = dayBounds(date);
        expect(data.area).toBe(area);
        expect(data.date).toBe(date);
        expect(data.intervals).toHaveLength(
          (bounds.end - bounds.start) / 900000,
        );
        expect(Date.parse(data.intervals[0].start)).toBe(bounds.start);
        expect(Date.parse(data.intervals.at(-1)!.end)).toBe(bounds.end);
      }, 20000);
    it("skiljer publicerad och ännu opublicerad morgondag från tekniska fel", async () => {
      const r = await GET(
        new Request(
          "http://localhost/api/electricity-prices?area=SE3&day=tomorrow",
        ),
      );
      expect(r.status).toBe(200);
      const data = await r.json();
      expect(["available", "unpublished"]).toContain(data.status);
      if (data.status === "available")
        expect(priceDaySchema.safeParse(data.data).success).toBe(true);
      else expect(data.data).toBeNull();
    }, 20000);
  },
);
