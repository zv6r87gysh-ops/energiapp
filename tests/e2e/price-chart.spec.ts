import { test, expect, type Page } from "@playwright/test";
import { addDate, dayBounds, swedishDate } from "../../lib/prices/time";
async function mockPrices(page: Page, instant: string) {
  await page.clock.install({ time: new Date(instant) });
  await page.route("**/api/electricity-prices?*", async (route) => {
    const url = new URL(route.request().url());
    const area = url.searchParams.get("area");
    const date = addDate(
      swedishDate(new Date(instant)),
      url.searchParams.get("day") === "tomorrow" ? 1 : 0,
    );
    const { start, end } = dayBounds(date);
    const intervals = Array.from(
      { length: (end - start) / 900000 },
      (_, i) => ({
        start: new Date(start + i * 900000).toISOString(),
        end: new Date(start + (i + 1) * 900000).toISOString(),
        ore: [10, 55, 100][i % 3],
      }),
    );
    await route.fulfill({
      status: 200,
      json: {
        status: "available",
        area,
        date,
        message: "Spotpris",
        data: {
          area,
          date,
          source: "Elprisetjustnu.se",
          sourceUrl: "https://www.elprisetjustnu.se/elpris-api",
          fetchedAt: instant,
          intervals,
        },
      },
    });
  });
}
test("svensk tid, blå nu-markering, grå historik och prisfärger", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await mockPrices(page, "2026-10-21T11:07:00Z");
  await page.goto("/elpriser");
  await expect(page.getByTestId("price-now")).toContainText("Nu 13:07");
  await expect(page.getByTestId("price-now")).toContainText("13:00–13:15");
  await expect(page.locator('[data-price-state="past"]')).toHaveCount(52);
  await expect(page.locator('[data-price-state="current"]')).toHaveCount(1);
  await expect(page.locator('[data-price-state="future"]')).toHaveCount(43);
  await expect(page.locator('[data-price-state="past"]').first()).toHaveCSS(
    "fill",
    "rgb(180, 189, 195)",
  );
  for (const [band, color] of [
    ["low", "rgb(39, 149, 124)"],
    ["middle", "rgb(228, 180, 59)"],
    ["high", "rgb(220, 98, 93)"],
  ])
    await expect(
      page
        .locator(`[data-price-state="future"][data-price-band="${band}"]`)
        .first(),
    ).toHaveCSS("fill", color);
  await expect(
    page.locator('.recharts-reference-line-line[stroke="var(--price-now)"]'),
  ).toHaveCount(1);
  await expect(page.locator('[data-price-state="current"]')).toHaveCSS(
    "stroke",
    "rgb(37, 99, 235)",
  );
  await expect(
    page.locator("svg text").filter({ hasText: /^Nu$/ }),
  ).toBeVisible();
  await expect(page.getByText(/Svensk tid \(Stockholm\)/)).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  // The current bar and history advance at the quarter boundary without a page reload.
  await page.clock.runFor(8 * 60000);
  await expect(page.getByTestId("price-now")).toContainText("Nu 13:15");
  await expect(page.locator('[data-price-state="past"]')).toHaveCount(53);
  await page.getByRole("button", { name: "Imorgon", exact: true }).click();
  await expect(page.locator('[data-price-state="future"]')).toHaveCount(96);
  await expect(page.locator('[data-price-state="past"]')).toHaveCount(0);
  await expect(page.getByTestId("price-now")).toHaveCount(0);
  await expect(
    page.locator("svg text").filter({ hasText: /^Nu$/ }),
  ).toHaveCount(0);
});
test("markeringen skiljer vintertidsdygnets två 02-timmar", async ({
  page,
}) => {
  await mockPrices(page, "2026-10-25T01:07:00Z");
  await page.goto("/elpriser");
  await expect(page.getByTestId("price-now")).toContainText("Nu 02:07");
  await expect(page.locator('[data-price-state="past"]')).toHaveCount(12);
  await expect(page.locator('[data-price-state="current"]')).toHaveCount(1);
  await expect(page.locator('[data-price-state="future"]')).toHaveCount(87);
  await expect(
    page.locator('.recharts-reference-line-line[stroke="var(--price-now)"]'),
  ).toHaveAttribute("x", "2026-10-25T01:00:00.000Z");
  await expect(
    page.locator("svg text").filter({ hasText: /^Nu$/ }),
  ).toBeVisible();
});
test("samma markering finns på översikten", async ({ page }) => {
  await mockPrices(page, "2026-10-21T11:07:00Z");
  await page.goto("/");
  await expect(page.getByTestId("price-now")).toContainText("Nu 13:07");
  await expect(page.locator('[data-price-state="past"]')).toHaveCount(52);
  await expect(
    page.locator("svg text").filter({ hasText: /^Nu$/ }),
  ).toBeVisible();
});
