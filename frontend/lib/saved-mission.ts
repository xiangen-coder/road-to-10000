import type { Research } from "../components/LandingResearch";
import { validSolar, type SolarSettings } from "../components/mission-lab/scenario-science";
import { sameMission } from "./plan-b";
import { validRecord, type SearchRecord } from "./search-record";
import type { SearchLimitations } from "./research-area";

export type MissionSnapshot = {
  version: 1;
  assessment: Research;
  equipment: SolarSettings;
  searchLimitations?: SearchLimitations;
};

export function validSnapshot(value: unknown, record: SearchRecord): value is MissionSnapshot {
  if (!value || typeof value !== "object") return false;
  const { version, assessment, equipment, searchLimitations } = value as MissionSnapshot;
  const validSearchLimitations = searchLimitations === undefined || (
    !!searchLimitations && !!searchLimitations.counts &&
    [searchLimitations.sampled, searchLimitations.counts.focus_missing,
      searchLimitations.counts.evaluated, searchLimitations.counts.limits,
      searchLimitations.counts.missing, searchLimitations.counts.unavailable,
    ].every((count) => Number.isSafeInteger(count) && count >= 0) &&
    (searchLimitations.recommended === undefined || typeof searchLimitations.recommended === "boolean")
  );
  return version === 1 && validSearchLimitations && !!equipment && validSolar(equipment) && !!assessment &&
    validRecord({ ...record, mission: assessment.mission }) && sameMission(record.mission, assessment.mission) &&
    typeof assessment.geometry?.available === "boolean" &&
    typeof assessment.horizon?.available === "boolean" &&
    typeof assessment.terrain?.available === "boolean" &&
    Array.isArray(assessment.terrain.grid) &&
    typeof assessment.temperature?.available === "boolean" &&
    !!assessment.factors && typeof assessment.factors === "object" &&
    Array.isArray(assessment.missing) && Array.isArray(assessment.warnings) &&
    Array.isArray(assessment.constraints_failed) && Array.isArray(assessment.limitations);
}
