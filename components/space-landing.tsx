"use client";
import { useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Menu,
  X,
  ArrowDown,
  Orbit,
  Route,
  Database,
  Sparkles,
  ShieldCheck,
  ExternalLink,
  Globe2,
  ScanLine,
} from "lucide-react";
import PlanetScene from "./planet-scene";
import MissionFilm from "./mission-film";
import {
  planetaryMetrics,
  lunarCapabilities,
  datasets,
  type PlanetaryBody,
} from "../lib/planetary/manifest";
const metrics = planetaryMetrics();
const lunar = metrics.bodies.moon;
const mars = metrics.bodies.mars;
const number = (value: number) => value.toLocaleString("en-US");
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
    [body, setBody] = useState<PlanetaryBody>("moon");
  const current = metrics.bodies[body];
  return (
    <div className="premium-site">
      <a className="space-skip" href="#frontiers">
        Skip to content
      </a>
      <header className="premium-nav">
        <Brand />
        <nav aria-label="Main navigation" className={menu ? "open" : ""}>
          <a
            href={lunar.url}
            target="_blank"
            rel="noreferrer"
            aria-label="MOMAR Moon planner"
          >
            The Moon
            <ArrowUpRight size={12} />
          </a>
          <a
            href={mars.url}
            target="_blank"
            rel="noreferrer"
            aria-label="MOMAR Mars planner"
          >
            Mars
            <ArrowUpRight size={12} />
          </a>
          <a href="#intelligence" onClick={() => setMenu(false)}>
            SOZO agent
          </a>
          <a href="#evidence" onClick={() => setMenu(false)}>
            The evidence
          </a>
        </nav>
        <div className="premium-nav-actions">
          <a className="premium-signin" href="/login">
            Sign in
          </a>
          <a href="/dashboard" className="premium-button light">
            Open SOZO
            <ArrowUpRight size={16} />
          </a>
          <button
            className="premium-menu"
            aria-label={menu ? "Close menu" : "Open menu"}
            aria-expanded={menu}
            onClick={() => setMenu((value) => !value)}
          >
            {menu ? <X size={22} /> : <Menu size={22} />}
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
              <span className="premium-status planned">IN DEVELOPMENT</span>
              <p>
                Model-powered synthesis and direct MOMAR route tools. SOZO does
                not yet compute a terrain route or control mission hardware.
              </p>
            </div>
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
              <span className="premium-eyebrow">
                INSIDE THE MOMAR LUNAR PROTOTYPE
              </span>
              <h2>
                See the surface.
                <br />
                <span>Understand the possibilities.</span>
              </h2>
            </div>
            <p>
              Six connected perspectives, from terrain and light to the mission
              plan. Open the external prototype to explore its working tools.
            </p>
          </div>
          <div className="premium-prototypes">
            {lunarCapabilities.map((feature) => (
              <article key={feature.letter}>
                <a
                  className="premium-prototype-image"
                  href={lunar.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open MOMAR ${feature.title}`}
                >
                  <img
                    src={`/planetary/${feature.image}.webp`}
                    alt={`MOMAR prototype: ${feature.title}`}
                    loading="lazy"
                  />
                  <span>
                    {feature.letter}
                    <ArrowUpRight size={17} />
                  </span>
                </a>
                <div>
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
