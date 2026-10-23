import { test, expect } from "@playwright/test";
import { initialHousehold } from "../../lib/demo";
test("väljer kategorier, sparar och synkar med pool och laddare", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Aktivera smart styrning", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Vad vill du optimera?" });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("checkbox", { name: "Golvvärme", exact: true }),
  ).toBeDisabled();
  await expect(
    dialog.getByRole("checkbox", { name: "Övriga enheter" }),
  ).toBeDisabled();
  await expect(
    dialog.getByRole("button", { name: "Aktivera simulering", exact: true }),
  ).toBeDisabled();
  await dialog.getByRole("checkbox", { name: "Pool", exact: true }).check();
  await dialog
    .getByRole("checkbox", { name: "Billaddare", exact: true })
    .check();
  await dialog
    .getByRole("button", { name: "Aktivera simulering", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("region", { name: "Husets smarta styrning" }),
  ).toContainText("Valda kategorier: Pool och Billaddare");
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Husets smarta styrning" }),
  ).toContainText("Demo aktiv");
  await page.goto("/pool");
  await expect(page.getByLabel("Simulerat driftläge")).toHaveValue("Smart");
  await page.getByLabel("Simulerat driftläge").selectOption("Manuellt");
  await page.goto("/forbrukning");
  await expect(
    page.getByRole("region", { name: "Husets smarta styrning" }),
  ).toContainText("Valda kategorier: Billaddare");
  await page.goto("/laddning");
  await page
    .getByRole("button", { name: "Smart simulering: på", exact: true })
    .click();
  await page.goto("/forbrukning");
  await expect(
    page.getByRole("button", { name: "Aktivera smart styrning", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("paus, återupptagning och avbryt utan att spara dialogändringar", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Aktivera smart styrning", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Vad vill du optimera?" });
  await dialog.getByRole("checkbox", { name: "Pool", exact: true }).check();
  await dialog
    .getByRole("button", { name: "Aktivera simulering", exact: true })
    .click();
  await page.getByRole("button", { name: "Pausa alla", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Husets smarta styrning" }),
  ).toContainText("Demo pausad");
  await page
    .getByRole("button", { name: "Återuppta smart styrning", exact: true })
    .click();
  await expect(
    dialog.getByRole("checkbox", { name: "Pool", exact: true }),
  ).toBeChecked();
  await dialog
    .getByRole("checkbox", { name: "Billaddare", exact: true })
    .check();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await page
    .getByRole("button", { name: "Återuppta smart styrning", exact: true })
    .click();
  await expect(
    dialog.getByRole("checkbox", { name: "Billaddare", exact: true }),
  ).not.toBeChecked();
  await dialog
    .getByRole("button", { name: "Aktivera simulering", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Husets smarta styrning" }),
  ).toContainText("Valda kategorier: Pool.");
  await page
    .getByRole("button", { name: "Ändra smart styrning", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Stäng av och rensa val", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Aktivera smart styrning", exact: true }),
  ).toBeVisible();
});
test("äldre lokala inställningar aktiverar inte huset och hushållens val är separata", async ({
  page,
}) => {
  const legacy = { ...initialHousehold, smart: true };
  delete legacy.smartControl;
  await page.addInitScript((home) => {
    if (!localStorage.getItem("energihem-demo-v1"))
      localStorage.setItem(
        "energihem-demo-v1",
        JSON.stringify({ homes: [home], active: home.id }),
      );
  }, legacy);
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Aktivera smart styrning", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Aktivera smart styrning", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Vad vill du optimera?" });
  await dialog.getByRole("checkbox", { name: "Pool", exact: true }).check();
  await dialog
    .getByRole("button", { name: "Aktivera simulering", exact: true })
    .click();
  await page.goto("/installningar");
  await page.getByLabel("Nytt hushållsnamn").fill("Grannens demo");
  await page
    .getByRole("button", { name: "Skapa hushåll", exact: true })
    .click();
  await page.goto("/forbrukning");
  await expect(
    page.getByRole("button", { name: "Aktivera smart styrning", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Aktivt hushåll").selectOption("demo-home");
  await expect(
    page.getByRole("region", { name: "Husets smarta styrning" }),
  ).toContainText("Valda kategorier: Pool.");
});
