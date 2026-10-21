import { test, expect, type Page } from "@playwright/test";
async function fillDevice(page: Page, name = "Poolens WiFi-box") {
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "WiFi-box till poolen" }).click();
  await dialog.getByLabel("Enhetens namn", { exact: true }).fill(name);
  await dialog.getByLabel("Tillverkare", { exact: true }).fill("Pahlén");
  await dialog.getByLabel("Exakt modell", { exact: true }).fill("WiFi-modul");
  await dialog
    .getByLabel("Serienummer / Enhets-ID", { exact: true })
    .fill("BOX-12345");
  await dialog
    .getByRole("button", { name: "Kontrollera uppgifter", exact: true })
    .click();
}
test("enheter kan registreras från poolfliken och hanteras i inställningar", async ({
  page,
}) => {
  await page.goto("/pool");
  await page
    .getByRole("button", { name: "Lägg till egen enhet", exact: true })
    .click();
  await fillDevice(page);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Förberedd – ej ansluten");
  await dialog
    .getByRole("button", { name: "Spara enhet", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await page.getByRole("link", { name: "Hantera dina enheter" }).click();
  const device = page.getByRole("article", { name: "Enhet: Poolens WiFi-box" });
  await expect(device).toContainText("BOX-12345");
  await expect(device).toContainText("Ingen avläsning");
  await page.reload();
  await expect(device).toBeVisible();
  await device.getByRole("button", { name: "Redigera uppgifter" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Enhetens namn", { exact: true })
    .fill("Poolen hemma");
  await page
    .getByRole("button", { name: "Kontrollera uppgifter", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Spara ändringar", exact: true })
    .click();
  const renamed = page.getByRole("article", { name: "Enhet: Poolen hemma" });
  await expect(renamed).toBeVisible();
  await renamed.getByRole("button", { name: "Ta bort", exact: true }).click();
  await renamed.getByRole("button", { name: "Bekräfta borttagning" }).click();
  await expect(renamed).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("validerar ID, stoppar dubbletter och aktiverar inte smart styrning", async ({
  page,
}) => {
  await page.goto("/pool");
  await page
    .getByRole("button", { name: "Lägg till egen enhet", exact: true })
    .click();
  await fillDevice(page);
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Spara enhet", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Lägg till egen enhet", exact: true })
    .click();
  await fillDevice(page, "En dubblett");
  await dialog
    .getByRole("button", { name: "Spara enhet", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("finns redan");
  await dialog.getByRole("button", { name: "Ändra uppgifter" }).click();
  await dialog.getByLabel("Serienummer / Enhets-ID", { exact: true }).fill("1");
  await dialog
    .getByRole("button", { name: "Kontrollera uppgifter", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("minst tre tecken");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await page.goto("/forbrukning");
  await expect(
    page.getByRole("button", { name: "Aktivera smart styrning", exact: true }),
  ).toBeVisible();
  await page.goto("/installningar");
  await expect(
    page.getByRole("article", { name: "Enhet: Poolens WiFi-box" }),
  ).toHaveCount(1);
});
test("registrerade enheter hålls isär mellan hushåll", async ({ page }) => {
  await page.goto("/pool");
  await page
    .getByRole("button", { name: "Lägg till egen enhet", exact: true })
    .click();
  await fillDevice(page);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Spara enhet", exact: true })
    .click();
  await page.goto("/installningar");
  await page.getByLabel("Nytt hushållsnamn").fill("Grannens demo");
  await page
    .getByRole("button", { name: "Skapa hushåll", exact: true })
    .click();
  await expect(
    page.getByRole("article", { name: "Enhet: Poolens WiFi-box" }),
  ).toHaveCount(0);
  await page.getByLabel("Aktivt hushåll").selectOption("demo-home");
  await expect(
    page.getByRole("article", { name: "Enhet: Poolens WiFi-box" }),
  ).toBeVisible();
});
