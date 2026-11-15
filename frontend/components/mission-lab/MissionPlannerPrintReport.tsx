"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { formatCoordinates } from "../../lib/format-coordinates";
import { optionalLimits, powerFields, type Activity, type LabSource, type PowerInputs, type PowerKey, type PowerRun } from "../../lib/mission-power";

export type PlannerDraft = {
  brief: { name: string; objective: string; payload: string; notes: string };
  power: PowerInputs;
  activities: Activity[];
  reportNotes: string;
};

const utc = (value?: string) => value && Number.isFinite(Date.parse(value))
  ? new Date(value).toISOString().slice(0, 19).replace("T", " ") + " UTC"
  : "Unavailable";
const hours = (value: number) => value.toFixed(1) + " h";
const charge = (value: number) => value.toFixed(1) + "%";
const energy = (value: number, digits = 2) => value.toFixed(digits) + " kWh";
const firstBelow = (run: PowerRun) => run.firstBelow === null ? "Never" : hours(run.firstBelow);

function powerValue(power: PowerInputs, key: PowerKey) {
  const value = power[key].trim();
  return value ? value + " " + powerFields[key][1] : optionalLimits.includes(key) ? "Unlimited" : "Unavailable";
}

function Values({ rows, metrics = false }: { rows: [string, string][]; metrics?: boolean }) {
  return <dl className={metrics ? "planner-print-metrics" : "planner-print-values"}>{rows.map(([label, value]) =>
    <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
  )}</dl>;
}

function PowerFigure({ source, run, reserve }: { source: LabSource; run: PowerRun; reserve: number }) {
  const left = 60, right = 610, top = 28, bottom = 188;
  const peak = run.timeline.reduce((max, row) => Math.max(max, row.solar, row.demand), 0);
  const magnitude = peak ? 10 ** Math.floor(Math.log10(peak / 4)) : 1;
  const powerTick = ([1, 2, 2.5, 5, 10].find((step) => step * magnitude >= peak / 4) ?? 10) * magnitude;
  const wattsMax = 4 * powerTick;
  const x = (time: number) => left + (time - source.start) / (source.end - source.start) * (right - left);
  const y = (ratio: number) => bottom - ratio * (bottom - top);
  const timeline = run.timeline.map((row) => ({ ...row, x: x(Date.parse(row.time)) }));
  const series = [
    { key: "solar", max: wattsMax, label: "Solar generation", color: "#08786e" },
    { key: "demand", max: wattsMax, label: "Electrical demand", color: "#26384c", dash: "5 3" },
    { key: "charge", max: 100, label: "Battery charge", color: "#6842a3" },
  ] as const;
  return <figure className="planner-print-figure">
    <figcaption>Power, charge and visibility over the mission</figcaption>
    <svg viewBox="0 0 672 304" role="img" aria-label="Electrical power in watts, battery charge in percent, and Sun and Earth visibility over time">
      <defs><pattern id="planner-unknown" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="5" height="5" fill="#f7f8fa" /><path d="M0 0 V5" stroke="#536579" strokeWidth="2" />
      </pattern></defs>
      <text x={left} y="15">Electrical power (W)</text>
      <text x={right} y="15" textAnchor="end">Battery charge (%)</text>
      {[0, 1, 2, 3, 4].map((index) => <g key={index}>
        <path d={`M${left} ${y(index / 4)} H${right}`} stroke="#d6dee7" />
        <text x={left - 7} y={y(index / 4) + 4} textAnchor="end">{Number((index * powerTick).toPrecision(4))}</text>
        <text x={right + 7} y={y(index / 4) + 4}>{index * 25}%</text>
      </g>)}
      <path d={`M${left} ${y(reserve / 100)} H${right}`} stroke="#965414" strokeDasharray="2 4" />
      {series.map(({ key, max, color, ...line }) => (
        <path key={key} fill="none" stroke={color} strokeWidth="1.8" strokeDasharray={"dash" in line ? line.dash : undefined}
          d={timeline.map((row, index) => {
            const point = `${row.x.toFixed(2)} ${y(row[key] / max).toFixed(2)}`;
            return index === 0 ? "M" + point : key === "charge" ? "L" + point : `H${row.x.toFixed(2)} V${y(row[key] / max).toFixed(2)}`;
          }).join(" ")} />
      ))}
      {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
        const time = new Date(source.start + (source.end - source.start) * fraction);
        const label = time.toISOString().slice(5, 16).replace("T", " ");
        const xpos = x(time.getTime());
        return <g key={fraction}><path d={`M${xpos} ${bottom} v5`} stroke="#536579" />
          <text x={xpos} y="208" textAnchor="middle">{label}</text></g>;
      })}
      <text x={(left + right) / 2} y="225" textAnchor="middle">Mission time (UTC · MM-DD HH:MM)</text>
      {(["sunlight", "earth"] as const).map((key, lane) => {
        const rowY = 240 + lane * 35;
        return <g key={key}>
          <text x={left} y={rowY}>{key === "sunlight" ? "Sunlight" : "Earth-centre visibility"}</text>
          <rect x={left} y={rowY + 6} width={right - left} height="13" fill="#e7ebf1" />
          {timeline.slice(0, -1).map((row, index) => row[key] !== false &&
            <rect key={row.time} x={row.x} y={rowY + 6} width={timeline[index + 1].x - row.x} height="13"
              fill={row[key] === null ? "url(#planner-unknown)" : key === "sunlight" ? "#08786e" : "#315e92"} />)}
          <rect x={left} y={rowY + 6} width={right - left} height="13" fill="none" stroke="#8c9bad" />
        </g>;
      })}
    </svg>
    <ul className="planner-print-legend">
      {series.map(({ key, label }) => <li className={key} key={key}>{label}</li>)}
      <li className="reserve">Reserve threshold ({charge(reserve)})</li>
    </ul>
    <p>Visibility bands use colour for visible intervals, pale grey for intervals below the horizon, and hatching for missing evidence.</p>
  </figure>;
}

