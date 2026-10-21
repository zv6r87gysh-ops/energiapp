import { test, expect } from "@playwright/test";
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
