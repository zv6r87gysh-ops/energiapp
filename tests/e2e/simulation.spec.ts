import { test, expect, type Page } from "@playwright/test";
import { initialHousehold } from "../../lib/demo";
import { dayBounds, swedishDate, addDate } from "../../lib/prices/time";
import { defaultSimulationSettings } from "../../lib/simulation/engine";
async function prepare(page: Page, tomorrow = true) {
  const instant = "2026-10-21T06:00:00Z";
  await page.clock.install({ time: new Date(instant) });
  const home = {
    ...structuredClone(initialHousehold),
    smartControl: {
      mode: "demo" as const,
      enabled: true,
      categories: ["pool"] as ["pool"],
      updatedAt: instant,
    },
    simulationSettings: { ...defaultSimulationSettings, poolKwh: 40 },
  };
  await page.addInitScript((h) => {
    if (!localStorage.getItem("energihem-demo-v1"))
      localStorage.setItem(
        "energihem-demo-v1",
        JSON.stringify({ homes: [h], active: h.id }),
      );
  }, home);
  await page.route("**/api/electricity-prices?*", async (route) => {
    const u = new URL(route.request().url());
    const isTomorrow = u.searchParams.get("day") === "tomorrow";
    const date = addDate(swedishDate(new Date(instant)), isTomorrow ? 1 : 0);
    const area = u.searchParams.get("area");
    const { start, end } = dayBounds(date);
    const intervals = Array.from(
      { length: (end - start) / 900000 },
      (_, i) => ({
        start: new Date(start + i * 900000).toISOString(),
        end: new Date(start + (i + 1) * 900000).toISOString(),
        ore: i === 60 ? 200 : i === 32 ? 150 : 100,
      }),
    );
    await route.fulfill({
      status: 200,
      json: {
        status: !tomorrow && isTomorrow ? "unpublished" : "available",
        area,
        date,
        message: "Publicerade testpriser",
        data:
          !tomorrow && isTomorrow
            ? null
            : {
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
test("levande familjemodell, prispaus i kategorin och egna regler", async ({
  page,
}) => {
  await prepare(page);
  await page.goto("/");
  await expect(
    page.getByText("Levande simulering · 2 vuxna och 2 barn", { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("nav-state-pool")).toContainText("högt pris");
  await expect(
    page.getByRole("img", {
      name: "Levande simulerad förbrukning med verkliga spotpriser",
    }),
  ).toBeVisible();
  const metric = page.locator(".simulation-dashboard .metric-value").first();
  const before = await metric.innerText();
  await page.clock.runFor(15000);
  await expect(metric).not.toHaveText(before);
  await page.goto("/installningar");
  await page
    .getByLabel("Poolens regeltyp", { exact: true })
    .selectOption("fixed");
  await page.getByLabel("Poolens gräns (öre/kWh)", { exact: true }).fill("200");
  await page
    .getByRole("button", { name: "Spara simuleringsregler", exact: true })
    .click();
  await expect(page.getByTestId("nav-state-pool")).toContainText("Kör");
  await page.goto("/forbrukning");
  await expect(
    page.getByRole("heading", { name: "Pool · simulering" }),
  ).toBeVisible();
  await expect(page.getByTestId("nav-state-pool")).toContainText("Kör");
  await page.goto("/installningar");
  await expect(
    page.getByLabel("Poolens regeltyp", { exact: true }),
  ).toHaveValue("fixed");
  await expect(
    page.getByLabel("Poolens gräns (öre/kWh)", { exact: true }),
  ).toHaveValue("200");
});
test("procentregeln inväntar kompletta priser, fast gräns kan väljas", async ({
  page,
}) => {
  await prepare(page, false);
  await page.goto("/");
  await expect(page.getByTestId("nav-state-pool")).toContainText(
    "Inväntar priser",
  );
  await expect(
    page.getByText(/Hela kommande 24 timmar är inte publicerade/),
  ).toBeVisible();
  await page.goto("/installningar");
  await page
    .getByLabel("Poolens regeltyp", { exact: true })
    .selectOption("fixed");
  await page.getByLabel("Poolens gräns (öre/kWh)", { exact: true }).fill("200");
  await page
    .getByRole("button", { name: "Spara simuleringsregler", exact: true })
    .click();
  await expect(page.getByTestId("nav-state-pool")).toContainText("Kör");
});
