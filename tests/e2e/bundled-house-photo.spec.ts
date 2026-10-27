import { test, expect } from "@playwright/test";
test("originalfotot är inbyggt och rätt linjerat även i en tom ny session", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  const photo = page.getByRole("img", { name: /Ditt hus med interaktiva/ });
  await expect(photo).toBeVisible();
  await expect(photo).toHaveAttribute("src", "/images/house-photo.jpg");
  const dimensions = await photo.evaluate((img) => ({
    w: (img as HTMLImageElement).naturalWidth,
    h: (img as HTMLImageElement).naturalHeight,
  }));
  expect(dimensions).toEqual({ w: 1448, h: 1086 });
  const card = page.getByRole("region", {
    name: "Ditt interaktiva hus",
    exact: true,
  });
  await expect(card.locator(".house-photo-overlay")).toHaveAttribute(
    "viewBox",
    /-279/,
  );
  const viewBox = await card
    .locator(".house-photo-overlay")
    .getAttribute("viewBox");
  await expect(card.getByTestId("outdoor-lighting-overlay")).toHaveAttribute(
    "viewBox",
    viewBox!,
  );
  await expect(card.locator(".lighting-hit-overlay")).toHaveCount(0);
  await card.locator(".house-photo-visual").hover();
  const smart = card.locator(".house-smart-controls");
  await expect(
    smart.getByRole("button", { name: "Aktivera smart styrning", exact: true }),
  ).toBeVisible();
  const frame = await card.locator(".house-photo-scene").boundingBox();
  const box = await smart.boundingBox();
  expect(box!.y - frame!.y).toBeLessThan(20);
  expect(frame!.x + frame!.width - (box!.x + box!.width)).toBeLessThan(20);
  await card.getByRole("button", { name: "Utebelysning", exact: true }).click();
  await expect(card.getByTestId("outdoor-lighting-overlay")).toHaveAttribute(
    "data-power",
    "on",
  );
  const ctx = await browser.newContext();
  try {
    const fresh = await ctx.newPage();
    await fresh.goto("http://127.0.0.1:3000/");
    await expect(
      fresh.getByRole("img", { name: /Ditt hus med interaktiva/ }),
    ).toHaveAttribute("src", "/images/house-photo.jpg");
  } finally {
    await ctx.close();
  }
});
