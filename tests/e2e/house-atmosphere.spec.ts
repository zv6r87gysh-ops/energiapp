import { test, expect, type Page } from "@playwright/test";
import { initialHousehold } from "../../lib/demo";
import { weatherFixture } from "../fixtures/weather";
async function prepare(
  page: Page,
  symbol: string,
  instant = "2026-10-21T10:00:00Z",
  smart = false,
) {
  const now = Date.parse(instant);
  await page.clock.install({ time: new Date(now - 1000) });
  await page.clock.pauseAt(new Date(now));
  const home = {
    ...structuredClone(initialHousehold),
    postcode: "13230",
    smartControl: {
      mode: "demo",
      enabled: smart,
      categories: smart ? ["outdoor-lighting", "pool-lighting"] : [],
      updatedAt: instant,
    },
  };
  await page.addInitScript((h) => {
    if (!localStorage.getItem("energihem-demo-v1"))
      localStorage.setItem(
        "energihem-demo-v1",
        JSON.stringify({ homes: [h], active: h.id }),
      );
  }, home);
  await page.route("**/api/weather?*", (route) => {
    const w = weatherFixture(7, now);
    w.hours.forEach((h) => {
      h.symbol = symbol;
    });
    return route.fulfill({ json: { status: "available", data: w } });
  });
  await page.goto("/");
  await expect(page.getByTestId("house-atmosphere")).toHaveAttribute(
    "data-weather",
    symbol === "clearsky_day"
      ? "clear"
      : symbol === "cloudy"
        ? "cloud"
        : symbol,
  );
}
test("svensk klocka och regnvisualisering använder prognosen och lamporna saknar strålkäglor", async ({
  page,
}) => {
  await prepare(page, "rain");
  await expect(
    page.getByLabel("Klocka svensk tid", { exact: true }),
  ).toHaveText("12:00:00");
  await page.clock.runFor(2000);
  await expect(
    page.getByLabel("Klocka svensk tid", { exact: true }),
  ).toHaveText("12:00:02");
  await expect(page.locator(".house-rain-field")).toBeVisible();
  await page.getByRole("button", { name: "Utebelysning", exact: true }).click();
  await page
    .getByRole("switch", { name: "Förhandsvisa utebelysning", exact: true })
    .click();
  const overlay = page.getByTestId("outdoor-lighting-overlay");
  await expect(overlay).toHaveAttribute("data-power", "on");
  await expect(overlay.locator("path")).toHaveCount(0);
  await expect(overlay.locator(".outdoor-light-wash image")).toBeAttached();
});
test("snö visas bara när MET-prognosen säger snö", async ({ page }) => {
  await prepare(page, "snow");
  await expect(page.locator(".house-snow-field")).toBeVisible();
  await expect(page.locator(".house-rain-field")).toHaveCount(0);
});
test("utomhus- och poolbelysning följer solen; manuellt poolval påverkar inte övriga lampor", async ({
  page,
}) => {
  await prepare(page, "cloudy", "2026-10-21T18:00:00Z", true);
  await expect(page.getByTestId("house-atmosphere")).toHaveAttribute(
    "data-phase",
    "night",
  );
  await expect(page.getByTestId("outdoor-lighting-overlay")).toHaveAttribute(
    "data-power",
    "on",
  );
  await expect(page.getByTestId("pool-lighting-overlay")).toHaveAttribute(
    "data-power",
    "on",
  );
  await page.clock.fastForward(12 * 3600000);
  await expect(page.getByTestId("outdoor-lighting-overlay")).toHaveAttribute(
    "data-power",
    "off",
  );
  await expect(page.getByTestId("pool-lighting-overlay")).toHaveAttribute(
    "data-power",
    "off",
  );
  await page.clock.fastForward(12 * 3600000);
  await expect(page.getByTestId("outdoor-lighting-overlay")).toHaveAttribute(
    "data-power",
    "on",
  );
  await expect(page.getByTestId("pool-lighting-overlay")).toHaveAttribute(
    "data-power",
    "on",
  );
  await page
    .getByRole("button", { name: "Poolbelysning", exact: true })
    .click();
  await page
    .getByRole("switch", { name: "Förhandsvisa poolbelysning", exact: true })
    .click();
  await expect(page.getByTestId("pool-lighting-overlay")).toHaveAttribute(
    "data-power",
    "off",
  );
  await expect(page.getByTestId("outdoor-lighting-overlay")).toHaveAttribute(
    "data-power",
    "on",
  );
  const categories = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("energihem-demo-v1")!).homes[0]
        .smartControl.categories,
  );
  expect(categories).toEqual(["outdoor-lighting"]);
});
test("båda ljusgrupper kan väljas i smartdialogen utan att aktivera poolvärmen", async ({
  page,
}) => {
  await prepare(page, "cloudy");
  const house = page.getByRole("region", {
    name: "Ditt interaktiva hus",
    exact: true,
  });
  await house.locator(".house-photo-visual").hover();
  await house
    .getByRole("button", { name: "Aktivera smart styrning", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Vad vill du optimera?" });
  await dialog
    .getByRole("checkbox", { name: "Utebelysning", exact: true })
    .check();
  await dialog
    .getByRole("checkbox", { name: "Poolbelysning", exact: true })
    .check();
  await expect(
    dialog.getByRole("checkbox", { name: "Pool", exact: true }),
  ).not.toBeChecked();
  await expect(dialog.locator(".smart-subcategory")).toContainText(
    "Poolbelysning",
  );
  await dialog
    .getByRole("button", { name: "Aktivera simulering", exact: true })
    .click();
  await expect(page.getByTestId("pool-lighting-overlay")).toHaveAttribute(
    "data-power",
    "off",
  );
  await page.clock.fastForward(8 * 3600000);
  await expect(page.getByTestId("pool-lighting-overlay")).toHaveAttribute(
    "data-power",
    "on",
  );
  await expect(page.getByTestId("outdoor-lighting-overlay")).toHaveAttribute(
    "data-power",
    "on",
  );
});