export default function MissionPlannerPrintReport({ source, draft, run, variant }: {
  source: LabSource;
  draft: PlannerDraft;
  run: PowerRun | null;
  variant: { power: PowerInputs; run: PowerRun } | null;
}) {
  const [generatedAt, setGeneratedAt] = useState("");
  const report = useRef<HTMLElement>(null);
  useEffect(() => {
    const stamp = () => {
      if (report.current && !report.current.closest("[hidden]")) {
        flushSync(() => setGeneratedAt(new Date().toISOString()));
      }
    };
    window.addEventListener("beforeprint", stamp);
    return () => window.removeEventListener("beforeprint", stamp);
  }, []);
  const { assessment, site, researchArea } = source;
  const brief: [string, string][] = [
    ["Mission objective", draft.brief.objective], ["Payload & equipment", draft.brief.payload],
    ["Mission notes", draft.brief.notes], ["Report notes", draft.reportNotes],
  ];
  const notes = brief.filter(([, value]) => value.trim());
  const warnings = [...new Set([...(assessment.warnings ?? []), ...(assessment.constraints_failed ?? [])])];
  const datasets = [
    assessment.terrain.source, assessment.horizon.source, assessment.observer_height?.source,
    assessment.temperature.source, assessment.hazards?.source, assessment.ice?.source,
    ...Object.values(assessment.factors ?? {}).map((factor) => factor.source),
  ].filter((data, index, all) => data && all.findIndex((item) => item?.name === data.name && item?.source_url === data.source_url) === index);
  const earthAvailable = assessment.geometry.series?.some((row) => typeof row.earth_visible === "boolean");
  const comparison = run && variant;
  return <article ref={report} className="planner-print-report" aria-label="Mission planning report">
    <header>
      <p className="planner-print-brand">Lunar Landing Site Navigator</p>
      <h1>Mission planning report</h1>
      <p className="planner-print-name">{draft.brief.name.trim() || "Unnamed mission"}</p>
      {generatedAt && <p>Generated {utc(generatedAt)}</p>}
    </header>
    <section>
      <h2>Mission overview</h2>
      <Values rows={[
        ["Research area", `${researchArea.name?.trim() || "Custom location"} · ${formatCoordinates(researchArea.latitude, researchArea.longitude)}`],
        ["Assessed landing point", `${site.name} · ${formatCoordinates(site.latitude, site.longitude)}`],
        ["Mission window", `${utc(site.start)} to ${utc(site.end)}`],
        ["Duration", hours((source.end - source.start) / 3600000)],
        ["Assessment timestamp", utc(source.assessedAt)],
        ["Sampling interval", `${site.interval_minutes} min`],
        ...(source.resultId ? [["Assessment ID", source.resultId] as [string, string]] : []),
        ...(source.coordinateMetadata.frame || source.coordinateMetadata.datum
          ? [["Coordinate frame / datum", [source.coordinateMetadata.frame, source.coordinateMetadata.datum].filter(Boolean).join(" · ")] as [string, string]] : []),
      ]} />
    </section>
    {notes.length > 0 && <section><h2>Mission brief</h2>
      {notes.map(([label, value]) => <div key={label}><h3>{label}</h3><p className="planner-print-note">{value}</p></div>)}
    </section>}
    <section>
      <h2>Lander and operating assumptions</h2>
      <table>
        <thead><tr><th scope="col">Equipment or assumption</th><th scope="col">Value</th></tr></thead>
        <tbody>{(Object.keys(powerFields) as PowerKey[]).map((key) => <tr key={key}>
          <th scope="row">{powerFields[key][0]}</th><td>{powerValue(draft.power, key)}</td>
        </tr>)}</tbody>
      </table>
      <h3>Daily operating schedule</h3>
      {draft.activities.length ? <>
        <p className="planner-print-table-intro">Activities repeat daily in UTC. Standby load applies outside these intervals.</p>
        <table><thead><tr><th scope="col">Activity</th><th scope="col">Start (UTC hour)</th><th scope="col">End (UTC hour)</th><th scope="col">Load (W)</th></tr></thead>
          <tbody>{[...draft.activities].sort((a, b) => a.start - b.start).map((activity, index) => <tr key={index}>
            <th scope="row">{activity.name}</th><td>{activity.start}</td><td>{activity.end}</td><td>{activity.watts}</td>
          </tr>)}</tbody></table>
      </> : <p>Standby load applies throughout the mission window.</p>}
    </section>
    <section>
      <h2>Power simulation</h2>
      {run ? <>
        <Values metrics rows={[
          ["Generated energy", energy(run.generated)], ["Minimum charge", charge(run.minimumPct)],
          ["First below reserve", firstBelow(run)], ["Time below reserve", hours(run.belowHours)],
          ["Unmet demand", energy(run.unmet, 3)],
        ]} />
        <p className="planner-print-outcome" data-warning={run.unmet > 1e-8 || run.belowHours > 0}>
          {run.unmet > 1e-8 ? "Demand exceeds available electrical supply." : run.belowHours > 0
            ? "Battery falls below reserve." : "Demand met and battery stays at or above reserve."}
          {run.unmet > 1e-8 && run.belowHours > 0 && " Battery also falls below reserve."}
        </p>
        <PowerFigure source={source} run={run} reserve={Number(draft.power.reserve)} />
      </> : <p>Power simulation has not been calculated.</p>}
    </section>
    {comparison && <section>
      <h2>Scenario comparison</h2>
      <p className="planner-print-table-intro">Both scenarios use the same site, mission window and operating schedule.</p>
      <table><thead><tr><th scope="col">Input or metric</th><th scope="col">Baseline</th><th scope="col">Variant</th></tr></thead>
        <tbody>
          {(Object.keys(powerFields) as PowerKey[]).filter((key) => draft.power[key] !== variant.power[key]).map((key) =>
            <tr key={key}><th scope="row">{powerFields[key][0]}</th><td>{powerValue(draft.power, key)}</td><td>{powerValue(variant.power, key)}</td></tr>)}
          {([
            ["Generated energy", (result) => energy(result.generated)],
            ["Minimum charge", (result) => charge(result.minimumPct)],
            ["First below reserve", firstBelow],
            ["Time below reserve", (result) => hours(result.belowHours)],
            ["Unmet demand", (result) => energy(result.unmet, 3)],
          ] satisfies [string, (result: PowerRun) => string][]).map(([label, format]) =>
            <tr key={label}><th scope="row">{label}</th><td>{format(run)}</td><td>{format(variant.run)}</td></tr>)}
        </tbody></table>
    </section>}
    <section>
      <h2>Sources, warnings and model limitations</h2>
      <h3>Assessment evidence</h3>
      <ul>
        <li>Sunlight timeline {source.complete ? "available" : "incomplete"}.</li>
        <li>Earth-centre visibility {earthAvailable ? "available for at least part of the window" : "unavailable"}.</li>
        <li>Terrain skyline {assessment.horizon.available ? "available" : "unavailable"}.</li>
        <li>Historical surface temperatures {assessment.temperature.available ? "available" : "unavailable"}.</li>
        {assessment.missing?.length > 0 && <li>Missing source factors: {assessment.missing.map((key) => assessment.factors?.[key]?.name || key).join(", ")}.</li>}
        {Object.entries(assessment.geometry.sources ?? {}).map(([body, metadata]) =>
          <li key={body}>{body === "sun" ? "Sun" : "Earth"} · {metadata.ephemeris} · {metadata.orientation}</li>)}
        {datasets.map((data, index) => data && <li key={index}>
          {data.source_url ? <a href={data.source_url}>{data.name || data.source_url}</a> : data.name || "Source dataset"}
          {data.observation_period && ` · ${data.observation_period}`}{data.quality && ` · ${data.quality}`}
        </li>)}
      </ul>
      {warnings.length > 0 && <><h3>Assessment warnings</h3><ul>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></>}
      <h3>Model assumptions and limitations</h3>
      <ul>
        <li>Sunlit power equals effective incident irradiance × panel area × panel efficiency × retained system fraction. Darkness produces zero solar power. The entered irradiance is already at the panel plane. Each visibility sample holds until the next timestamp.</li>
        <li>Battery charge and discharge apply efficiency and power limits at the electrical bus. Reserve is a reporting threshold. Earth-centre visibility describes geometry. The model excludes thermal behaviour, degradation and radio link performance.</li>
        {(assessment.limitations ?? []).map((item) => <li key={item}>{item}</li>)}
      </ul>
    </section>
  </article>;
}
