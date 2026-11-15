# Mission analysis and comparison

1. Use **More → Map explorer** to select a geographic reference or a custom coordinate. The evidence layer follows the selected point. Use **Configure this location** to keep that selection.
2. Under **Configure**, enter UTC start and end times. Set the sample cadence and Earth clearance under **Sampling & link settings**. Press **Go** to assess the primary site.
3. In **Compare**, add Connecting Ridge DEM centre and de Gerlache vicinity as alternatives. Additions start assessments automatically with the same dates, clearance, sampling and screening limits. Connecting Ridge is a terrain dataset reference point. The example sites are exploratory coordinates.
4. Open **Comparison and exports** to compare visibility, simultaneous hours, darkness, blackout, elevation, slope and evidence coverage. Expand the windows for UTC intervals. Use **More Info** for the sampled Sun and Earth timeline, its terrain thresholds and the separate terrain and spacecraft evidence.
5. Choose a preferred point for further study. Export the comparison as CSV or the detailed assessments as JSON. **Print or save PDF** opens the browser print dialog with the report and its expanded windows.

## Evidence and validation

- Horizons surface observer results use apparent airless body centres with a lunar mean-Earth observer. The legacy DE421/IAU_MOON workflow remains a separate geometric calculation. Source metadata and limitations are shown with the assessment.
- Elapsed intervals are weighted from their left endpoint. The last sample has zero duration. The selected cadence bounds transition timing, with one interval of uncertainty per boundary.
- The 5 m LOLA footprint crop measures slope, plane-detrended roughness and relief. The 20 m regional DEM supplies separate elevation and horizons sampled to 20 km. Incomplete footprints and horizons remain unavailable. The LROC image is visual context. Historical Diviner extrema supply a temperature-range proxy.
- A mission score requires both visibility factors. Where supported, the five-factor research score redistributes missing weights and remains provisional. Measured constraints are reported separately. The report only identifies a leading point when the sites share comparable evidence and pass the available terrain checks. Coverage, small score differences, unresolved hazards and model uncertainty still affect suitability.

On 11 November 2026 the Render API returned five samples per site for 1–2 October 2026 UTC at six-hour cadence and 1° Earth clearance. All three had 20 km horizon coverage. The selected 5 m footprint was available only at Connecting Ridge. The independent Horizons request used a start/stop interval with a six-hour step. Its Connecting Ridge Sun and Earth azimuth and elevation matched the app samples to the precision returned by Horizons. This checks request settings, epoch matching and parsing against the same upstream ephemeris. It does not quantify the observer or DEM model error.

| Exploratory point | Sun visibility | Earth visibility | Both visible | Footprint |
| --- | ---: | ---: | ---: | --- |
| Shackleton vicinity | 100% | 100% | 24 h | Outside the 5 m crop |
| Connecting Ridge DEM centre | 0% | 100% | 0 h | Available; maximum slope exceeds the default limit |
| de Gerlache vicinity | 0% | 0% | 0 h | Outside the 5 m crop |

These values describe the chosen window and sampling cadence. The LROC preview at Connecting Ridge returned a PNG on the live service.

The local production build was exercised through the same three-site workflow using the real research backend. The browser test checked five samples per site, three regional horizons, the Connecting Ridge footprint, both downloads and the Result timeline. It selected Shackleton for further study because it had the longest simultaneous visibility in this window. A local footprint assessment is still needed there.

To repeat the real-data browser check, start the frontend and backend with the configured research rasters. Set `PLAYWRIGHT_BASE_URL` to the running frontend, set `PLAYWRIGHT_REAL_MISSION_DATA=1`, and run `npx playwright test tests/mission-data-smoke.spec.ts` from `frontend`. The test saves PDF, CSV and JSON reports under `outputs/`.

Local validation passed 111 backend tests, TypeScript, ESLint, the production build, and all 11 Playwright tests with real-data verification enabled. The Render checks above exercised the existing deployment. The new interface was tested on the local production build.

## Files

| Area | Files and responsibility |
| --- | --- |
| Navigation and site selection | `frontend/app/page.tsx`, `frontend/components/MapEvidence.tsx`, `TerrainAssessment.tsx`, `LandingResearch.tsx` connect map selection and saved points to research. |
| Results and reports | `frontend/components/ResearchOverview.tsx`, `PreliminaryComparison.tsx`, `ResearchComparisonReport.tsx` display the synchronized timeline, windows, comparison and exports. |
| Styles | `frontend/app/layout.tsx`, `research-workflow.css` load responsive comparison and print styles. |
| Scoring | `backend/app/landing_research.py`, `backend/tests/test_landing_research.py` withhold mission scores when either visibility factor is unavailable. |
| Checks | `frontend/eslint.config.mjs` excludes vendored Three.js code. `frontend/public/mission-archive/viewer.mjs` removes unused bindings. `frontend/playwright.config.ts` supports a running test server. `workflow.spec.ts` and `additions.spec.ts` follow the current routes. `research-workflow.spec.ts` tests shared settings and report controls. `mission-data-smoke.spec.ts` exercises the opt-in real-data workflow. |
| Documentation | `README.md` links to this walkthrough and the current data sources. |

## Remaining priorities

1. Expand validated footprint coverage and register numeric hazard and ice products. Preserve the regional and footprint evidence distinction.
2. Validate DEM-to-observer alignment and quantify horizon and sampling uncertainty for individual mission sites. Model local obstructions, power and communications separately for mission use.
3. Add independently validated official region geometries, more terrain cross-sections and wider map imagery coverage as source data permits.
