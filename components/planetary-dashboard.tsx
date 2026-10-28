"use client";
import { useState, type FormEvent } from "react";
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
type Destination = "moon" | "mars" | "both";
const focuses = [
  { id: "routes", label: "Routes" },
  { id: "ice", label: "Ice & water" },
  { id: "geology", label: "Geology" },
  { id: "operations", label: "Operations" },
] as const;
type Focus = (typeof focuses)[number]["id"];
const suggestions: Record<Destination, Record<Focus, string>> = {
  moon: {
    routes: "How do LOLA slope and illumination constrain rover routes near the lunar south pole?",
    ice: "What evidence supports water ice in permanently shadowed craters at the lunar south pole?",
    geology: "What do lunar south-pole impact basins reveal about the Moon's early history?",
    operations: "Which lunar south-pole sites balance sunlight, Earth visibility and terrain for a base?",
  },
  mars: {
    routes: "How does terrain slope and roughness affect rover route planning in Jezero Crater?",
    ice: "Where is accessible subsurface water ice on Mars for future crewed missions?",
    geology: "What evidence for past water has Perseverance found in the Jezero delta?",
    operations: "What surface conditions shape habitat siting for crewed Mars missions?",
  },
  both: {
    routes: "How do Moon and Mars terrain constraints differ for rover route planning?",
    ice: "How does water ice on the Moon compare with ice on Mars as a resource?",
    geology: "What does comparing lunar and Martian geology reveal about planetary evolution?",
    operations: "What can lunar surface operations teach crews preparing for Mars?",
  },
};
const mentionsBody = /\b(moon|lunar|mars|martian|jezero|gale)\b/i;

const frontiers = [
  {
    id: "moon",
    eyebrow: "The Moon",
    title: "South pole light",
    detail: "Illumination, ice and traverse planning across the lunar south pole.",
    image: "/films/sozo-lunar-fieldwork.jpg",
    stats: [
      `≈${metrics.bodies.moon.areaKm2.toLocaleString("en-US")} km²`,
      `${metrics.bodies.moon.gridMeters} m grid`,
    ],
  },
  {
    id: "mars",
    eyebrow: "Mars",
    title: "Jezero & Gale",
    detail: "Ancient water, delta geology and rover terrain in two crater workspaces.",
    image: "/films/sozo-martian-frontier.jpg",
    stats: [
      `≈${metrics.bodies.mars.areaKm2.toLocaleString("en-US")} km²`,
      `${metrics.bodies.mars.gridMeters} m grid`,
    ],
  },
  {
    id: "orbit",
    eyebrow: "Earth orbit",
    title: "Station operations",
    detail: "Talk with SOZO by voice or text during station and EVA work.",
    image: "/films/sozo-orbital-assistance.jpg",
    stats: ["Voice + text", "Cited answers"],
  },
] as const;

const briefs = [
  { body: "Moon", question: "Lunar south-pole illumination and permanently shadowed regions" },
  { body: "Mars", question: "Jezero Crater geology and evidence of past water" },
  { body: "Mars", question: "Terrain slope constraints for Mars rover route planning" },
  { body: "Moon", question: "Radiation exposure for crews on the lunar surface" },
];

