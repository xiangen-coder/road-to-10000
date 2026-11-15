import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { Mission } from "../app/types";
import type { Research } from "../components/LandingResearch";

test("three lunar sites with real ephemerides and report downloads", async ({ page }) => {
  test.skip(process.env.PLAYWRIGHT_REAL_MISSION_DATA !== "1", "Requires live Horizons access and the lunar research rasters.");
  test.setTimeout(120_000);
  await page.goto("/#search");
  const form = page.locator("#landing-search-form");
  await form.getByLabel("Centre name").selectOption({ label: "Shackleton vicinity" });
  await form.getByLabel("End date", { exact: true }).fill("2026-10-02");
  await form.getByText("Sampling & link settings").click();
  await form.getByLabel("Time step").selectOption("360");
  await form.getByLabel("Earth clearance (°)").fill("1");
  await page.getByRole("link", { name: "Compare", exact: true }).click();
  await page.getByRole("article", { name: "What IF" }).getByText("Change location", { exact: true }).click();
  const picker = page.locator("#choose-comparison-sites");
  for (const [name, latitude] of [["Shackleton backup A", "-89.52"], ["Shackleton backup B", "-89.50"]]) {
    await picker.getByLabel("Custom point").fill(name);
    await picker.getByLabel("Latitude", { exact: true }).fill(latitude);
    await picker.getByLabel("Longitude", { exact: true }).fill("0");
    await picker.getByRole("button", { name: "Add coordinates" }).click();
  }
  const baseline = page.getByLabel("Comparison baseline");
  await expect(baseline.locator("option")).toHaveCount(3, { timeout: 45000 });
  await baseline.selectOption({ label: "Shackleton vicinity" });
  for (const [button, extension] of [["Export research JSON", "json"], ["Export comparison CSV", "csv"]]) {
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: button }).click();
    const download = await pending;
    const content = await readFile(await download.path(), "utf8");
    if (extension === "json") {
      const result = JSON.parse(content) as { baseline: Mission; sites: { assessment: Research }[] };
      expect(result.baseline.name).toBe("Shackleton vicinity");
      const proof = result.sites.map(({ assessment: r }) => ({
        name: r.mission.name,
        geometry: r.geometry.available,
        points: r.geometry.series?.length,
        sun: r.geometry.metrics?.sun_visible_pct,
        earth: r.geometry.metrics?.earth_visible_pct,
        bothHours: r.geometry.metrics?.operational_windows?.reduce((total, w) => total + w.hours, 0),
        terrain: r.terrain.available,
        horizon: r.horizon.available,
        constraints: r.constraints_failed,
      }));
      console.log(JSON.stringify(proof));
      expect(proof.every(({ geometry, points }) => geometry && points === 5)).toBe(true);
      expect(proof[1].terrain).toBe(true);
      expect(proof.every(({ horizon }) => horizon)).toBe(true);
    } else {
      expect(content).toContain("Simultaneous visibility");
      expect(content).toContain("Shackleton vicinity");
    }
    await download.saveAs(`../outputs/lunar-research-report.${extension}`);
  }
  await page.evaluate(() => {
    document.querySelectorAll<HTMLDetailsElement>("#research-report details").forEach((item) => { item.open = true; });
  });
  await page.pdf({ path: "../outputs/lunar-research-report.pdf", format: "A4", printBackground: true });
  await page.getByRole("article", { name: "Pre-result 2: Shackleton backup A" }).getByRole("button", { name: "View assessment" }).click();
  const timeline = page.getByRole("slider", { name: "Mission time" });
  await timeline.fill("4");
  await expect(timeline).toHaveAttribute("aria-valuetext", /02 Oct/);
});
