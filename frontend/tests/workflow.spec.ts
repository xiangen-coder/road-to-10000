import { expect, test } from "@playwright/test";

test("the running API computes a timestamped lunar analysis", async ({ request }) => {
  const response = await request.post("/api/analyze", {
    data: {
      name: "Shackleton vicinity",
      latitude: -89.54,
      longitude: 0,
      start: "2026-10-01T00:00:00Z",
      end: "2026-10-02T00:00:00Z",
      interval_minutes: 60,
      clearance_deg: 0,
    },
  });
  expect(response.ok()).toBe(true);
  const { series, metrics } = await response.json();
  expect(series).toHaveLength(25);
  expect(Date.parse(series[0].time)).toBe(Date.UTC(2026, 9, 1));
  expect(Date.parse(series.at(-1).time)).toBe(Date.UTC(2026, 9, 2));
  expect(metrics.sun_visible_pct).toBeGreaterThanOrEqual(0);
  expect(metrics.sun_visible_pct).toBeLessThanOrEqual(100);
});

test("Configure requires a centre and reports an oversized mission window", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-01T00:00:00Z"));
  await page.goto("/");
  const search = page.getByRole("form", { name: "Lunar landing search" });
  const submit = search.getByRole("button", { name: "Find landing point" });
  await expect(submit).toBeDisabled();
  await search.getByLabel("Centre name").selectOption({ label: "Shackleton vicinity" });
  await expect(submit).toBeEnabled();
  await search.getByLabel("End date", { exact: true }).fill("2026-12-01");
  await submit.click();
  await expect(search.getByRole("alert")).toContainText("up to 31 days and 400 intervals");
  await expect(search).toBeVisible();
});

test("mobile Configure accepts a preset and opens the mission archive", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const search = page.getByRole("form", { name: "Lunar landing search" });
  await search.getByLabel("Centre name").selectOption({ label: "de Gerlache vicinity" });
  await expect(search.getByRole("spinbutton", { name: "Latitude", exact: true })).toHaveValue("-88.48");
  await expect(search.getByRole("button", { name: "Find landing point" })).toBeEnabled();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByRole("menuitem", { name: /Lunar mission archive/ }).click();
  const archive = page.frameLocator('iframe[title="Lunar mission archive and interactive 3D paths"]');
  await expect(archive.getByRole("heading", { name: "Follow the path beyond Earth." })).toBeVisible();
});
