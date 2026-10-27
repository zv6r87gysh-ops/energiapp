import { test, expect } from "@playwright/test";
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
  await card.getByRole("button", { name: "Utebelysning", exact: true }).click();
  await toggle.click();
  await expect(toggle).toBeChecked();
  await expect(overlay).toHaveAttribute("data-power", "on");
  await expect(overlay.locator(".outdoor-light-wash")).toHaveCSS(
    "opacity",
    "1",
  );
  await expect(overlay.locator("[data-spot]")).toHaveCount(20);
  await expect(photo).toHaveAttribute("src", original!);
  await expect(card).toContainText("Förhandsvisning · utebelysning tänd");
  await expect(
    page.getByRole("region", { name: "Utebelysning", exact: true }),
  ).toContainText("Plejd · Ej ansluten");
  await page.reload();
  await card.getByRole("button", { name: "Utebelysning", exact: true }).click();
  await expect(toggle).toBeChecked();
  await expect(photo).toBeVisible();
  await toggle.focus();
  await page.keyboard.press("Space");
  await expect(toggle).not.toBeChecked();
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

test("bilden saknar markeringar i vila och varje ljuspunkt öppnar ett gemensamt reglage", async ({
  page,
  isMobile,
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
  await expect(card.locator(".house-hit.is-active")).toHaveCount(0);
  await expect(card.locator(".house-pin-house")).toHaveCSS("opacity", "0");
  await expect(card.locator(".house-photo-hover-card")).toBeHidden();
  await expect(card.locator(".house-lighting-popover")).toBeHidden();
  if (!isMobile) {
    await card.locator('[data-light-hit="left-0"]').hover();
  } else {
    await card
      .getByRole("button", { name: "Utebelysning", exact: true })
      .click();
  }
  await expect(card.locator(".house-lighting-popover")).toBeVisible();
  const toggle = card.getByRole("switch", {
    name: "Förhandsvisa utebelysning",
    exact: true,
  });
  await expect(toggle).not.toBeChecked(); // Hovering itself never toggles power.
  await toggle.click();
  await expect(toggle).toBeChecked();
  await expect(page.getByTestId("outdoor-lighting-overlay")).toHaveAttribute(
    "data-power",
    "on",
  );
  if (!isMobile) {
    await page.mouse.move(1, 1);
    await expect(card.locator(".house-lighting-popover")).toBeHidden();
    await expect(card.locator(".house-hit.is-active")).toHaveCount(0);
  }
});
