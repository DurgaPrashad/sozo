"use client";
import { useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowDown,
  Route,
  Database,
  Sparkles,
  ShieldCheck,
  ExternalLink,
  Globe2,
  ScanLine,
  Cpu,
} from "lucide-react";
import PlanetScene from "./planet-scene";
import MissionFilm from "./mission-film";
import RobotCompanion from "./robot-companion";
import ScientificArticles from "./scientific-articles";
import {
  planetaryMetrics,
  lunarCapabilities,
  marsCapabilities,
  datasets,
  type PlanetaryBody,
} from "../lib/planetary/manifest";
import { SOZO_MODELS, MODEL_STATUS_LABEL, type ModelCategory } from "../lib/companion/models";
const metrics = planetaryMetrics();
const lunar = metrics.bodies.moon;
const mars = metrics.bodies.mars;
const number = (value: number) => value.toLocaleString("en-US");
// The prototype section's two worlds, with the figures worth leading with.
const prototypes = {
  moon: {
    eyebrow: "INSIDE THE MOMAR LUNAR PROTOTYPE",
    intro: "Six connected perspectives at the lunar south pole, from terrain and light to the mission plan.",
    capabilities: lunarCapabilities,
    world: lunar,
    cta: "Open the lunar prototype",
    highlights: [
      [`≈${number(lunar.areaKm2)} km²`, "South-pole workspace"],
      [`${lunar.gridMeters} m`, "Terrain grid"],
      [String(lunar.integratedOrDerivedSources), "Integrated or derived sources"],
      [number(lunar.namedFeatures), `IAU names · ${lunar.locatedObjects} located objects`],
    ],
  },
  mars: {
    eyebrow: "INSIDE THE MOMAR MARS PROTOTYPE",
    intro: "Six connected perspectives on Jezero Crater, from terrain and routes to rover photographs and the whole planet.",
    capabilities: marsCapabilities,
    world: mars,
    cta: "Open the Mars planner",
    highlights: [
      ["Jezero + Gale", "Detailed workspaces"],
      [`${mars.gridMeters} m`, "Terrain grid"],
      ["626", "Perseverance images on the route"],
      [number(mars.namedFeatures), "IAU names on the globe"],
    ],
  },
} as const;
const modelCategories: ("All" | ModelCategory)[] = ["All", "Space science", "Rockets & engines", "Orbital calculations", "Planetary zones", "Planets & imagery", "Voice"];
const modelExample = `curl https://sozo.momar.si/api/companion/models

curl -X POST https://sozo.momar.si/api/companion/chat \\
  -H "Authorization: Bearer $SOZO_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"message":"Earth to Mars transfer time and delta-v?",
       "provider":"sarvam","style":"brief"}'`;