export function MissionOverview({
  runs,
  userName,
  launching,
  onLaunch,
  onExplore,
  onCompanion,
  onResearch,
  onOpen,
  onCatalog,
}: {
  runs: ResearchRun[];
  userName: string;
  launching: boolean;
  onLaunch: (question: string, mode: "focused" | "broad") => void;
  onExplore: (b: PlanetaryBody) => void;
  onCompanion: () => void;
  onResearch: (q: string) => void;
  onOpen: (r: ResearchRun) => void;
  onCatalog: () => void;
}) {
  const [destination, setDestination] = useState<Destination>("moon");
  const [focus, setFocus] = useState<Focus>("routes");
  const [depth, setDepth] = useState<"focused" | "broad">("focused");
  const [question, setQuestion] = useState("");
  const suggestion = suggestions[destination][focus];
  const sources = new Set(
    runs.flatMap((r) => r.result?.citations.map((s) => s.doi || s.url) || []),
  ).size;
  const launch = (event: FormEvent) => {
    event.preventDefault();
    const typed = question.trim();
    const body = destination === "moon" ? "Moon" : destination === "mars" ? "Mars" : "";
    // Give literature search the destination when the question omits it.
    onLaunch(typed ? (body && !mentionsBody.test(typed) ? `${typed} (${body})` : typed) : suggestion, depth);
  };
  const greeting = userName && userName !== "Researcher" ? userName.split(" ")[0] : "";
  return (
    <div className="mission-overview cosmos-overview">
      <section className="cosmos-hero">
        <div className="cosmos-hero-media" aria-hidden="true">
          <div className="cosmos-hero-planet" />
          <div className="cosmos-hero-moonlet" />
        </div>
        <div className="cosmos-hero-copy">
          <span className="cosmos-kicker">
            <i />
            Mission control{greeting ? ` · Welcome back, ${greeting}` : ""}
          </span>
          <span className="cosmos-spaced">The next era of exploration</span>
          <h1>
            Your AI <span>space scientist</span>
          </h1>
          <p>
            Ask about the Moon, Mars and beyond. SOZO finds the evidence, reads
            the terrain context you share and keeps every answer cited.
          </p>
        </div>
        <form className="mission-bar" onSubmit={launch} aria-label="Launch an investigation">
          <label className="mission-field">
            <span>Destination</span>
            <select value={destination} onChange={(e) => setDestination(e.target.value as Destination)}>
              <option value="moon">The Moon</option>
              <option value="mars">Mars</option>
              <option value="both">Both</option>
            </select>
          </label>
          <label className="mission-field">
            <span>Focus</span>
            <select value={focus} onChange={(e) => setFocus(e.target.value as Focus)}>
              {focuses.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
          <label className="mission-field">
            <span>Depth</span>
            <select value={depth} onChange={(e) => setDepth(e.target.value as "focused" | "broad")}>
              <option value="focused" title="Up to 4 records per source">Focused</option>
              <option value="broad" title="Up to 8 records per source">Broad</option>
            </select>
          </label>
          <label className="mission-field mission-question">
            <span>Your question</span>
            <input
              value={question}
              maxLength={1400}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={suggestion}
            />
          </label>
          <button type="submit" className="mission-launch" disabled={launching}>
            {launching ? "Launching…" : "Launch"}
            <ArrowUpRight size={17} />
          </button>
        </form>
      </section>

      <div className="cosmos-telemetry">
        <div>
          <span>Investigations</span>
          <strong>{runs.length.toString().padStart(2, "0")}</strong>
          <small>saved in your workspace</small>
        </div>
        <div>
          <span>Evidence</span>
          <strong>{sources.toString().padStart(2, "0")}</strong>
          <small>unique publications cited</small>
        </div>
        <div>
          <span>Terrain coverage</span>
          <strong>≈{(metrics.combinedPrimaryCells / 1e6).toFixed(2)}M</strong>
          <small>MOMAR-reported primary cells</small>
        </div>
        <div>
          <span>Sources</span>
          <strong>03</strong>
          <small>Crossref · Europe PMC · NASA</small>
        </div>
      </div>

      <section className="cosmos-section">
        <div className="cosmos-heading">
          <span className="cosmos-spaced">Featured</span>
          <h2>Frontiers</h2>
          <button onClick={onCatalog}>
            Dataset catalog
            <ArrowRight size={14} />
          </button>
        </div>
        <div className="frontier-cards">
          {frontiers.map((card) => (
            <button
              key={card.id}
              className={`frontier-card ${card.id}`}
              onClick={() => (card.id === "orbit" ? onCompanion() : onExplore(card.id))}
            >
              <span className="frontier-card-image" style={{ backgroundImage: `url(${card.image})` }} />
              <span className={`frontier-card-sphere ${card.id}`} />
              <span className="frontier-card-copy">
                <small>{card.eyebrow}</small>
                <strong>{card.title}</strong>
                <span>{card.detail}</span>
                <span className="frontier-card-stats">
                  {card.stats.map((stat) => <em key={stat}>{stat}</em>)}
                </span>
              </span>
              <ArrowUpRight className="frontier-card-arrow" size={20} />
            </button>
          ))}
        </div>
      </section>

      <div className="cosmos-columns">
        <section className="cosmos-panel">
          <div className="cosmos-panel-head">
            <h2>Mission briefs</h2>
            <span>Start with a question</span>
          </div>
          {briefs.map((brief, i) => (
            <button className="mission-brief" key={brief.question} onClick={() => onResearch(brief.question)}>
              <span className="mission-brief-index">0{i + 1}</span>
              <span className="mission-brief-copy">
                <small>{brief.body}</small>
                {brief.question}
              </span>
              <ArrowUpRight size={15} />
            </button>
          ))}
        </section>
        <section className="cosmos-panel">
          <div className="cosmos-panel-head">
            <h2>Flight log</h2>
            <Clock3 size={14} />
          </div>
          {runs.length ? (
            runs.slice(0, 4).map((r) => (
              <button key={r.id} className="flight-log-row" onClick={() => onOpen(r)}>
                <span className="activity-icon">
                  <FlaskConical size={15} />
                </span>
                <span className="flight-log-copy">
                  <strong>{r.question}</strong>
                  <Status status={r.status} />
                </span>
                <ArrowUpRight size={14} />
              </button>
            ))
          ) : (
            <div className="mission-activity-empty">
              <Orbit size={31} strokeWidth={1} />
              <h3>A new perspective starts here.</h3>
              <p>Launch a question above. Your investigations and cited sources appear here.</p>
            </div>
          )}
        </section>
      </div>

      <div className="mission-source-note">
        <ShieldCheck size={15} />
        <p>
          Imagery is illustrative. MOMAR coverage figures are project-reported;
          your investigation and source counts come from your actual workspace.
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
