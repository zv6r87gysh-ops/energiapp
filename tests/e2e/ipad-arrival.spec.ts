import { expect, test } from "@playwright/test";
import { initialHousehold } from "../../lib/demo";
import { defaultMoods } from "../../lib/moods/contracts";
const disconnected = {
  sonos: { configured: false, connected: false },
  spotify: { configured: false, connected: false },
  rooms: [],
  devices: [],
};
const connected = {
  sonos: { configured: true, connected: true },
  spotify: { configured: true, connected: true },
  rooms: [{ id: "room1", name: "Vardagsrum" }],
  devices: [
    { id: "device1", name: "Vardagsrum", restricted: false, kind: "Speaker" },
  ],
};
const playerSnapshot = {
  room: "room1",
  playing: true,
  itemId: "track-1",
  title: "Testlåt",
  artist: "Testartist",
  position: 60000,
  duration: 240000,
  volume: 18,
  fixedVolume: false,
  shuffle: true,
  repeatOne: false,
  canNext: true,
  canPrevious: true,
  canSeek: true,
};
test.beforeEach(async ({ page }) => {
  await page.route("**/api/music/player?*", (r) =>
    r.fulfill({ json: { ...playerSnapshot, sampledAt: Date.now() } }),
  );
  await page.route("**/api/music/player", (r) =>
    r.fulfill({ json: { ...playerSnapshot, sampledAt: Date.now() } }),
  );
});
for (const viewport of [
  { width: 1024, height: 768 },
  { width: 1366, height: 1024 },
]) {
  test(`hus och tre stora musikknappar syns utan att scrolla på liggande iPad ${viewport.width}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    let commands = 0;
    await page.route("**/api/music?*", (r) =>
      r.fulfill({ json: disconnected }),
    );
    await page.route("**/api/music", (r) => {
      commands++;
      return r.fulfill({ status: 503, json: { message: "Inte anslutet" } });
    });
    await page.goto("/");
    const image = page.getByRole("img", { name: /Ditt hus med interaktiva/ });
    await expect(image).toBeVisible();
    const house = await page.locator(".house-photo-scene").boundingBox();
    const music = page.getByRole("region", {
      name: "Musik och stämningar",
      exact: true,
    });
    const area = await music.boundingBox();
    expect(area!.x).toBeGreaterThan(house!.x + house!.width);
    expect(house!.y + house!.height).toBeLessThan(viewport.height);
    for (const label of ["Barn", "Lounge/chill", "Stämning"]) {
      const button = music.getByRole("button", {
        name: `Förhandsvisa ${label}`,
        exact: true,
      });
      const box = await button.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.y + box!.height).toBeLessThan(viewport.height);
    }
    await music
      .getByRole("button", { name: "Förhandsvisa Lounge/chill", exact: true })
      .click();
    await expect(music).toContainText("Ingen musik startades");
    await expect(
      page
        .getByTestId("indoor-lighting-overlay")
        .locator('[data-indoor-group="large-left"]'),
    ).toHaveAttribute("opacity", "0.2");
    await music
      .getByRole("button", { name: "Förhandsvisa Barn", exact: true })
      .click();
    await expect(
      page
        .getByTestId("indoor-lighting-overlay")
        .locator('[data-indoor-group="large-left"]'),
    ).toHaveAttribute("opacity", "0.8");
    await music
      .getByRole("button", { name: "Förhandsvisa Stämning", exact: true })
      .click();
    await expect(
      page
        .getByTestId("indoor-lighting-overlay")
        .locator('[data-indoor-group="large-left"]'),
    ).toHaveAttribute("opacity", "0.35");
    expect(commands).toBe(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
test("musikinställningar sparar genresökningar och molninloggning går via respektive tjänst", async ({
  page,
}) => {
  await page.route("**/api/music?*", (r) =>
    r.fulfill({
      json: {
        ...disconnected,
        sonos: { configured: true, connected: false },
        spotify: { configured: true, connected: false },
      },
    }),
  );
  await page.goto("/installningar#music-settings");
  const settings = page.locator("#music-settings");
  await expect(
    settings.getByRole("link", { name: "Logga in på Sonos", exact: true }),
  ).toHaveAttribute("href", /\/api\/music\/connect\?provider=sonos/);
  await expect(
    settings.getByRole("link", { name: "Logga in på Spotify", exact: true }),
  ).toHaveAttribute("href", /\/api\/music\/connect\?provider=spotify/);
  await settings
    .getByLabel("Musikstil / sökord för Lounge/chill", { exact: true })
    .fill("chill lounge jazz");
  await settings
    .getByLabel("Ljus för Lounge/chill (%)", { exact: true })
    .fill("15");
  await settings
    .getByRole("button", { name: "Spara stämningar", exact: true })
    .click();
  await expect(settings.getByRole("status")).toContainText("har sparats");
  await page.goto("/");
  const blue = page.getByRole("button", {
    name: "Förhandsvisa Lounge/chill",
    exact: true,
  });
  await expect(blue).toContainText("chill lounge jazz");
  await blue.click();
  await expect(
    page
      .getByTestId("indoor-lighting-overlay")
      .locator('[data-indoor-group="large-left"]'),
  ).toHaveAttribute("opacity", "0.15");
});
test("ansluten musik skickar sökord, visar spellistan och skiljer ljud från ljusförhandsvisning", async ({
  page,
}) => {
  const home = {
    ...structuredClone(initialHousehold),
    moodSettings: {
      ...structuredClone(defaultMoods),
      room: "room1",
      device: "device1",
    },
  };
  await page.addInitScript(
    (h) =>
      localStorage.setItem(
        "energihem-demo-v1",
        JSON.stringify({ homes: [h], active: h.id }),
      ),
    home,
  );
  await page.route("**/api/music?*", (r) => r.fulfill({ json: connected }));
  let payload: Record<string, unknown> | null = null;
  await page.route("**/api/music", async (route) => {
    payload = route.request().postDataJSON();
    await route.fulfill({
      json: {
        mood: "lounge",
        playlist: {
          name: "Slumpvald chill",
          url: "https://open.spotify.com/playlist/test",
        },
        music: {
          status: "playing",
          message: "Spotify rapporterar uppspelning av vald spellista.",
        },
        lights: {
          status: "preview",
          message: "Ljusnivån visas på husbilden. Plejd är inte anslutet.",
        },
      },
    });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Spela Lounge/chill", exact: true })
    .click();
  expect(payload).toMatchObject({
    mood: "lounge",
    room: "room1",
    device: "device1",
    style: { query: "lounge chill", brightness: 20 },
  });
  expect(payload).not.toHaveProperty("playlistId");
  await expect(
    page.getByRole("region", { name: "Musik och stämningar", exact: true }),
  ).not.toContainText("Spotify rapporterar uppspelning");
  await expect(
    page.getByRole("region", { name: "Musik och stämningar", exact: true }),
  ).toContainText("tills Plejd är anslutet");
  await expect(
    page.getByRole("link", { name: /Slumpvald chill/ }),
  ).toHaveAttribute("href", "https://open.spotify.com/playlist/test");
});

for (const viewport of [
  { width: 1024, height: 768 },
  { width: 1366, height: 1024 },
]) {
  test(`väder, tid, aktuellt spotpris, hus och musik är synliga samtidigt på iPad ${viewport.width}`, async ({
    page,
  }) => {
    const now = Date.parse("2026-11-16T16:00:00Z");
    await page.setViewportSize(viewport);
    await page.clock.install({ time: new Date(now) });
    await page.addInitScript(
      (home) =>
        localStorage.setItem(
          "energihem-demo-v1",
          JSON.stringify({ homes: [home], active: home.id }),
        ),
      { ...structuredClone(initialHousehold), postcode: "13230" },
    );
    await page.route("**/api/music?*", (r) =>
      r.fulfill({ json: disconnected }),
    );
    const { weatherFixture } = await import("../fixtures/weather");
    await page.route("**/api/weather?*", (r) =>
      r.fulfill({
        json: { status: "available", data: weatherFixture(5, now) },
      }),
    );
    await page.route("**/api/electricity-prices?*", async (r) => {
      const { dayBounds } = await import("../../lib/prices/time");
      const day =
        new URL(r.request().url()).searchParams.get("day") === "tomorrow"
          ? "2026-11-17"
          : "2026-11-16";
      const { start, end } = dayBounds(day);
      await r.fulfill({
        json: {
          status: "available",
          area: "SE3",
          date: day,
          data: {
            area: "SE3",
            date: day,
            source: "Elprisetjustnu.se",
            sourceUrl: "https://www.elprisetjustnu.se/elpris-api",
            fetchedAt: new Date(now).toISOString(),
            intervals: Array.from(
              { length: (end - start) / 900000 },
              (_, i) => ({
                start: new Date(start + i * 900000).toISOString(),
                end: new Date(start + (i + 1) * 900000).toISOString(),
                ore: 123.4,
              }),
            ),
          },
        },
      });
    });
    await page.goto("/");
    const price = page.getByRole("link", {
      name: "Aktuellt spotpris SE3",
      exact: true,
    });
    await expect(price).toContainText("123,4 öre/kWh");
    await expect(price).toContainText("Exkl. moms");
    const forecast = page.getByRole("region", {
      name: "Väder vid huset kommande 24 timmar",
      exact: true,
    });
    await expect(forecast.getByRole("listitem")).toHaveCount(8);
    await expect(
      page.getByLabel("Klocka svensk tid", { exact: true }),
    ).toHaveText(/17:00:/);
    const chart = page.getByRole("img", { name: "Publicerade kvartspriser" });
    await expect(chart).toBeVisible();
    await expect(chart.locator("[data-price-state]")).toHaveCount(96);
    const clock = page.getByLabel("Klocka svensk tid", { exact: true });
    expect(
      await clock.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
    ).toBeGreaterThanOrEqual(24);
    for (const locator of [
      chart,
      price,
      forecast,
      page.getByLabel("Klocka svensk tid", { exact: true }),
      page.locator(".house-photo-scene"),
      page.getByRole("button", { name: "Förhandsvisa Stämning", exact: true }),
    ]) {
      const box = await locator.boundingBox();
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

test("Spotify-retur visar en tydlig orsak även utan ny inloggning eller högtalarlista", async ({
  page,
}) => {
  await page.route("**/api/music?*", (r) =>
    r.fulfill({
      json: {
        ...connected,
        devices: [],
        spotify: {
          configured: true,
          connected: true,
          message:
            "Spotify: Inloggningen är sparad, men åtkomst till högtalarlistan nekas. Kontrollera User Management.",
        },
      },
    }),
  );
  await page.goto(
    "/installningar?music=oauth-invalid-client&provider=spotify#music-settings",
  );
  const settings = page.locator("#music-settings");
  await expect(settings.locator(".music-login-feedback")).toContainText(
    "Client ID eller Client Secret",
  );
  await expect(settings.locator(".music-login-feedback")).toContainText(
    "kod: oauth-invalid-client",
  );
  await expect(settings).toContainText("User Management");
  await expect(
    settings
      .locator(".music-account-links > div")
      .filter({ has: page.getByText("Spotify", { exact: true }) }),
  ).toContainText("Anslutet");
  await expect(
    settings
      .locator(".music-account-links > div")
      .filter({ has: page.getByText("Sonos", { exact: true }) }),
  ).toContainText("Anslutet");
});

test("ett tidigare sparat iPhone-val kan inte starta musik från Sonos-knapparna", async ({
  page,
}) => {
  const home = {
    ...structuredClone(initialHousehold),
    moodSettings: {
      ...structuredClone(defaultMoods),
      room: "room1",
      device: "phone1",
    },
  };
  await page.addInitScript(
    (h) =>
      localStorage.setItem(
        "energihem-demo-v1",
        JSON.stringify({ homes: [h], active: h.id }),
      ),
    home,
  );
  const state = {
    ...connected,
    devices: [
      { id: "phone1", name: "iPhone", restricted: false, kind: "Smartphone" },
    ],
  };
  let commands = 0;
  await page.route("**/api/music?*", (r) => r.fulfill({ json: state }));
  await page.route("**/api/music", (r) => {
    commands++;
    return r.fulfill({ status: 400, json: { message: "Inte en högtalare" } });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Förhandsvisa Lounge/chill", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Musik och stämningar", exact: true }),
  ).toContainText("Ingen musik startades");
  expect(commands).toBe(0);
  await page.goto("/installningar#music-settings");
  await expect(page.locator('select option[value="phone1"]')).toHaveJSProperty(
    "disabled",
    true,
  );
});
test("Sonos direkt startar med ett tryck utan Spotify eller telefon", async ({
  page,
}) => {
  const home = {
    ...structuredClone(initialHousehold),
    moodSettings: {
      ...structuredClone(defaultMoods),
      sourceMode: "sonos",
      room: "room1",
    },
  };
  Object.assign(home.moodSettings.styles.lounge, {
    sonosItems: [{ id: "chill", kind: "favorite" }],
  });
  await page.addInitScript(
    (h) =>
      localStorage.setItem(
        "energihem-demo-v1",
        JSON.stringify({ homes: [h], active: h.id }),
      ),
    home,
  );
  await page.route("**/api/music?*", (r) =>
    r.fulfill({
      json: {
        ...connected,
        spotify: { configured: false, connected: false },
        devices: [],
      },
    }),
  );
  let payload: Record<string, unknown> | null = null;
  await page.route("**/api/music/player", async (r) => {
    payload = r.request().postDataJSON();
    await r.fulfill({
      json: { ...playerSnapshot, volume: 23, sampledAt: Date.now() },
    });
  });

  await page.route("**/api/music", async (r) => {
    payload = r.request().postDataJSON();
    await r.fulfill({
      json: {
        mood: "lounge",
        playlist: { name: "Chillfavorit" },
        music: { status: "requested", message: "Sonos tog emot startbegäran." },
        lights: { status: "preview", message: "Plejd är inte anslutet." },
      },
    });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Spela Lounge/chill", exact: true })
    .click();
  await expect(page.getByText("Chillfavorit", { exact: true })).toBeVisible();
  expect(payload).toMatchObject({
    sourceMode: "sonos",
    room: "room1",
    style: { sonosItems: [{ id: "chill", kind: "favorite" }] },
  });
  expect(payload).not.toHaveProperty("device");
  await expect(
    page.getByText("Sonos tog emot startbegäran.", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Nästa låt", exact: true }).click();
  expect(payload).toMatchObject({
    householdId: home.id,
    room: "room1",
    action: "next",
  });
  await expect(
    page.getByRole("region", { name: "Sonos mediaspelare" }),
  ).toContainText("Testlåt");
  await page
    .getByRole("button", { name: "Föregående låt", exact: true })
    .click();
  expect(payload).toMatchObject({ action: "previous", room: "room1" });
  await page.getByRole("button", { name: "Höj volym", exact: true }).click();
  expect(payload).toMatchObject({ action: "volume", delta: 5, room: "room1" });
  await expect(page.getByLabel("Sonos-volym", { exact: true })).toHaveText(
    "23 %",
  );
  const seek = page.getByRole("slider", { name: "Spola i låten" });
  await seek.focus();
  await page.keyboard.press("ArrowRight");
  expect(payload).toMatchObject({
    action: "seek",
    itemId: "track-1",
    room: "room1",
  });
});
test("husbilden fyller kortet och kontroller visas först efter tryck", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.route("**/api/music?*", (r) => r.fulfill({ json: disconnected }));
  await page.goto("/");
  const scene = page.locator(".house-photo-scene");
  await expect(scene.locator("img")).toBeVisible();
  await expect(scene.locator(".house-category-tabs")).toBeHidden();
  await expect(
    page.getByRole("link", { name: "Elkostnad hittills idag" }),
  ).toBeVisible();
  const cardWidth = await page
    .locator(".interactive-house")
    .evaluate((el) => el.clientWidth);
  const bounds = await scene.boundingBox();
  expect(bounds!.width).toBeGreaterThan(cardWidth - 25);
  await scene.locator("img").click({ position: { x: 200, y: 150 } });
  await expect(scene.locator(".house-category-tabs")).toBeVisible();
  await scene.getByRole("button", { name: "Dölj husets kontroller" }).click();
  await expect(scene.locator(".house-category-tabs")).toBeHidden();
  await page.screenshot({ path: "/tmp/energihem-ipad-overview.png" });
});
