"use client";
import { useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Search,
  Layers3,
  MapPin,
  BookOpen,
  Globe2,
  Orbit,
  FlaskConical,
  Clock3,
  ShieldCheck,
  ExternalLink,
  Check,
  Eye,
  Box,
  FileText,
} from "lucide-react";
import PlanetScene from "./planet-scene";
import {
  datasets,
  planetaryMetrics,
  type PlanetaryBody,
  type Dataset,
} from "../lib/planetary/manifest";
import type { ResearchRun } from "../lib/science/types";
import { PageHeading, Modal, Status } from "./sozo-ui";
const metrics = planetaryMetrics();
export function MissionOverview({
  runs,
  onExplore,
  onResearch,
  onOpen,
  onCatalog,
}: {
  runs: ResearchRun[];
  onExplore: (b: PlanetaryBody) => void;
  onResearch: (q: string) => void;
  onOpen: (r: ResearchRun) => void;
  onCatalog: () => void;
}) {
  return (
    <div className="mission-overview">
      <div className="mission-page-label">
        <span>
          <i />
          MISSION CONTROL
        </span>
        <span>MOON + MARS / YOUR RESEARCH WORKSPACE</span>
      </div>
      <div className="mission-welcome">
        <div>
          <h1>
            A universe of questions.
            <br />
            <span>Your next discovery.</span>
          </h1>
          <p>
            Explore the worlds. Follow the evidence. Keep the science connected.
          </p>
          <button className="primary-button" onClick={() => onResearch("")}>
            <FlaskConical size={15} />
            Start an investigation
            <ArrowUpRight size={15} />
          </button>
        </div>
        <div className="welcome-globes">
          <PlanetScene duo />
        </div>
      </div>
      <div className="mission-summary">
        <div>
          <span>YOUR RESEARCH</span>
          <strong>
            {runs.length.toString().padStart(2, "0")}
            <small>saved investigations</small>
          </strong>
        </div>
        <div>
          <span>YOUR EVIDENCE</span>
          <strong>
            {new Set(
              runs.flatMap(
                (r) => r.result?.citations.map((s) => s.doi || s.url) || [],
              ),
            ).size
              .toString()
              .padStart(2, "0")}
            <small>unique publications</small>
          </strong>
        </div>
        <div>
          <span>TWO WORLDS / PROJECT-REPORTED</span>
          <strong>
            ≈{(metrics.combinedPrimaryCells / 1e6).toFixed(2)}
            <small>million primary terrain cells</small>
          </strong>
        </div>
      </div>
      <div className="mission-section-head">
        <h2>Choose your frontier</h2>
        <button onClick={onCatalog}>
          View the dataset catalog
          <ArrowRight size={14} />
        </button>
      </div>
      <div className="mission-worlds">
        {(["moon", "mars"] as const).map((body) => (
          <button
            key={body}
            className={`mission-world ${body}`}
            onClick={() => onExplore(body)}
          >
            <div className="mission-world-orb">
              <div className={`world-sphere ${body}`} />
            </div>
            <div className="mission-world-info">
              <span className="space-eyebrow">
                {body === "moon"
                  ? "01 / LUNAR WORKSPACE"
                  : "02 / MARTIAN WORKSPACES"}
              </span>
              <h3>
                {body === "moon" ? "The Moon" : "Mars"}
                <ArrowUpRight size={24} />
              </h3>
              <p>
                {body === "moon"
                  ? "Trace the light. Explore the south pole."
                  : "Jezero. Gale. A planet full of evidence."}
              </p>
              <div>
                <span>
                  <strong>
                    ≈{metrics.bodies[body].areaKm2.toLocaleString("en-US")}
                    <small>km²</small>
                  </strong>
                  reported workspace
                </span>
                <span>
                  <strong>
                    {metrics.bodies[body].gridMeters}
                    <small>m</small>
                  </strong>
                  primary grid
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
      <div className="mission-research-layout">
        <section>
          <div className="mission-section-head">
            <h2>Let curiosity lead</h2>
            <span>SOZO / SCIENTIFIC RESEARCH</span>
          </div>
          {[
            "Lunar south-pole illumination and permanently shadowed regions",
            "Jezero Crater geology and evidence of past water",
            "Terrain slope constraints for Mars rover route planning",
          ].map((q, i) => (
            <button
              className="mission-prompt"
              key={q}
              onClick={() => onResearch(q)}
            >
              <span>0{i + 1}</span>
              <p>{q}</p>
              <ArrowUpRight size={15} />
            </button>
          ))}
        </section>
        <section className="mission-activity">
          <div className="mission-section-head">
            <h2>Recent investigations</h2>
            <Clock3 size={14} />
          </div>
          {runs.length ? (
            runs.slice(0, 3).map((r) => (
              <button key={r.id} onClick={() => onOpen(r)}>
                <span className="activity-icon">
                  <FlaskConical size={15} />
                </span>
                <div>
                  <strong>{r.question}</strong>
                  <Status status={r.status} />
                </div>
                <ArrowUpRight size={14} />
              </button>
            ))
          ) : (
            <div className="mission-activity-empty">
              <Orbit size={31} strokeWidth={1} />
              <h3>A new perspective starts here.</h3>
              <p>
                Your investigations and source-backed records will appear as you
                explore.
              </p>
            </div>
          )}
        </section>
      </div>
      <div className="mission-source-note">
        <ShieldCheck size={15} />
        <p>
          The globe is a visualization. MOMAR coverage figures are
          project-reported; SOZO’s saved research and source counts above come
          from your actual workspace.
        </p>
      </div>
    </div>
  );
}
export function PlanetaryExplorer({
  body,
  onResearch,
}: {
  body: PlanetaryBody;
  onResearch: (q: string) => void;
}) {
  const [wireframe, setWireframe] = useState(false);
  const [region, setRegion] = useState<string>(metrics.bodies[body].regions[0]);
  const data = metrics.bodies[body];
  return (
    <div className="planetary-explorer">
      <PageHeading
        eyebrow={
          body === "moon" ? "01 / LUNAR EXPLORER" : "02 / MARTIAN EXPLORER"
        }
        title={
          body === "moon" ? "The nearest frontier." : "A world of possibility."
        }
        description={
          body === "moon"
            ? "Investigate the south pole. Connect the light, terrain, and evidence."
            : "Explore Jezero and Gale. Connect planetary context with scientific research."
        }
      >
        <a
          className="secondary-button"
          href={data.url}
          target="_blank"
          rel="noreferrer"
        >
          Open MOMAR prototype
          <ArrowUpRight size={14} />
        </a>
      </PageHeading>
      <div className="explorer-layout">
        <div className="explorer-stage">
          <div className="explorer-stage-top">
            <span>
              <i />
              {body === "moon" ? "MOON" : "MARS"} / GLOBAL VISUALIZATION
            </span>
            <span>3D SURFACE VIEW</span>
          </div>
          <PlanetScene
            key={body}
            body={body}
            interactive
            wireframe={wireframe}
          />
          <div className="explorer-place-label">
            <span>FOCUS OF INVESTIGATION</span>
            <h2>{region}</h2>
            <p>{data.extent}</p>
          </div>
        </div>
        <aside className="explorer-panel">
          <span className="space-eyebrow">
            <Layers3 size={12} />
            EXPLORER CONTROLS
          </span>
          <label htmlFor="explorer-region">Research region</label>
          <select
            id="explorer-region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          >
            {data.regions.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <h3>View layers</h3>
          <div className="explorer-layer">
            <span>
              <Eye size={15} />
              NASA source imagery
            </span>
            <Check size={14} />
          </div>
          <label className="explorer-layer">
            <span>
              <Box size={15} />
              Visualization wireframe
            </span>
            <input
              type="checkbox"
              checked={wireframe}
              onChange={(e) => setWireframe(e.target.checked)}
            />
          </label>
          <div className="explorer-data-note">
            <ShieldCheck size={16} />
            <p>
              Global imagery, not a native-resolution terrain model. Region
              selection sets the research context; it does not load a local DEM.
            </p>
          </div>
          <h3>Reported workspace</h3>
          <dl>
            <div>
              <dt>Primary grid</dt>
              <dd>{data.gridMeters} m</dd>
            </div>
            <div>
              <dt>Primary cells</dt>
              <dd>{(data.primaryCells / 1e6).toFixed(2)} M</dd>
            </div>
            <div>
              <dt>Named features</dt>
              <dd>{data.namedFeatures.toLocaleString()}</dd>
            </div>
            {body === "moon" && (
              <div>
                <dt>Located objects</dt>
                <dd>{metrics.bodies.moon.locatedObjects}</dd>
              </div>
            )}
          </dl>
          <button
            className="primary-button"
            onClick={() =>
              onResearch(
                `${region} ${body === "moon" ? "lunar terrain illumination permanent shadow" : "Mars geology terrain rover exploration"}`,
              )
            }
          >
            Investigate with SOZO
            <SparkIcon />
          </button>
          <a
            className="text-button"
            href={data.globeUrl}
            target="_blank"
            rel="noreferrer"
          >
            Explore the external globe
            <ExternalLink size={12} />
          </a>
        </aside>
      </div>
      <div className="explorer-limits">
        <span>KEEP THE CONTEXT WITH THE DATA</span>
        {data.limitations.map((l) => (
          <p key={l}>{l}</p>
        ))}
        <p>
          Imagery:{" "}
          {body === "moon"
            ? "NASA’s Scientific Visualization Studio · LROC / LOLA"
            : "NASA/JPL-Caltech · Viking imagery processed by USGS"}
          . Decorative lighting and mesh are for exploration, not measurement.
        </p>
      </div>
    </div>
  );
}
function SparkIcon() {
  return <ArrowUpRight size={15} />;
}
export function PlanetaryCatalog({
  initialBody = "all",
}: {
  initialBody?: string;
}) {
  const [body, setBody] = useState(initialBody);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All categories");
  const [mode, setMode] = useState("All statuses");
  const [selected, setSelected] = useState<Dataset | null>(null);
  const filtered = datasets.filter(
    (d) =>
      (body === "all" || d.body === body) &&
      (category === "All categories" || d.category === category) &&
      (mode === "All statuses" || d.mode === mode) &&
      `${d.name} ${d.provider}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="planetary-catalog">
      <PageHeading
        eyebrow="THE SOURCE BEHIND THE SCIENCE"
        title="Know your evidence."
        description="Inspect the Moon and Mars inventories, their resolution, provenance, and reported availability."
      >
        <span className="outline-tag">
          <Layers3 size={13} />
          {datasets.length} source labels
        </span>
      </PageHeading>
      <div className="catalog-notice">
        <ShieldCheck size={17} />
        <div>
          <strong>MOMAR project inventory</strong>
          <p>
            These entries describe the supplied MOMAR prototype. They have not
            been synchronized or independently validated in SOZO. The Moon has
            20 integrated or derived source labels and 7 additional sources
            reported as not yet available; names for those 7 were not supplied.
          </p>
        </div>
      </div>
      <div className="catalog-filters">
        <div className="filter-tabs">
          {[
            ["all", "Both worlds"],
            ["moon", "The Moon"],
            ["mars", "Mars"],
          ].map(([v, label]) => (
            <button
              className={body === v ? "active" : ""}
              key={v}
              onClick={() => setBody(v)}
            >
              {label}
            </button>
          ))}
        </div>
        <label>
          <Search size={14} />
          <input
            aria-label="Search planetary datasets"
            placeholder="Find a dataset or instrument…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Dataset category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {[
            "All categories",
            "Terrain",
            "Imagery",
            "Illumination",
            "Resources",
            "Geology",
            "Names & missions",
          ].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <select
          aria-label="Reported source status"
          value={mode}
          onChange={(e) => setMode(e.target.value)}
        >
          {[
            "All statuses",
            "Integrated",
            "Streamed",
            "Derived",
            "Archived",
            "Catalogued",
          ].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </div>
      <div className="catalog-results-label">
        <span>{filtered.length} DATASET LABELS</span>
        <span>STATUS REFERS TO THE SOURCE PROJECT</span>
      </div>
      <div className="dataset-table">
        {filtered.map((d) => (
          <button
            className="dataset-row"
            key={d.id}
            onClick={() => setSelected(d)}
          >
            <span className={`dataset-body ${d.body}`}>
              <Globe2 size={17} />
            </span>
            <div>
              <strong>{d.name}</strong>
              <small>{d.provider}</small>
            </div>
            <span className="dataset-resolution">{d.resolution}</span>
            <span className={`dataset-status ${d.mode.toLowerCase()}`}>
              {d.mode}
            </span>
            <ArrowUpRight size={16} />
          </button>
        ))}
      </div>
      {!filtered.length && (
        <div className="catalog-empty">No datasets match these filters.</div>
      )}
      {selected && (
        <Modal title={selected.name} wide onClose={() => setSelected(null)}>
          <div className="dataset-detail-tags">
            <span className="outline-tag">
              {selected.body === "moon" ? "The Moon" : "Mars"}
            </span>
            <span className="outline-tag">{selected.category}</span>
            <span className="outline-tag">
              {selected.mode} · project-reported
            </span>
          </div>
          <p className="dataset-detail-description">{selected.detail}</p>
          <dl className="dataset-details">
            <div>
              <dt>Provider / instrument</dt>
              <dd>{selected.provider}</dd>
            </div>
            <div>
              <dt>Reported spacing or resolution</dt>
              <dd>{selected.resolution}</dd>
            </div>
            <div>
              <dt>General coverage</dt>
              <dd>{selected.coverage}</dd>
            </div>
            <div>
              <dt>SOZO synchronization</dt>
              <dd>Not synchronized</dd>
            </div>
            <div>
              <dt>License / usage</dt>
              <dd>Consult the original dataset’s terms</dd>
            </div>
            <div>
              <dt>Inventory provenance</dt>
              <dd>MOMAR project brief · 27 October 2026</dd>
            </div>
          </dl>
          <div className="info-callout">
            <ShieldCheck size={16} />
            <p>
              Grid spacing does not guarantee native scientific resolution or
              uniform coverage. Inspect the original product before using it for
              measurements or mission decisions.
            </p>
          </div>
          <div className="modal-actions">
            <a
              className="primary-button"
              href={selected.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Inspect the source project
              <ExternalLink size={14} />
            </a>
          </div>
        </Modal>
      )}
    </div>
  );
}
