import type { Mission } from "../app/types";
import type { Research } from "../components/LandingResearch";
import type { ResearchPriority } from "../components/SearchConsole";
import type { Site } from "../app/types";
import { sameMission, type PlanBForecast } from "./plan-b";

export function comparisonEntries(mission: Mission, alternatives: Site[], scenarios: PlanBForecast[], results: Research[] = []) {
  const planned = [mission, ...alternatives.map((site) => ({ ...mission, ...site }))];
  return [
    ...planned.map((site) => ({
      site,
      scenario: undefined,
      assessment: results.find((result) => sameMission(result.mission, site)),
    })),
    ...scenarios.filter(({ result }) => !planned.some((site) => sameMission(site, result.mission)))
      .map((scenario) => ({ site: scenario.result.mission, scenario, assessment: scenario.result })),
  ];
}

export type ResearchArea = {
  centre: Mission;
  radiusKm: number;
  focus: ResearchPriority;
  limits?: Record<string, number>;
};

export type ResearchAreaResult = {
  results: Research[];
  recommended?: boolean;
  sampled: number;
  sampling?: { radii_m: number[]; points_per_ring: number };
  reasons: string[];
  counts: { evaluated: number; limits: number; missing: number; unavailable: number; focus_missing: number };
};
