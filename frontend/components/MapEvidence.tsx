"use client";

import { useState } from "react";
import type { Site } from "../app/types";
import { siteKey } from "./ComparisonPicker";
import TerrainAssessment from "./TerrainAssessment";

export default function MapEvidence({ location, onSelect, onAssess }: {
  location: Site;
  onSelect: (site: Site) => void;
  onAssess: () => void;
}) {
  const [layer, setLayer] = useState<"elevation" | "slope" | "imagery">("elevation");
  const [failedImage, setFailedImage] = useState("");
  const point = siteKey(location);
  return <section className="map-evidence" aria-label="Selected map point evidence">
    <div className="account-actions">
      <label>Evidence layer <select value={layer} onChange={(e) => setLayer(e.target.value as typeof layer)}>
        <option value="elevation">Elevation</option>
        <option value="slope">Footprint slope</option>
        <option value="imagery">LROC imagery</option>
      </select></label>
      <button className="button primary" onClick={onAssess}>Configure this location</button>
    </div>
    {layer !== "imagery" ? <TerrainAssessment location={location} onSelect={onSelect} fixedLayer={layer} /> : (
      <article className="panel map-imagery">
        <h3>LROC imagery near {location.name}</h3>
        {location.latitude > -85.5 ? <p>The south-pole imagery preview covers points at 85.5° S or farther south.</p>
          : failedImage === point ? <p role="status">LROC imagery is unavailable at this point. Try another location or open LROC QuickMap.</p>
            : <figure key={point}>
              {/* The same-origin proxy delivers a bounded NASA image; preserve its native coordinates. */}
              <img src={`/api/research/imagery?latitude=${location.latitude}&longitude=${location.longitude}&layer=nac&span_m=4000`}
                width={512} height={512} alt={`LROC south-pole imagery centred on ${location.name}`}
                onError={() => setFailedImage(point)} />
              <figcaption>NASA / GSFC / LROC · 4 km square · image preview resolution differs from the source mosaic.</figcaption>
            </figure>}
        <a className="text-button" href="https://quickmap.lroc.im-ldi.com/">Open LROC QuickMap</a>
      </article>
    )}
  </section>;
}