function Brand() {
  return (
    <a className="premium-brand" href="/" aria-label="SOZO home">
      <img src="/sozo-mark.svg" alt="" />
      <span>SOZO</span>
    </a>
  );
}
export default function SpaceLanding() {
  const [menu, setMenu] = useState(false),
    [body, setBody] = useState<PlanetaryBody>("moon"),
    [world, setWorld] = useState<PlanetaryBody>("moon"),
    [simLive, setSimLive] = useState(false),
    [category, setCategory] = useState<(typeof modelCategories)[number]>("All");
  const current = metrics.bodies[body];
  const prototype = prototypes[world];
  const models = SOZO_MODELS.filter((model) => category === "All" || model.category === category);
  return (
    <div className="premium-site">
      <a className="space-skip" href="#frontiers">
        Skip to content
      </a>
      <header className="premium-nav">
        <a href="/" className="nav-wordmark" aria-label="SOZO home">
          SOZO
        </a>
        <nav aria-label="Main navigation" className={menu ? "open" : ""}>
          <a href="#moon" onClick={() => setMenu(false)}>
            The Moon
          </a>
          <a href="#mars" onClick={() => setMenu(false)}>
            Mars
          </a>
          <a href="#intelligence" onClick={() => setMenu(false)}>
            SOZO agent
          </a>
          <a href={metrics.sourceUrl} target="_blank" rel="noreferrer" className="nav-external">
            MOMAR
            <ArrowUpRight size={12} />
          </a>
          <a href="#articles" onClick={() => setMenu(false)}>
            Articles <span className="nav-new">NEW</span>
          </a>
          <a href="#models" onClick={() => setMenu(false)}>
            Models
          </a>
          <a href="/3dsim" onClick={() => setMenu(false)}>
            3DSim
          </a>
          <a href="#evidence" onClick={() => setMenu(false)}>
            The evidence
          </a>
        </nav>
        <div className="premium-nav-actions">
          <a className="premium-signin" href="/login">
            Sign in
          </a>
          <a href="/dashboard" className="nav-workspace-link">
            Open SOZO
          </a>
          <button
            className="premium-menu"
            aria-label={menu ? "Close menu" : "Open menu"}
            aria-expanded={menu}
            onClick={() => setMenu((value) => !value)}
          >
            {menu ? "Close" : "Menu"}
          </button>
        </div>
      </header>
      <main>
        <MissionFilm />
        <section className="frontier-intro premium-section" id="frontiers">
          <div className="frontier-intro-copy">
            <span className="premium-eyebrow">
              <i />A SCIENCE WORKSPACE FOR WHAT COMES NEXT
            </span>
            <h2>
              Intelligence for
              <br />
              life <span>beyond Earth.</span>
            </h2>
            <p>
              Connect the evidence. Understand the terrain. Help people explore,
              build, and work on worlds beyond our own.
            </p>
            <a className="premium-text-link" href="#moon">
              Two worlds. A shared frontier.
              <ArrowDown size={17} />
            </a>
          </div>
          <div className="frontier-pair">
            <PlanetScene duo />
            <span className="pair-label moon">01 / MOON · FAR FIELD</span>
            <span className="pair-label mars">02 / MARS · FOREGROUND</span>
            <span className="visualization-caption">
              NASA SOURCE IMAGERY · VISUALIZATION
            </span>
          </div>
        </section>
        <section className="frontier-world moon-world" id="moon">
          <div className="frontier-globe">
            <PlanetScene body="moon" interactive />
            <span className="world-credit">
              NASA SVS · LROC & LOLA · imagery visualization
            </span>
          </div>
          <div className="frontier-world-copy">
            <span className="premium-eyebrow">FRONTIER 01</span>
            <h2>The Moon</h2>
            <p>
              Understand the lunar surface. Follow the light. Plan the next step
              with the evidence in view.
            </p>
            <div className="world-capabilities">
              <a href={lunar.url} target="_blank" rel="noreferrer">
                <span>South-pole terrain & illumination</span>
                <span className="premium-status">MOMAR PROTOTYPE</span>
              </a>
              <a href={lunar.url} target="_blank" rel="noreferrer">
                <span>Route optimization</span>
                <span className="premium-status">MOMAR PROTOTYPE</span>
              </a>
              <div>
                <span>Habitats & infrastructure</span>
                <span className="premium-status planned">VISION</span>
              </div>
            </div>
            <div className="frontier-world-links">
              <a href={lunar.url} target="_blank" rel="noreferrer">
                Lunar south pole
                <ArrowRight size={17} />
              </a>
              <a href={lunar.globeUrl} target="_blank" rel="noreferrer">
                The whole Moon
                <ArrowRight size={17} />
              </a>
              <a href="/dashboard?view=moon">
                Explore in SOZO
                <ArrowUpRight size={16} />
              </a>
            </div>
            <div className="frontier-world-stats">
              <span>
                <strong>
                  ≈{number(lunar.areaKm2)}
                  <small>km²</small>
                </strong>
                South-pole workspace
              </span>
              <span>
                <strong>
                  {(lunar.primaryCells / 1e6).toFixed(2)}
                  <small>M</small>
                </strong>
                Primary terrain cells
              </span>
              <span>
                <strong>
                  {lunar.gridMeters}
                  <small>m</small>
                </strong>
                Workspace grid
              </span>
            </div>
          </div>
        </section>
        <section className="frontier-world mars-world" id="mars">
          <div className="frontier-world-copy">
            <span className="premium-eyebrow">FRONTIER 02</span>
            <h2>Mars</h2>
            <p>
              Read ancient landscapes. Investigate Jezero and Gale. Turn
              planetary context into a better scientific question.
            </p>
            <div className="world-capabilities">
              <a href={mars.url} target="_blank" rel="noreferrer">
                <span>Terrain intelligence & mapping</span>
                <span className="premium-status">MOMAR PROTOTYPE</span>
              </a>
              <a href={mars.url} target="_blank" rel="noreferrer">
                <span>Route optimization</span>
                <span className="premium-status">MOMAR PROTOTYPE</span>
              </a>
              <div>
                <span>Rovers, habitats & infrastructure</span>
                <span className="premium-status planned">VISION</span>
              </div>
            </div>
            <div className="frontier-world-links">
              <a
                href={mars.url}
                target="_blank"
                rel="noreferrer"
                className="premium-button warm"
              >
                Open the Mars planner
                <ArrowRight size={17} />
              </a>
              <a href="/dashboard?view=mars">
                Explore in SOZO
                <ArrowUpRight size={16} />
              </a>
            </div>
            <div className="frontier-world-stats">
              <span>
                <strong>
                  ≈{number(mars.areaKm2)}
                  <small>km²</small>
                </strong>
                Detailed workspace
              </span>
              <span>
                <strong>
                  {(mars.primaryCells / 1e6).toFixed(2)}
                  <small>M</small>
                </strong>
                Primary terrain cells
              </span>
              <span>
                <strong>
                  {mars.gridMeters}
                  <small>m</small>
                </strong>
                Workspace grid
              </span>
            </div>
          </div>
          <div className="frontier-globe">
            <PlanetScene body="mars" interactive />
            <span className="world-credit">
              NASA/JPL-Caltech · Viking / USGS · imagery visualization
            </span>
          </div>
        </section>
        <section className="companion-section premium-section" id="companion">
          <div className="companion-copy">
            <span className="premium-eyebrow">SOZO / THE COMPANION</span>
            <h2>
              Curiosity,
              <br />
              <span>in good company.</span>
            </h2>
            <p>
              A familiar face for the next frontier. Keep the human, the
              question, and the evidence connected.
            </p>
            <div className="companion-palette">
              <span>
                <i className="silver" />
                Ceramic white
              </span>
              <span>
                <i className="graphite" />
                Graphite
              </span>
              <span>
                <i className="signal" />
                Signal blue
              </span>
            </div>
            <a href="/dashboard?view=companion" className="premium-text-link">
              Talk with SOZO
              <ArrowRight size={17} />
            </a>
            <span className="companion-concept">3D COMPANION · SARVAM AI &amp; VOICE · META LLAMA READY TO CONNECT</span>
          </div>
          <RobotCompanion />
        </section>
        <section className="landing-sim premium-section" id="3dsim">
          <div className="landing-sim-copy">
            <span className="premium-eyebrow">SOZO / 3D SIMULATION</span>
            <h2>
              Drive it.
              <br />
              <span>Live, in your browser.</span>
            </h2>
            <p>
              A planetary rover on real physics. Drive it on the Moon and Mars,
              float it in orbit, take it apart down to the pins. A design study:
              nothing has been built.
            </p>
            <div className="sim-actions">
              <a className="premium-button light" href="/3dsim">
                Open the 3D simulation
                <ArrowUpRight size={16} />
              </a>
              <a className="premium-text-link" href="https://sozo3d.momar.si/" target="_blank" rel="noreferrer">
                Full screen
                <ArrowUpRight size={14} />
              </a>
            </div>
          </div>
          <div className="sim-frame">
            {simLive ? (
              <iframe src="https://sozo3d.momar.si/" title="SOZO planetary rover simulator" allow="fullscreen; gamepad; accelerometer" loading="lazy" />
            ) : (
              <button className="sim-play" onClick={() => setSimLive(true)} aria-label="Start the live 3D simulation">
                <span>▶</span>
                <strong>Start the live simulation</strong>
                <small>Loads from sozo3d.momar.si</small>
              </button>
            )}
          </div>
        </section>
        <section
          className="intelligence-section premium-section"
          id="intelligence"
        >
          <div className="intelligence-heading">
            <span className="premium-eyebrow">
              <Sparkles size={14} />
              THE SOZO AGENT / OUR DIRECTION
            </span>
            <h2>
              From a question
              <br />
              to the <span>next possibility.</span>
            </h2>
            <p>
              A scientific copilot for space exploration. Bring real sources
              into view, investigate mission constraints, and keep the reasoning
              with the work.
            </p>
            <a
              href="/dashboard?view=scientist"
              className="premium-button light"
            >
              Open the research workspace
              <ArrowUpRight size={17} />
            </a>
          </div>
          <div className="mission-agent-panel">
            <div className="agent-panel-header">
              <img src="/sozo-mark.svg" alt="" />
              <span>SOZO / MISSION RESEARCH</span>
              <span className="agent-live">
                <i />
                AVAILABLE NOW
              </span>
            </div>
            <div className="agent-question">
              <span>START WITH A REAL QUESTION</span>
              <h3>What would it take to explore the lunar south pole?</h3>
            </div>
            <div className="agent-pipeline">
              <a href="/dashboard?view=archive">
                <Database size={18} />
                <div>
                  <strong>Find original space records</strong>
                  <p>
                    Search the live NASA archive with original links, dates, and
                    provenance.
                  </p>
                </div>
                <ArrowUpRight size={16} />
              </a>
              <a href="/dashboard?view=scientist">
                <ScanLine size={18} />
                <div>
                  <strong>Follow the scientific evidence</strong>
                  <p>
                    Discover publications through Crossref and Europe PMC. Keep
                    the citations.
                  </p>
                </div>
                <ArrowUpRight size={16} />
              </a>
              <a href={lunar.url} target="_blank" rel="noreferrer">
                <Route size={18} />
                <div>
                  <strong>Move into mission planning</strong>
                  <p>
                    Open the MOMAR prototype to compute terrain routes and
                    inspect its constraints.
                  </p>
                </div>
                <ArrowUpRight size={16} />
              </a>
            </div>
            <div className="agent-development">
              <span className="premium-status planned">CONNECTED SCIENCE · ROUTING ADAPTER PLANNED</span>
              <p>
                Sarvam research and voice are available in your workspace. Direct
                MOMAR route computation needs its backend API; SOZO does not
                control mission hardware.
              </p>
            </div>
          </div>
        </section>
        <ScientificArticles compact />
        <section className="models-section premium-section" id="models">
          <div className="models-heading">
            <div>
              <span className="premium-eyebrow">
                <Cpu size={14} />
                SOZO MODELS / ONE API
              </span>
              <h2>
                Models for every
                <br />
                <span>part of the mission.</span>
              </h2>
            </div>
            <p>
              Science, rockets, orbits and planetary zones. Live models answer
              through one API today; everything else says plainly where it
              stands.
            </p>
          </div>
          <div className="models-filter" role="group" aria-label="Filter models by field">
            {modelCategories.map((value) => (
              <button key={value} type="button" aria-pressed={category === value} onClick={() => setCategory(value)}>
                {value}
              </button>
            ))}
          </div>
          <div className="models-grid">
            {models.map((model) => (
              <article key={model.id} className={`model-card ${model.status}`}>
                <div className="model-card-top">
                  <span>{model.category}</span>
                  <span className={`premium-status ${model.status === "live" ? "" : model.status}`}>{MODEL_STATUS_LABEL[model.status]}</span>
                </div>
                <h3>{model.name}</h3>
                <p>{model.summary}</p>
                <ul>
                  {model.capabilities.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <div className="model-meta">
                  <span>{model.provider}</span>
                  {model.model && <code>{model.model}</code>}
                </div>
                {model.access ? (
                  <code className="model-access">
                    <b>{model.access.method}</b> {model.access.path}
                    <i> · {model.access.use}</i>
                  </code>
                ) : model.status === "prototype" ? (
                  <a className="model-access" href={metrics.sourceUrl} target="_blank" rel="noreferrer">
                    Open in MOMAR <ArrowUpRight size={12} />
                  </a>
                ) : (
                  <span className="model-access muted">On the roadmap</span>
                )}
              </article>
            ))}
          </div>
          <div className="models-api">
            <div>
              <h3>One API for all of it.</h3>
              <p>
                List the models, then ask. The same request works from a
                server, the CLI, or the companion embedded on any website with
                a publishable key.
              </p>
              <div className="models-api-links">
                <a href="/dashboard?view=developers" className="premium-button light">
                  Get an API key
                  <ArrowUpRight size={16} />
                </a>
                <a href="/api/companion/models" target="_blank" rel="noreferrer" className="premium-text-link">
                  GET /api/companion/models
                  <ArrowUpRight size={14} />
                </a>
              </div>
            </div>
            <pre>
              <code>{modelExample}</code>
            </pre>
          </div>
        </section>
        <section className="evidence-section premium-section" id="evidence">
          <div className="evidence-heading">
            <div>
              <span className="premium-eyebrow">
                <ShieldCheck size={14} />
                SCIENCE STARTS WITH PROVENANCE
              </span>
              <h2>
                Big worlds.
                <br />
                <span>Details that matter.</span>
              </h2>
            </div>
            <div
              className="premium-body-tabs"
              aria-label="Reported planetary coverage"
            >
              {(["moon", "mars"] as const).map((value) => (
                <button
                  key={value}
                  onClick={() => setBody(value)}
                  aria-pressed={body === value}
                  className={body === value ? "active" : ""}
                >
                  {value === "moon" ? "The Moon" : "Mars"}
                </button>
              ))}
            </div>
          </div>
          <div className="evidence-meta">
            <span>MOMAR PROJECT-REPORTED COVERAGE</span>
            <a href={metrics.sourceUrl} target="_blank" rel="noreferrer">
              Source project
              <ExternalLink size={12} />
            </a>
          </div>
          <div className="evidence-numbers">
            <div>
              <strong>
                ≈{number(current.areaKm2)}
                <small>km²</small>
              </strong>
              <h3>
                {body === "moon"
                  ? "South-pole workspace"
                  : "Jezero + Gale workspaces"}
              </h3>
              <p>
                {current.gridMeters} m grid
                {body === "moon" ? " · to ≈84°S" : ""}
              </p>
            </div>
            <div>
              <strong>
                {(current.primaryCells / 1e6).toFixed(2)}
                <small>M</small>
              </strong>
              <h3>Primary terrain cells</h3>
              <p>Reported as analysed in MOMAR</p>
            </div>
            <div>
              <strong>
                {body === "moon"
                  ? lunar.integratedOrDerivedSources
                  : `${mars.sourceCounts.Jezero} / ${mars.sourceCounts.Gale}`}
              </strong>
              <h3>
                {body === "moon"
                  ? "Integrated or derived sources"
                  : "Regional source counts"}
              </h3>
              <p>
                {body === "moon"
                  ? `${lunar.notYetAvailable} additional sources listed as not yet available`
                  : "Jezero / Gale · inventories overlap"}
              </p>
            </div>
            <div>
              <strong>{number(current.namedFeatures)}</strong>
              <h3>IAU feature names</h3>
              <p>
                {body === "moon"
                  ? `${lunar.locatedObjects} located human-made objects`
                  : "Names reported for the Mars globe"}
              </p>
            </div>
          </div>
          <div className="evidence-integrity">
            <Globe2 size={30} strokeWidth={1} />
            <div>
              <h3>
                Both worlds: ≈{(metrics.combinedPrimaryCells / 1e6).toFixed(2)}{" "}
                million primary terrain cells.
              </h3>
              <p>
                20 m on Mars. 240 m in the lunar workspace. Overlapping lunar
                960 m far-field and 480 m Diviner grids are excluded. The lunar
                area is a square polar-stereographic grid, with uneven
                observational coverage.
              </p>
            </div>
          </div>
          <details className="evidence-method">
            <summary>Read the methodology and limits</summary>
            <p>{metrics.methodology}</p>
            <p>
              Counts and source status come from the supplied MOMAR brief dated
              27 October 2026. SOZO has not independently recomputed those
              figures or ingested those terrain grids. Potential ice and
              modelled stability never establish confirmed ice. Grid spacing and
              effective scientific resolution are different.
            </p>
          </details>
          <div className="evidence-datasets">
            {datasets
              .filter((item) => item.body === body)
              .slice(0, 8)
              .map((item) => (
                <a key={item.id} href={`/dashboard?view=catalog&body=${body}`}>
                  {item.name}
                  <ArrowUpRight size={12} />
                </a>
              ))}
            <a
              className="evidence-catalog-link"
              href={`/dashboard?view=catalog&body=${body}`}
            >
              Inspect all {body === "moon" ? 20 : 16} source labels
              <ArrowRight size={14} />
            </a>
          </div>
        </section>
        <section className="prototype-section premium-section" id="prototype">
          <div className="prototype-heading">
            <div>
              <span className="premium-eyebrow">{prototype.eyebrow}</span>
              <h2>
                See the surface.
                <br />
                <span>Understand the possibilities.</span>
              </h2>
            </div>
            <div className="prototype-heading-side">
              <div className="premium-body-tabs prototype-tabs" role="group" aria-label="Choose a world">
                {(["moon", "mars"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setWorld(value)}
                    aria-pressed={world === value}
                    className={world === value ? `active ${value}` : value}
                  >
                    {value === "moon" ? "The Moon" : "Mars"}
                  </button>
                ))}
              </div>
              <p>
                {prototype.intro} Open the external prototype to explore its
                working tools.
              </p>
            </div>
          </div>
          <div className={`prototype-highlights ${world}`}>
            {prototype.highlights.map(([value, label]) => (
              <span key={label}>
                <strong>{value}</strong>
                {label}
              </span>
            ))}
            <a href={prototype.world.url} target="_blank" rel="noreferrer">
              {prototype.cta}
              <ArrowUpRight size={15} />
            </a>
          </div>
          <div className={`premium-prototypes ${world}`} key={world}>
            {prototype.capabilities.map((feature) => (
              <article key={feature.letter}>
                <a
                  className="premium-prototype-image"
                  href={feature.link === "globe" ? prototype.world.globeUrl : prototype.world.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open MOMAR ${feature.title}`}
                >
                  <img
                    src={`/planetary/${feature.image}.webp`}
                    alt={`MOMAR ${world === "moon" ? "lunar" : "Mars"} prototype: ${feature.title}`}
                    loading="lazy"
                  />
                  <span>
                    {feature.letter}
                    <ArrowUpRight size={17} />
                  </span>
                  <em>{feature.highlight}</em>
                </a>
                <div>
                  <small className="prototype-subtitle">{feature.subtitle}</small>
                  <h3>{feature.title}</h3>
                  <p>{feature.detail}</p>
                  <details>
                    <summary>Inside the prototype</summary>
                    <ul>
                      {feature.specifics.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </details>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="premium-final">
          <div className="final-orbit" aria-hidden="true" />
          <span className="premium-eyebrow">FOR THE ENDLESSLY CURIOUS</span>
          <h2>
            The next frontier
            <br />
            starts with <span>a question.</span>
          </h2>
          <a className="premium-button light" href="/dashboard">
            Enter your workspace
            <ArrowUpRight size={18} />
          </a>
        </section>
      </main>
      <footer className="premium-footer">
        <div>
          <Brand />
          <p>
            Scientific intelligence.
            <br />A wider universe.
          </p>
          <nav aria-label="Footer">
            <a href={lunar.url} target="_blank" rel="noreferrer">
              MOMAR Moon
              <ArrowUpRight size={12} />
            </a>
            <a href={mars.url} target="_blank" rel="noreferrer">
              MOMAR Mars
              <ArrowUpRight size={12} />
            </a>
            <a href="/dashboard?view=archive">NASA archive</a>
            <a href="/dashboard?view=developers">Developers</a>
          </nav>
        </div>
        <div className="premium-credits">
          <span>© 2026 SOZO</span>
          <p>
            Films: user-supplied AI-generated concepts. Globe imagery:{" "}
            <a
              href="https://svs.gsfc.nasa.gov/4720/"
              target="_blank"
              rel="noreferrer"
            >
              NASA SVS / LROC / LOLA
            </a>{" "}
            and{" "}
            <a
              href="https://science.nasa.gov/3d-resources/mars/"
              target="_blank"
              rel="noreferrer"
            >
              NASA/JPL-Caltech
            </a>
            . Prototype previews: MOMAR. Visualizations are illustrative; NASA
            affiliation or endorsement is not implied.
          </p>
        </div>
      </footer>
    </div>
  );
}
