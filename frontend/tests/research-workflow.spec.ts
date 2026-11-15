import { expect, test } from "@playwright/test";
import type { Mission } from "../app/types";

test("adding three research sites shares the mission settings and exports their evidence", async ({ page }) => {
  const requests: Mission[] = [];
  const user = { id: "test-user", username: "Explorer", email: "test@example.com" };
  let sessionChecks = 0;
  await page.route("**/api/account", (route) => {
    if (route.request().method() === "POST") return route.fulfill({ json: { user, message: "Signed in." } });
    sessionChecks++;
    return route.fulfill({ json: { user: null } });
  });
  await page.route("**/api/account/history", (route) => route.fulfill({ json: { records: [] } }));
  // Test-only response fixture. Real Horizons and raster calculations are tested in the backend.
  await page.route(/\/api\/research\/(evaluate|research-area)$/, async (route) => {
    const { mission } = route.request().postDataJSON() as { mission: Mission };
    requests.push(mission);
    const span = { start: mission.start, end: mission.end, hours: 24 };
    const factors = Object.fromEntries([
      ["T", "Terrain safety", null], ["S", "Sunlight availability", 100],
      ["C", "Earth-centre visibility", 100], ["H", "Temperature", null], ["I", "Water-ice potential", null],
    ].map(([key, name, score]) => [String(key), {
      name, score, quality: "Test fixture", explanation: "Test fixture",
      weight: 0, effective_weight: 0, contribution: null,
    }]));
    const assessment = {
      mission, factors, score: 100, provisional: true, available_weight: 0.45,
      missing: ["T", "H", "I"], warnings: [
        "Boulder and crater mapping is incomplete.",
        ...(mission.name === "Shackleton backup B" ? ["Local terrain coverage ends near this site."] : []),
      ], limitations: ["Fixture for UI regression testing"],
      constraints_failed: [], safety_status: "not_established",
      terrain: { available: false, grid: [] }, horizon: { available: false, reason: "Fixture has no DEM" },
      temperature: { available: false },
      geometry: {
        available: true, mode: "reference_geometry_only",
        sunlight_windows: [span], earth_windows: [span], sunlight_hours: 24,
        metrics: { sun_visible_pct: 100, earth_visible_pct: 100, simultaneous_pct: 100,
          operational_windows: [span], darkness_windows: [], blackout_windows: [],
          longest_darkness_hours: 0, longest_blackout_hours: 0 },
        series: [mission.start, mission.end].map((time) => ({
          time, sun_azimuth: 12, sun_elevation: 3, earth_azimuth: 45, earth_elevation: 6,
          sun_visible: true, earth_visible: true, simultaneous: true,
        })),
      },
    };
    const areaSearch = route.request().url().endsWith("/research-area");
    await route.fulfill({ json: areaSearch ? {
      results: [assessment], recommended: true, sampled: 4, reasons: [],
      counts: { evaluated: 2, limits: 1, missing: 1, unavailable: 1, focus_missing: 0 },
    } : assessment });
  });
  await page.goto("/#search");
  await page.getByRole("banner").getByRole("button", { name: "Login", exact: true }).click();
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("test-password");
  await page.locator(".lunar-auth-form").getByRole("button", { name: "Login", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Saved results" })).toBeVisible();
  const checksAfterLogin = sessionChecks;
  await page.getByRole("link", { name: "Configure", exact: true }).click();
  await page.locator("#landing-search-form").getByLabel("Centre name").selectOption({ label: "Shackleton vicinity" });
  await page.locator("#landing-search-form").getByLabel("Start date", { exact: true }).fill("2026-10-01");
  await page.locator("#landing-search-form").getByLabel("End date", { exact: true }).fill("2026-10-02");
  await page.locator("#landing-search-form").getByLabel("Start time (UTC)", { exact: true }).fill("00:00");
  await page.locator("#landing-search-form").getByLabel("End time (UTC)", { exact: true }).fill("00:00");
  await page.getByRole("button", { name: "Find landing point", exact: true }).click();
  await expect(page).toHaveURL(/#pre-results$/);
  await expect(page.getByText("Search limitations", { exact: true })).toHaveCount(0);
  await page.getByRole("article", { name: "What IF" }).getByText("Change location", { exact: true }).click();
  await page.getByText("Custom coordinates and terrain suggestions", { exact: true }).click();
  const picker = page.locator("#choose-comparison-sites");
  const addPoint = async (name: string, latitude: string, longitude: string) => {
    await picker.getByLabel("Custom point").fill(name);
    await picker.getByLabel("Latitude", { exact: true }).fill(latitude);
    await picker.getByLabel("Longitude", { exact: true }).fill(longitude);
    await picker.getByRole("button", { name: "Add coordinates" }).click();
  };
  await addPoint("Distant point", "-11", "-11");
  await expect(picker.getByRole("alert")).toContainText("within 20 km");
  expect(requests).toHaveLength(1);
  await addPoint("Shackleton backup A", "-89.52", "0");
  const table = page.getByRole("table", { name: "Side-by-side research comparison" });
  await expect(table.getByRole("row", { name: /Simultaneous visibility/ })).toContainText("24.0 h");
  await expect(table.getByRole("row", { name: /Simultaneous visibility/ }).getByRole("cell", { name: "24.0 h" })).toHaveCount(2);
  await addPoint("Shackleton backup B", "-89.50", "0");
  await expect(table.getByRole("row", { name: /Simultaneous visibility/ }).getByRole("cell", { name: "24.0 h" })).toHaveCount(3);
  expect(requests).toHaveLength(3);
  for (const mission of requests) {
    expect(mission).toMatchObject({
      start: "2026-10-01T00:00:00Z", end: "2026-10-02T00:00:00Z",
      interval_minutes: 60, clearance_deg: 0,
    });
  }
  await expect(table.getByRole("row", { name: /Longest Earth-centre visibility gap/ }).getByRole("cell", { name: "0.0 h" })).toHaveCount(3);
  const evidence = page.getByRole("region", { name: /Mission evidence/ });
  await expect(evidence).toContainText("Shackleton vicinity");
  await evidence.getByLabel("Site to inspect").selectOption({ label: "Shackleton backup B" });
  await expect(evidence).toContainText("Shackleton backup B");
  await expect(evidence.getByRole("region", { name: "Estimated solar generation" })).toContainText("Average power");
  await expect(page.getByLabel("Preferred point for further study")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Questions for further study" })).toHaveCount(0);
  await page.getByLabel("Comparison baseline").selectOption({ label: "Shackleton backup A" });
  const report = page.locator("#research-report");
  await expect(report.getByText("Boulder and crater mapping is incomplete.", { exact: true })).toHaveCount(1);
  const terrainCards = report.locator(".report-terrain-values");
  await expect(terrainCards).toHaveCount(3);
  await expect(terrainCards.first()).toContainText("45.0%");
  await expect(terrainCards.first()).toContainText("Terrain safety, Temperature, Water-ice potential");
  await expect(report.locator(".report-option").filter({ has: page.getByRole("heading", { name: "Shackleton backup B", exact: true, level: 4 }) }))
    .toContainText("Local terrain coverage ends near this site.");
  await expect(report.getByRole("heading", { name: "Shackleton backup A · Baseline" })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 850 });
  await expect.poll(() => table.evaluate((element) => {
    const scroller = element.parentElement!;
    return scroller.scrollWidth > scroller.clientWidth;
  })).toBe(true);
  await page.setViewportSize({ width: 1280, height: 900 });
  await report.getByText("Export", { exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export research JSON" }).click();
  expect((await download).suggestedFilename()).toBe("lunar-research-report.json");
  const csvDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export comparison CSV" }).click();
  expect((await csvDownload).suggestedFilename()).toBe("lunar-research-report.csv");
  await page.emulateMedia({ media: "print" });
  await expect(terrainCards.last()).toBeVisible();
  await expect(table).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeHidden();
  await page.emulateMedia({ media: "screen" });
  await report.getByRole("article").filter({ has: page.getByRole("heading", { name: "Shackleton backup A · Baseline" }) }).getByRole("button", { name: /View assessment/ }).click();
  const limitations = page.locator("#result-methods article").filter({ hasText: "Search limitations" });
  await expect(limitations).toContainText("2 of 4 sampled points returned a score.");
  await expect(limitations).toContainText("1 scored points exceeded configured limits.");
  await expect(limitations).toContainText("Points checked without a score: 1.");
  await expect(limitations).toContainText("Points skipped after the search reached its time limit: 1.");
  await expect(limitations).toContainText("Unscored points could rank higher");
  const slider = page.getByRole("slider", { name: "Mission time" });
  await slider.fill("1");
  await expect(slider).toHaveAttribute("aria-valuetext", /02 Oct/);
  await page.getByRole("button", { name: "Reset timeline" }).click();
  await expect(slider).toHaveValue("0");
  await page.getByRole("navigation", { name: "Results sections" }).getByRole("link", { name: "Visibility" }).click();
  await expect(page.locator("#result-visibility").getByRole("img", { name: /Sun and Earth elevations/ })).toHaveAccessibleDescription(/Gold is the Sun and blue is Earth.*Local terrain coverage is unavailable/);
  const series = page.getByRole("group", { name: "Graph series" });
  await series.getByRole("button", { name: "Sun elevation", exact: true }).click();
  await expect(page.locator("#result-visibility .research-elevation-chart .recharts-line-curve")).toHaveCount(1);
  await series.getByRole("button", { name: "Show all curves" }).click();
  await expect(page.locator("#result-visibility .research-elevation-chart .recharts-line-curve")).toHaveCount(2);
  await expect(page.getByRole("region", { name: "Estimated solar generation" })).toContainText("29.4 kWh");
  await page.getByRole("button", { name: "Back to comparison" }).click();
  await expect(page).toHaveURL(/#pre-results$/);
  await expect(table).toBeVisible();
  await page.getByRole("link", { name: "Assessment", exact: true }).click();
  await page.getByRole("button", { name: "More", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: /3D observatory/ })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Mission Planner", exact: true })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: /^(Mission report|Horizon simulator|Terrain analysis|Site comparison)\b/i })).toHaveCount(0);
  await page.evaluate(() => { window.location.hash = "mission-report"; });
  await expect(page).toHaveURL(/#pre-results$/);
  await expect(table).toBeVisible();
  expect(requests).toHaveLength(3);
  await page.evaluate(() => {
    const observer = new MutationObserver(() => {
      if (document.querySelector(".lunar-auth")) document.body.dataset.loginFlashed = "true";
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
  await page.getByRole("button", { name: "Hi, Explorer" }).click();
  await page.getByRole("button", { name: "Account & saved missions" }).click();
  await expect(page.getByRole("heading", { name: "Saved results" })).toBeVisible();
  await expect(page.locator(".lunar-auth")).toHaveCount(0);
  expect(await page.locator("body").getAttribute("data-login-flashed")).toBeNull();
  expect(sessionChecks).toBe(checksAfterLogin);
});

test("Education shows the supplied Moon Landing 101 experience on mobile", async ({ page }) => {
  await page.route("**/api/account", (route) => route.fulfill({ json: { user: null } }));
  await page.setViewportSize({ width: 390, height: 850 });
  await page.goto("/#education");
  const classroom = page.getByRole("region", { name: "Moon Landing 101 learning experience" });
  await expect(classroom.getByRole("heading", { name: /MoonMoonBird/ })).toBeVisible();
  await expect(classroom.getByRole("heading", { name: "The landing factors" })).toBeVisible();
  await expect(classroom.getByRole("heading", { name: "Landing Commander Challenge" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Result tools", exact: true })).toHaveCount(0);
  const educationNav = page.getByRole("navigation", { name: "Education navigation" });
  await expect(educationNav.getByRole("link")).toHaveText(["Explore", "Experiments", "Landing Challenge", "Quiz"]);
  await educationNav.getByRole("link", { name: "Quiz" }).click();
  const quiz = classroom.getByRole("heading", { name: "Moon Mission Quiz" });
  await expect(quiz).toBeFocused();
  await expect(quiz).toBeInViewport();
  await page.locator(".lunar-topbar").getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).toHaveURL(/#account$/);
  await page.getByRole("group", { name: "Experience mode" }).getByRole("button", { name: "Education" }).click();
  await expect(educationNav).toBeVisible();
  await page.getByRole("group", { name: "Experience mode" }).getByRole("button", { name: "Professional" }).click();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  await expect(classroom).toBeHidden();
});

test("Configure offers three references and carries a custom map point back", async ({ page }) => {
  await page.route("**/api/sites?include_missions=true", (route) => route.fulfill({ json: [
    { id: "apollo-11", name: "Apollo 11", site_name: "Mare Tranquillitatis", latitude: 0.674, longitude: 23.473,
      status: "Successful soft landing", event_date: "1969-07-20", classification: "soft_landing",
      coordinate_note: "Published coordinates.", source_url: "https://nssdc.gsfc.nasa.gov/planetary/lunar/apolloland.html" },
    { id: "artemis-iv", name: "Artemis IV", site_name: "Lunar south pole", latitude: null, longitude: null,
      classification: "approximate_target_region" },
  ] }));
  await page.goto("/#search");
  const form = page.locator("#landing-search-form");
  const locations = form.getByRole("combobox", { name: "Centre name" });
  await expect(locations.locator("option")).toHaveText(["Shackleton vicinity", "de Gerlache vicinity", "Connecting Ridge DEM centre",
    "Apollo 11 · Mare Tranquillitatis", "Artemis IV · Lunar south pole", "Custom location"]);
  await expect(locations.locator('option[value="artemis-iv"]')).toHaveJSProperty("disabled", true);
  await locations.selectOption({ label: "Apollo 11 · Mare Tranquillitatis" });
  await expect(form.getByLabel("Longitude", { exact: true })).toHaveValue("23.473");
  await expect(form.getByRole("link", { name: "Mission source" })).toBeVisible();
  await expect(form.getByRole("combobox", { name: "Research focus" })).toHaveValue("overall");
  await locations.selectOption({ label: "Connecting Ridge DEM centre" });
  await expect(form.getByRole("spinbutton", { name: "Longitude" })).toHaveValue("-137.489552922");
  const atlas = page.frameLocator('iframe[title="Lunar Atlas 3D globe and 2D map"]');
  const globe = atlas.getByRole("button", { name: "3D globe" });
  await expect(globe).toBeEnabled();
  await atlas.getByRole("button", { name: "2D map" }).click();
  await form.getByRole("button", { name: "Choose on map" }).click();
  await expect(page).toHaveURL(/#search$/);
  await expect(globe).toHaveAttribute("aria-pressed", "true");
  const surface = atlas.locator("#overlay");
  await surface.press("ArrowRight");
  await surface.press("Enter");
  await expect(locations).toHaveValue("custom");
  await expect(form.getByLabel("Custom location name")).toHaveValue("Custom location");
  await expect(form.getByRole("spinbutton", { name: "Longitude" })).not.toHaveValue("-137.489552922");
  const longitude = Number(await form.getByRole("spinbutton", { name: "Longitude" }).inputValue());
  await page.route("**/api/research/research-area-shadow?*", (route) => {
    const radius = new URL(route.request().url()).searchParams.get("radius_m");
    const fraction = radius === "5000" ? null : radius === "10000" ? 0 : radius === "15000" ? 0.0001 : 0.125;
    return route.fulfill({ json: { shadow_fraction: fraction, coverage_fraction: fraction == null ? 0 : 0.75 } });
  });
  await form.getByRole("combobox", { name: "Research focus" }).selectOption("I");
  const radiusInput = form.getByRole("spinbutton", { name: "Search radius (km)" });
  const shadow = form.locator('.research-shadow-note[role="status"]');
  const cases = [
    ["5", "Unavailable", "No mapped data is available here, so this indicator cannot assess water-ice potential.", "rgb(252, 165, 165)"],
    ["10", "0.0%", "No permanent shadow is mapped here. This does not rule out the presence of water ice.", "rgb(252, 211, 77)"],
    ["15", "0.0%", "Permanent shadow may help preserve water ice, but does not confirm its presence.", "rgb(134, 239, 172)"],
    ["20", "12.5%", "Permanent shadow may help preserve water ice, but does not confirm its presence.", "rgb(134, 239, 172)"],
  ];
  for (const [radius, percentage, reason, color] of cases) {
    await radiusInput.fill(radius);
    await expect(shadow).toContainText(`Mapped permanent shadow within ${radius} km: ${percentage}`);
    await expect(shadow).toHaveCSS("color", color);
    await expect(shadow.locator("small")).toHaveText(reason);
    await expect(shadow.locator("small")).toHaveCSS("color", color);
  }
  await page.route("**/api/research/research-area", (route) => route.fulfill({ json: {
    results: [], sampled: 17, counts: { evaluated: 0, limits: 0, missing: 17, unavailable: 0, focus_missing: 0 }, reasons: [],
  } }));
  const request = page.waitForRequest((item) => item.url().endsWith("/api/research/research-area"));
  await form.getByRole("button", { name: "Find landing point", exact: true }).click();
  expect((await request).postDataJSON()).toMatchObject({ mission: { name: "Custom location", longitude }, radius_m: 20000, focus: "I" });
  await expect(page.locator(".research-centre-summary")).toContainText("20 km");
  await expect(page.getByText("No qualifying landing point found in this research area.")).toBeVisible();
});

test("header account dropdown supports saved searches and logout on desktop and mobile", async ({ page }) => {
  let signedIn = true;
  let shouldFail = true;
  let pendingSession: Promise<void> | undefined;
  await page.addInitScript(() => {
    const start = "2026-10-01T00:00:00Z";
    const end = "2026-10-01T01:00:00Z";
    const mission = { name: "Test ridge", latitude: -89, longitude: 0, start, end, interval_minutes: 60, clearance_deg: 0 };
    const key = JSON.stringify([-89, 0, start, end, 60, 0, null, null, null, null, null]);
    localStorage.setItem("lunar-power-lab:v1:" + key + ":report", JSON.stringify({
      source: { assessment: { mission, terrain: {}, horizon: {}, geometry: {
        available: true, series: [{ time: start, sun_visible: true }, { time: end, sun_visible: true }],
      } } },
      setup: { power: {}, brief: { name: "Saved power report" } },
      simulation: {},
    }));
  });
  await page.route("**/api/account", async (route) => {
    if (route.request().method() === "POST") {
      expect(route.request().postDataJSON()).toEqual({ action: "logout" });
      if (shouldFail) return route.fulfill({ status: 502, json: { error: "Could not sign out. Please retry." } });
      signedIn = false;
      return route.fulfill({ json: { ok: true } });
    }
    await pendingSession;
    return route.fulfill({ json: { configured: true, user: signedIn ? { username: "Xiang En Lunar Navigator", email: "test@example.com" } : null } });
  });
  await page.route("**/api/account/history", (route) => route.fulfill({ json: { records: [] } }));
  await page.goto("/#search");
  const header = page.getByRole("banner");
  const account = header.getByRole("button", { name: "Hi, Xiang En Lunar Navigator" });
  const settings = header.getByRole("button", { name: "Open settings" });
  async function expectAccountAndSettingsGap() {
    const accountBounds = await account.boundingBox();
    const settingsBounds = await settings.boundingBox();
    expect(settingsBounds!.x - (accountBounds!.x + accountBounds!.width), `Account and Settings gap at ${page.viewportSize()?.width}px`)
      .toBeGreaterThanOrEqual(6);
    expect(settingsBounds!.x + settingsBounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  }
  for (const width of [1900, 1440, 1101]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(account).toBeVisible();
    await expectAccountAndSettingsGap();
  }
  await settings.click();
  await expect(page.getByRole("dialog", { name: "Make it your own." })).toBeVisible();
  await page.getByRole("button", { name: "Close settings" }).click();
  const saved = header.getByRole("button", { name: "Account & saved missions" });
  await account.click();
  await expect(account).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Tab");
  await expect(saved).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(account).toBeFocused();
  await expect(saved).toBeHidden();
  await account.click();
  let releaseSession!: () => void;
  pendingSession = new Promise<void>((resolve) => { releaseSession = resolve; });
  try {
    await saved.click();
    await expect(page.getByRole("heading", { name: "Saved results" })).toBeVisible();
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("status").filter({ hasText: "Connecting to your account" })).toBeVisible();
    await expect(page.locator("form").getByLabel("Password", { exact: true })).toHaveCount(0);
  } finally {
    releaseSession();
    pendingSession = undefined;
  }
  await expect(page).toHaveURL(/#account$/);
  const results = page.getByRole("region", { name: "Saved results" });
  const reports = page.getByRole("region", { name: "Saved mission reports" });
  const session = page.getByRole("region", { name: "Signed-in account" });
  await expect(results).toContainText("No saved results yet.");
  await expect(session).toContainText("Signed in as test@example.com");
  await expect(session.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
  await expect(reports.getByRole("button", { name: "Open report" })).toBeVisible();
  await reports.getByRole("button", { name: "Delete report Saved power report" }).click();
  await expect(reports).toContainText("No mission reports saved on this device yet.");
  expect(await page.evaluate(() => Object.keys(localStorage).some((key) => key.endsWith(":report")))).toBe(false);
  await page.setViewportSize({ width: 320, height: 780 });
  await header.getByRole("button", { name: "Education", exact: true }).click();
  await expectAccountAndSettingsGap();
  await account.click();
  const logout = header.getByRole("button", { name: "Log out" });
  const bounds = await logout.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  await page.locator("main").click({ position: { x: 5, y: 5 } });
  await expect(logout).toBeHidden();
  await account.click();
  await logout.click();
  await expect(header.getByRole("alert")).toContainText("Could not sign out");
  await expect(account).toBeVisible();
  shouldFail = false;
  await logout.click();
  await expect(header.getByRole("button", { name: "Login" })).toBeVisible();
  await expect(logout).toBeHidden();
  await header.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/#account$/);
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
});
