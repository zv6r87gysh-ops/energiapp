import { test, expect } from "@playwright/test";
// These cases exercise the local-upload/no-default scenario; bundled asset has its own tests.
test.beforeEach(async ({ page }) => {
  await page.route("**/house-photo.json", (route) =>
    route.fulfill({ json: { householdId: "demo-home", url: null } }),
  );
});
import path from "node:path";
test("av/på visar spotlights på samma foto, sparas per hushåll och skickar inga Plejd-kommandon", async ({
  page,
}) => {
  let hardwareRequests = 0;
  page.on("request", (r) => {
    if (/\/api\/(lighting|plejd)/.test(r.url())) hardwareRequests++;
  });
  await page.goto("/");
  const card = page.getByRole("region", {
    name: "Ditt interaktiva hus",
    exact: true,
  });
  const toggle = page.getByRole("switch", {
    name: "Förhandsvisa utebelysning",
    exact: true,
  });
  await expect(toggle).not.toBeChecked();
  await card
    .getByLabel("Välj husfoto", { exact: true })
    .setInputFiles(path.resolve("public/icon-512.png"));
  const photo = card.getByRole("img", { name: /Ditt hus med interaktiva/ });
  await expect(photo).toBeVisible();
  const original = await photo.getAttribute("src");
  const overlay = page.getByTestId("outdoor-lighting-overlay");
  await expect(overlay).toHaveAttribute("data-power", "off");
  await expect(overlay.locator(".outdoor-light-wash")).toHaveCSS(
    "opacity",
    "0",
  );
  const photoToggle = card.getByRole("button", {
    name: "Utebelysning",
    exact: true,
  });
  await photoToggle.click();
  await expect(photoToggle).toHaveAttribute("aria-pressed", "true");
  await expect(overlay).toHaveAttribute("data-power", "on");
  await expect(overlay.locator(".outdoor-light-wash")).toHaveCSS(
    "opacity",
    "1",
  );
  await expect(overlay.locator("[data-spot]")).toHaveCount(20);
  await expect(photo).toHaveAttribute("src", original!);
  await page.reload();
  await expect(photoToggle).toHaveAttribute("aria-pressed", "true");
  await expect(photo).toBeVisible();
  await photoToggle.focus();
  await page.keyboard.press("Space");
  await expect(photoToggle).toHaveAttribute("aria-pressed", "false");
  await expect(overlay.locator(".outdoor-light-wash")).toHaveCSS(
    "opacity",
    "0",
  );
  expect(hardwareRequests).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("Plejd-referenser kan förberedas utan falsk anslutning och hålls isär mellan hushåll", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("switch", { name: "Förhandsvisa utebelysning", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Förbered Plejd-anslutning →", exact: true })
    .click();
  await page
    .getByLabel("Bryggans namn eller referens (valfritt)", { exact: true })
    .fill("Planerad brygga");
  await page
    .getByLabel("Plejd-ljusgruppens referens (valfritt)", { exact: true })
    .fill("Utebelysning");
  await page
    .getByRole("button", { name: "Spara Plejd-förberedelse", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Ingen anslutning eller verklig styrning",
  );
  await page.reload();
  await expect(
    page.getByLabel("Plejd-ljusgruppens referens (valfritt)", { exact: true }),
  ).toHaveValue("Utebelysning");
  await page
    .getByLabel("Nytt hushållsnamn")
    .fill("Nytt hus med egen belysning");
  await page
    .getByRole("button", { name: "Skapa hushåll", exact: true })
    .click();
  await expect(
    page.getByLabel("Plejd-ljusgruppens referens (valfritt)", { exact: true }),
  ).toHaveValue("");
  await page.goto("/");
  await expect(
    page.getByRole("switch", {
      name: "Förhandsvisa utebelysning",
      exact: true,
    }),
  ).not.toBeChecked();
  await page.getByLabel("Aktivt hushåll").selectOption("demo-home");
  await expect(
    page.getByRole("switch", {
      name: "Förhandsvisa utebelysning",
      exact: true,
    }),
  ).toBeChecked();
});

test("belysning saknar hovringsytor och popupreglage men knapparna fungerar", async ({
  page,
}) => {
  await page.goto("/");
  const card = page.getByRole("region", {
    name: "Ditt interaktiva hus",
    exact: true,
  });
  await card
    .getByLabel("Välj husfoto", { exact: true })
    .setInputFiles(path.resolve("public/icon-512.png"));
  await expect(
    card.getByRole("img", { name: /Ditt hus med interaktiva/ }),
  ).toBeVisible();
  await expect(
    card.locator(
      ".lighting-hit-overlay,.pool-lamp-hit,.house-lighting-popover",
    ),
  ).toHaveCount(0);
  for (const [name, overlay] of [
    ["Utebelysning", "outdoor-lighting-overlay"],
    ["Poolbelysning", "pool-lighting-overlay"],
  ]) {
    const button = card.getByRole("button", { name, exact: true });
    await button.hover();
    await expect(card.getByTestId(overlay)).toHaveAttribute(
      "data-power",
      "off",
    );
    await expect(card.getByRole("switch")).toHaveCount(0);
    await button.click();
    await expect(card.getByTestId(overlay)).toHaveAttribute("data-power", "on");
    await button.click();
    await expect(card.getByTestId(overlay)).toHaveAttribute(
      "data-power",
      "off",
    );
  }
});
