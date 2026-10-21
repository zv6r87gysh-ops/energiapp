import { test, expect } from "@playwright/test";
test("panelerna visas endast på valda sidor och ackumulerad energi uppdateras", async ({
  page,
}) => {
  for (const route of [
    "/",
    "/forbrukning",
    "/pool",
    "/golvvarme",
    "/laddning",
    "/installningar",
    "/elpriser",
    "/kostnad",
    "/statistik",
    "/besparing",
  ]) {
    await page.goto(route);
    await expect(
      page.getByRole("heading", {
        name: "Koppla in dina egna enheter",
        exact: true,
      }),
    ).toHaveCount(["/pool", "/golvvarme", "/laddning"].includes(route) ? 1 : 0);
    await expect(
      page.getByRole("region", { name: "Husets smarta styrning" }),
    ).toHaveCount(["/", "/forbrukning"].includes(route) ? 1 : 0);
  }
  await page.goto("/forbrukning");
  const totals = page.getByRole("region", { name: "Ackumulerad förbrukning" });
  await expect(totals).toContainText("Total förbrukning denna månad");
  await expect(totals).toContainText("Modellvärden");
  const key = await page.evaluate(() =>
    Object.keys(localStorage).find((k) =>
      k.startsWith("energihem-energy-v1/"),
    )!,
  );
  const before = await page.evaluate((k) => localStorage.getItem(k), key);
  await expect
    .poll(() => page.evaluate((k) => localStorage.getItem(k), key))
    .not.toBe(before);
  await page.reload();
  await expect(totals).toContainText("Total förbrukning idag");
});
