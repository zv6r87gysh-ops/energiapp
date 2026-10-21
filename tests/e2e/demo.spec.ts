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

test("enhetsguiden skapar endast demoenheter", async ({ page }) => {
  await page.goto("/installningar");
  await page.getByRole("button", { name: "Lägg till demoenhet" }).click();
  const dialog = page.getByRole("dialog");
  for (let i = 1; i < 6; i++)
    await dialog.getByRole("button", { name: "Nästa", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Nästa", exact: true }),
  ).toBeDisabled();
  await dialog.getByRole("button", { name: "Testa demonstration" }).click();
  await dialog.getByRole("button", { name: "Nästa", exact: true }).click();
  await dialog.getByRole("button", { name: "Slutför demo" }).click();
  await expect(
    page.getByText("Min energimätare", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/Power Hub KM · Demo · Simulerad anslutning/),
  ).toBeVisible();
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
