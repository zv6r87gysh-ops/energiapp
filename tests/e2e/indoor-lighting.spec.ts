import { expect, test } from "@playwright/test";
test("inomhusgrupper och alla utelampor samlas under Belysning; foto och val sparas utan hårdvarukommandon", async ({
  page,
}) => {
  let commands = 0;
  page.on("request", (r) => {
    if (/\/api\/(lighting|plejd)/.test(r.url())) commands++;
  });
  await page.goto("/belysning");
  await expect(
    page.getByRole("heading", { level: 1, name: "Belysning" }),
  ).toBeVisible();
  const indoor = page.locator("#inomhus");
  const first = indoor.getByRole("button", { name: /Stort fönster vänster/ });
  await expect(first).toHaveAttribute("aria-pressed", "false");
  await first.click();
  await expect(first).toHaveAttribute("aria-pressed", "true");
  await expect(
    indoor.getByRole("button", { name: /Stort fönster höger/ }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(
    page
      .locator("#utomhus")
      .getByRole("heading", { name: "Poolbelysning", exact: true }),
  ).toBeVisible();
  await indoor.locator("summary").click();
  await expect(indoor.getByLabel("Anslutning till Plejd")).toHaveValue(
    "bluetooth",
  );
  await indoor
    .getByLabel("Stort fönster vänster · ljusgruppens referens")
    .fill("Vardagsrum fönster 1");
  await indoor
    .getByRole("button", { name: "Spara inomhusbelysningens Plejd-uppgifter" })
    .click();
  await expect(indoor.getByRole("status")).toContainText(
    "Ingen fysisk anslutning",
  );
  await page.goto("/");
  const overlay = page.getByTestId("indoor-lighting-overlay");
  await expect(overlay.locator("[data-indoor-spot]")).toHaveCount(10);
  await expect(
    overlay.locator('[data-indoor-group="large-left"]'),
  ).toHaveAttribute("data-power", "on");
  await expect(overlay.locator('[data-power="off"]')).toHaveCount(3);
  const all = page.getByRole("button", {
    name: "Inomhusbelysning",
    exact: true,
  });
  await all.click();
  await expect(overlay.locator('[data-power="on"]')).toHaveCount(4);
  await all.click();
  await expect(overlay.locator('[data-power="off"]')).toHaveCount(4);
  await page.reload();
  await expect(all).toHaveAttribute("aria-pressed", "false");
  await page.goto("/belysning");
  await page.locator("#inomhus summary").click();
  await expect(
    page.getByLabel("Stort fönster vänster · ljusgruppens referens"),
  ).toHaveValue("Vardagsrum fönster 1");
  expect(commands).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
