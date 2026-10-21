import { swedishDate, addDate, dayBounds } from "../../lib/prices/time";
import { test, expect } from "@playwright/test";
import { sections } from "../../lib/demo";
test("alla tio sidor fungerar utan horisontell scroll", async ({ page }) => {
  for (const s of sections) {
    await page.goto(s.id === "oversikt" ? "/" : `/${s.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByText("Du utforskar Energihem i demoläge"),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
test("sök, lägg till, redigera och ta bort fordon", async ({ page }) => {
  await page.goto("/laddning");
  await page.getByRole("button", { name: "Lägg till bil" }).click();
  await page
    .getByRole("combobox", { name: "Sök bilmärke eller modell" })
    .fill("BMW i4");
  await page.getByRole("option", { name: "BMW i4", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Motorvariant").fill("eDrive40 – manuellt");
  await dialog.getByLabel("Årsmodell").fill("2024");
  await dialog.getByLabel("Smeknamn").fill("Testbilen");
  await dialog.getByRole("button", { name: "Spara fordon" }).click();
  await expect(page.getByText("Testbilen", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Testbilen", { exact: true })).toBeVisible();
  const row = page.locator(".vehicle-row").filter({ hasText: "Testbilen" });
  await row.getByRole("button", { name: "Redigera" }).click();
  await page.getByLabel("Smeknamn").fill("Ändrad bil");
  await page.getByRole("button", { name: "Spara fordon" }).click();
  await page
    .locator(".vehicle-row")
    .filter({ hasText: "Ändrad bil" })
    .getByRole("button", { name: "Ta bort" })
    .click();
  await expect(page.getByText("Ändrad bil", { exact: true })).toHaveCount(0);
});
test("simulerad laddning och ej ansluten golvvärme", async ({ page }) => {
  await page.goto("/laddning");
  await page.getByRole("button", { name: "Starta simulering" }).click();
  await expect(
    page.getByRole("button", { name: "Pausa simulering" }),
  ).toBeVisible();
  await page.goto("/golvvarme");
  await expect(page.getByText("Ej ansluten", { exact: true })).toHaveCount(5);
  await expect(
    page.getByRole("button", { name: "Styrning inte tillgänglig" }),
  ).toHaveCount(5);
});
test("hushållens fordon hålls åtskilda", async ({ page }) => {
  await page.goto("/installningar");
  await page.getByLabel("Nytt hushållsnamn").fill("Grannens demo");
  await page.getByRole("button", { name: "Skapa hushåll" }).click();
  await page.goto("/laddning");
  await expect(page.getByText("Ingen bil tillagd")).toHaveCount(0);
  await expect(page.locator(".vehicle-row")).toHaveCount(0);
  await page.getByLabel("Aktivt hushåll").selectOption("demo-home");
  await expect(page.locator(".vehicle-row")).toHaveCount(1);
});

test("enhetsguiden registrerar utan att påstå en riktig anslutning", async ({
  page,
}) => {
  await page.goto("/pool");
  await page
    .getByRole("button", { name: "Lägg till egen enhet", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Realtidsmätare för el" }).click();
  await dialog
    .getByLabel("Enhetens namn", { exact: true })
    .fill("Min energimätare");
  await dialog.getByLabel("Tillverkare", { exact: true }).fill("Bitvis");
  await dialog.getByLabel("Exakt modell", { exact: true }).fill("Power Hub KM");
  await dialog
    .getByLabel("Serienummer / Enhets-ID", { exact: true })
    .fill("HUB-12345");
  await dialog
    .getByRole("button", { name: "Kontrollera uppgifter", exact: true })
    .click();
  await expect(dialog).toContainText("Numret verifieras inte mot tillverkaren");
  await dialog
    .getByRole("button", { name: "Spara enhet", exact: true })
    .click();
  await page.goto("/installningar");
  await expect(
    page.getByRole("article", { name: "Enhet: Min energimätare" }),
  ).toContainText("Förberedd – ej ansluten");
  await expect(
    page.getByRole("article", { name: "Enhet: Min energimätare" }),
  ).toContainText("Ingen avläsning");
});
test("PWA visar tydligt offlinetillstånd", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await context.setOffline(true);
  await expect(
    page.getByText(/Du är offline. Visar sparad demonstration/),
  ).toBeVisible();
  await page.goto("/elpriser");
  await expect(
    page.getByRole("heading", { name: "Du är offline." }),
  ).toBeVisible();
  await context.setOffline(false);
});

test("prissidan skiljer saknade priser från demopriser", async ({ page }) => {
  await page.route("**/api/electricity-prices?*", async (route) => {
    const url = new URL(route.request().url());
    const area = url.searchParams.get("area");
    const day = url.searchParams.get("day");
    const date = addDate(swedishDate(), day === "tomorrow" ? 1 : 0);
    await route.fulfill({
      status: 200,
      json: {
        status: day === "tomorrow" ? "unpublished" : "unavailable",
        area,
        date,
        data: null,
        message:
          day === "tomorrow"
            ? "Morgondagens priser har ännu inte publicerats."
            : "Priser kunde inte hämtas.",
      },
    });
  });
  await page.goto("/elpriser");
  await expect(page.getByRole("status")).toContainText(
    "Inga demopriser används som ersättning",
  );
  await expect(
    page.getByRole("img", { name: "Publicerade kvartspriser" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Imorgon", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Morgondagens priser har ännu inte publicerats",
  );
  await page.getByLabel("Elområde").selectOption("SE4");
  await expect(
    page.getByRole("heading", { name: "Spotpriser · SE4" }),
  ).toBeVisible();
});

test("visar validerade priser med källa och rensar vid områdesbyte", async ({
  page,
}) => {
  await page.route("**/api/electricity-prices?*", async (route) => {
    const u = new URL(route.request().url());
    const area = u.searchParams.get("area");
    const date = swedishDate();
    const { start, end } = dayBounds(date);
    const intervals = Array.from(
      { length: (end - start) / 900000 },
      (_, i) => ({
        start: new Date(start + i * 900000).toISOString(),
        end: new Date(start + (i + 1) * 900000).toISOString(),
        ore: area === "SE4" ? 84 : 42,
      }),
    );
    await route.fulfill({
      status: 200,
      json: {
        status: "available",
        area,
        date,
        data: {
          area,
          date,
          source: "Elprisetjustnu.se",
          sourceUrl: "https://www.elprisetjustnu.se/elpris-api",
          fetchedAt: new Date().toISOString(),
          intervals,
        },
        message: "Spotpriser exklusive moms och avgifter.",
      },
    });
  });
  await page.goto("/elpriser");
  await expect(
    page.getByRole("img", { name: "Publicerade kvartspriser" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Elprisetjustnu.se" }),
  ).toBeVisible();
  await expect(
    page.locator(".metric-value").filter({ hasText: /^42 / }),
  ).toHaveCount(3);
  await page.getByLabel("Elområde").selectOption("SE4");
  await expect(
    page.locator(".metric-value").filter({ hasText: /^84 / }),
  ).toHaveCount(3);
});
