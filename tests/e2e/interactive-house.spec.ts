import { test, expect } from "@playwright/test";
import { dayBounds } from "../../lib/prices/time";
import path from "node:path";
test("eget husfoto sparas, markeringar lyser och kostnadsrutan länkar till rätt kategori", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-21T12:00:00Z") });
  await page.route("**/api/electricity-prices?*", async (route) => {
    const query = new URL(route.request().url());
    const date =
      query.searchParams.get("day") === "tomorrow"
        ? "2026-10-22"
        : "2026-10-21";
    const { start, end } = dayBounds(date);
    const intervals = Array.from(
      { length: (end - start) / 900000 },
      (_, i) => ({
        start: new Date(start + i * 900000).toISOString(),
        end: new Date(start + (i + 1) * 900000).toISOString(),
        ore: 100,
      }),
    );
    await route.fulfill({
      json: {
        status: "available",
        data: {
          area: "SE3",
          date,
          source: "Elprisetjustnu.se",
          sourceUrl: "https://www.elprisetjustnu.se/elpris-api",
          fetchedAt: "2026-10-21T12:00:00Z",
          intervals,
        },
      },
    });
  });
  await page.goto("/");
  const card = page.getByRole("region", {
    name: "Ditt interaktiva hus",
    exact: true,
  });
  await expect(
    card.getByText("Lägg till fotot på ditt hus", { exact: true }),
  ).toBeVisible();
  expect(
    await card.evaluate((element) =>
      element.previousElementSibling?.classList.contains("page-heading"),
    ),
  ).toBe(true);
  await card
    .getByLabel("Välj husfoto", { exact: true })
    .setInputFiles(path.resolve("public/icon-512.png"));
  await expect(
    card.getByRole("img", { name: /Ditt hus med interaktiva/ }),
  ).toBeVisible();
  const alignment = await card
    .locator(".house-photo-scene")
    .evaluate((scene) => {
      const image = scene.querySelector("img")!;
      const photo = image.getBoundingClientRect();
      const overlay = scene.querySelector("svg")!.getBoundingClientRect();
      return {
        aspectError: Math.abs(
          photo.width / photo.height - image.naturalWidth / image.naturalHeight,
        ),
        offsetX: Math.abs(photo.x - overlay.x),
        offsetY: Math.abs(photo.y - overlay.y),
        widthError: Math.abs(photo.width - overlay.width),
        heightError: Math.abs(photo.height - overlay.height),
      };
    });
  expect(alignment.aspectError).toBeLessThan(0.01);
  expect(
    alignment.offsetX +
      alignment.offsetY +
      alignment.widthError +
      alignment.heightError,
  ).toBeLessThan(2);
  await card
    .getByRole("button", { name: "Visa kostnad för Pool", exact: true })
    .click();
  await expect(card.locator(".house-hit-pool")).toHaveClass(/is-active/);
  await expect(card.getByRole("status")).toContainText("Kostnad hittills idag");
  await expect(card.locator(".house-cost-tooltip b")).toHaveText(/18\s+kr/);
  await expect(card.locator(".house-photo-hover-card")).toContainText(
    "Modellerad kostnad",
  );
  await expect(card.locator(".house-photo-hover-card")).toBeVisible();
  await expect(
    card.locator(".house-photo-hover-card .house-savings"),
  ).toContainText(/44\s+kr/);
  await expect(
    card.getByRole("link", { name: "Öppna Pool →", exact: true }),
  ).toHaveAttribute("href", "/pool");
  await card.getByRole("button", { name: "Golvvärme", exact: true }).click();
  await expect(card.getByRole("status")).toContainText(
    "Separat kostnad saknas",
  );
  await expect(
    card.getByRole("link", { name: "Öppna Golvvärme →", exact: true }),
  ).toHaveAttribute("href", "/golvvarme");
  await expect(card.locator(".house-floor-coils")).toHaveCSS("opacity", "1");
  await card.locator(".house-photo-visual").hover();
  const photoControls = card.locator(".house-smart-controls");
  await photoControls
    .getByRole("button", { name: "Aktivera smart styrning", exact: true })
    .click();
  const smartDialog = page.getByRole("dialog", {
    name: "Vad vill du optimera?",
  });
  await smartDialog
    .getByRole("checkbox", { name: "Pool", exact: true })
    .check();
  await smartDialog
    .getByRole("button", { name: "Aktivera simulering", exact: true })
    .click();
  await expect(
    photoControls.getByRole("region", { name: "Husets smarta styrning" }),
  ).toContainText("Valda kategorier: Pool");

  await page.reload();
  await expect(
    card.getByRole("img", { name: /Ditt hus med interaktiva/ }),
  ).toBeVisible();
  await card
    .getByRole("button", { name: "Visa kostnad för Billaddare", exact: true })
    .click();
  await card
    .getByRole("link", { name: "Öppna Billaddare →", exact: true })
    .click();
  await expect(page).toHaveURL(/\/laddning$/);
  await expect(
    page.getByRole("region", { name: "Ditt interaktiva hus", exact: true }),
  ).toHaveCount(0);
});
test("fotot är isolerat mellan hushåll och felaktiga filer ger ett begripligt fel", async ({
  page,
}) => {
  await page.goto("/");
  const card = page.getByRole("region", {
    name: "Ditt interaktiva hus",
    exact: true,
  });
  await card.getByLabel("Välj husfoto", { exact: true }).setInputFiles({
    name: "broken.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("not an image"),
  });
  await expect(card).toContainText("Bilden kunde inte läsas");
  await card
    .getByLabel("Välj husfoto", { exact: true })
    .setInputFiles(path.resolve("public/icon-512.png"));
  await expect(
    card.getByRole("img", { name: /Ditt hus med interaktiva/ }),
  ).toBeVisible();
  await page.goto("/installningar");
  await page.getByLabel("Nytt hushållsnamn").fill("Annat hus");
  await page
    .getByRole("button", { name: "Skapa hushåll", exact: true })
    .click();
  await page.goto("/");
  await expect(
    card.getByText("Lägg till fotot på ditt hus", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("muspekare och tangentbordsfokus väljer markering utan att navigera", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Mobil använder tryck och separat Öppna-länk");
  await page.goto("/");
  const card = page.getByRole("region", {
    name: "Ditt interaktiva hus",
    exact: true,
  });
  await card
    .getByLabel("Välj husfoto", { exact: true })
    .setInputFiles(path.resolve("public/icon-512.png"));
  const pool = card.getByRole("button", {
    name: "Visa kostnad för Pool",
    exact: true,
  });
  await pool.hover();
  await expect(card.locator(".house-hit-pool")).toHaveClass(/is-active/);
  await expect(page).toHaveURL(/\/$/);
  await card
    .getByRole("button", { name: "Visa kostnad för Billaddare", exact: true })
    .focus();
  await expect(card.locator(".house-hit-charging")).toHaveClass(/is-active/);
  await expect(
    card.getByRole("link", { name: "Öppna Billaddare →", exact: true }),
  ).toHaveAttribute("href", "/laddning");
});
