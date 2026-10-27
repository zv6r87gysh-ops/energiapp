import { test, expect } from "@playwright/test";
// These cases exercise the local-upload/no-default scenario; bundled asset has its own tests.
test.beforeEach(async ({ page }) => {
  await page.route("**/house-photo.json", (route) =>
    route.fulfill({ json: { householdId: "demo-home", url: null } }),
  );
});
import { weatherFixture, thermalHome, weatherNow } from "../fixtures/weather";
async function prepare(page: import("@playwright/test").Page) {
  await page.clock.install({ time: new Date(weatherNow) });
  await page.addInitScript((home) => {
    if (!localStorage.getItem("energihem-demo-v1"))
      localStorage.setItem(
        "energihem-demo-v1",
        JSON.stringify({ homes: [home], active: home.id }),
      );
  }, thermalHome());
  await page.route("**/api/electricity-prices?*", async (route) => {
    const u = new URL(route.request().url());
    const date =
      u.searchParams.get("day") === "tomorrow" ? "2026-10-22" : "2026-10-21";
    const { dayBounds } = await import("../../lib/prices/time");
    const bounds = dayBounds(date);
    const intervals = Array.from({ length: 96 }, (_, i) => ({
      start: new Date(bounds.start + i * 900000).toISOString(),
      end: new Date(bounds.start + (i + 1) * 900000).toISOString(),
      ore: i >= 52 && i < 64 ? 150 : 50,
    }));
    await route.fulfill({
      json: {
        status: "available",
        data: {
          area: "SE3",
          date,
          source: "Elprisetjustnu.se",
          sourceUrl: "https://www.elprisetjustnu.se/elpris-api",
          fetchedAt: new Date(weatherNow).toISOString(),
          intervals,
        },
      },
    });
  });
  await page.route("**/api/weather?*", async (route) => {
    const postcode = new URL(route.request().url()).searchParams.get(
      "postcode",
    );
    if (postcode === "13230")
      await route.fulfill({
        json: { status: "available", data: weatherFixture(0) },
      });
    else
      await route.fulfill({
        status: 502,
        json: { status: "unavailable", data: null },
      });
  });
}
test("väderflikar, källmärkning och vänteläge utan fabricerad pooltelemetri", async ({
  page,
}) => {
  await prepare(page);
  await page.goto("/");
  const weather = page.locator(".weather-widget");
  await expect(weather).toContainText("Saltsjö-Boo · 13230");
  await expect(weather).toContainText("MET Norway");
  await expect(weather).toContainText("0 °C ute");
  await weather.getByRole("tab", { name: "Imorgon", exact: true }).click();
  await expect(weather.getByRole("tabpanel")).toContainText("2026-10-22");
  await expect(weather).toContainText("Inväntar riktig pooltemperatur");
  await expect(weather).not.toContainText("Poolens planerade el till värme");
  await page.getByRole("button", { name: "Pausa alla", exact: true }).click();
  await expect(weather).toContainText("Inväntar riktig pooltemperatur");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto("/pool");
  await expect(page.locator(".weather-widget")).toHaveCount(0);
});
test("postnummerbyte och felsvar rensar gammalt väder; inställningar sparas per hushåll", async ({
  page,
}) => {
  await prepare(page);
  await page.goto("/");
  const weather = page.locator(".weather-widget");
  await expect(weather).toContainText("Saltsjö-Boo");
  await weather.getByLabel("Postnummer", { exact: true }).fill("11122");
  await weather
    .getByRole("button", { name: "Visa väder", exact: true })
    .click();
  await expect(weather).not.toContainText("Saltsjö-Boo");
  await expect(weather).toContainText("Inga demovärden används");
  await page.goto("/installningar");
  await page
    .getByLabel("Ta hänsyn till väder i poolens smarta styrförslag")
    .uncheck();
  await page
    .getByRole("button", { name: "Spara väderinställningar", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByLabel("Ta hänsyn till väder i poolens smarta styrförslag"),
  ).not.toBeChecked();
  await page.getByLabel("Nytt hushållsnamn").fill("Annat hem");
  await page
    .getByRole("button", { name: "Skapa hushåll", exact: true })
    .click();
  await expect(
    page.getByLabel("Ta hänsyn till väder i poolens smarta styrförslag"),
  ).not.toBeChecked();
  await page.goto("/");
  await expect(page.locator(".weather-widget")).toContainText(
    "Ange hushållets postnummer",
  );
});

test("samma postnummer kan hämtas igen efter fel och områdesprognos märks", async ({
  page,
}) => {
  await prepare(page);
  let requests = 0;
  await page.route("**/api/weather?*", async (route) => {
    requests++;
    if (requests === 1)
      await route.fulfill({
        status: 502,
        json: {
          status: "unavailable",
          code: "forecast-unavailable",
          data: null,
        },
      });
    else
      await route.fulfill({
        json: {
          status: "available",
          data: {
            ...weatherFixture(),
            postcode: "13250",
            locationPrecision: "district",
            locationArea: "132xx",
            locationSource: "GeoNames",
          },
        },
      });
  });
  await page.goto("/");
  const widget = page.locator(".weather-widget");
  await expect(widget).toContainText("MET Norway kunde inte nås");
  // Retry the unchanged saved postcode. This previously did not issue a new request.
  await widget.getByRole("button", { name: "Visa väder", exact: true }).click();
  // The deliberately mismatched result must not be shown for 13230.
  await expect(widget).toContainText("fel plats");
  await widget.getByLabel("Postnummer", { exact: true }).fill("13250");
  await widget.getByRole("button", { name: "Visa väder", exact: true }).click();
  await expect(widget).toContainText("Områdesprognos för Saltsjö-Boo (132xx)");
  await expect(widget).toContainText("Exakt punkt för 13250 saknas");
  expect(requests).toBeGreaterThanOrEqual(3);
});
test("vädersymboler och temperaturer visas i tretimmarssteg hela dygnet", async ({
  page,
}) => {
  await prepare(page);
  await page.route("**/api/weather?*", async (route) => {
    const weather = weatherFixture();
    weather.hours.forEach((h, i) => {
      h.symbol = ["clearsky_day", "cloudy", "rain"][Math.floor(i / 3) % 3];
    });
    await route.fulfill({ json: { status: "available", data: weather } });
  });
  await page.goto("/");
  const today = page.getByRole("region", {
    name: "Väder kommande 24 timmar",
    exact: true,
  });
  await expect(today.getByRole("listitem")).toHaveCount(8);
  await expect(today.getByText("Saknas", { exact: true })).toHaveCount(0);
  await page.getByRole("tab", { name: "Imorgon", exact: true }).click();
  const tomorrow = page.getByRole("region", {
    name: "Väder var tredje timme 2026-10-22",
    exact: true,
  });
  await expect(tomorrow.getByRole("listitem")).toHaveCount(8);
  await expect(tomorrow.getByText("Saknas", { exact: true })).toHaveCount(0);
  await expect(
    tomorrow.getByText("Soligt", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    tomorrow.getByText("Regn", { exact: true }).first(),
  ).toBeAttached();
  await expect(tomorrow.locator("time").first()).toHaveText("00:00");
  await expect(tomorrow.locator("time").last()).toHaveText("21:00");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
