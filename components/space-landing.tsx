"use client";
import { useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowDown,
  Menu,
  X,
  Orbit,
  MoveUpRight,
  Sparkles,
  Route,
  Layers3,
  ScanLine,
  Code2,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import PlanetScene from "./planet-scene";
import {
  planetaryMetrics,
  lunarCapabilities,
  datasets,
  type PlanetaryBody,
} from "../lib/planetary/manifest";
const metrics = planetaryMetrics();
export default function SpaceLanding() {
  const [menu, setMenu] = useState(false);
  const [body, setBody] = useState<PlanetaryBody>("moon");
  const [showMethod, setShowMethod] = useState(false);
  const lunar = metrics.bodies.moon;
  const mars = metrics.bodies.mars;
  const coverage = metrics.bodies[body];
  const number = (value: number) => value.toLocaleString("en-US");
  return (
    <div className="space-site">
      <a href="#space-main" className="space-skip">
        Skip to content
      </a>
      <header className="space-nav">
        <a className="space-brand" href="/" aria-label="SOZO home">
          <img src="/sozo-mark.svg" alt="" />
          <span>
            sozo<span className="brand-dot">.</span>
          </span>
          <span className="brand-tagline">
            PLANETARY
            <br />
            INTELLIGENCE
          </span>
        </a>
        <nav className={menu ? "open" : ""} aria-label="Site navigation">
          <a href="#worlds" onClick={() => setMenu(false)}>
            Our worlds
          </a>
          <a href="#capabilities" onClick={() => setMenu(false)}>
            Exploration
          </a>
          <a href="#sozo" onClick={() => setMenu(false)}>
            Meet SOZO
          </a>
          <a href="#data" onClick={() => setMenu(false)}>
            Data & provenance
          </a>
          <a href="/dashboard?view=developers">
            Developers
            <ArrowUpRight size={11} />
          </a>
        </nav>
        <div className="space-nav-actions">
          <a href="/login" className="nav-signin">
            Sign in
          </a>
          <a className="space-button primary compact" href="/dashboard">
            Launch workspace
            <ArrowUpRight size={14} />
          </a>
          <button
            className="space-menu"
            aria-label={menu ? "Close menu" : "Open menu"}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </header>
      <main id="space-main">
        <section className="space-hero">
          <div className="hero-starfield" aria-hidden="true" />
          <div className="hero-orbit" aria-hidden="true" />
          <div className="hero-planet-stage">
            <PlanetScene duo />
            <span className="planet-caption moon-caption">
              <i />
              01 / THE MOON<span>OUR NEAREST FRONTIER</span>
            </span>
            <span className="planet-caption mars-caption">
              <i />
              02 / MARS<span>A WORLD OF QUESTIONS</span>
            </span>
            <div className="hero-visual-label">
              NASA SOURCE IMAGERY · 3D VISUALIZATION
            </div>
          </div>
          <div className="space-hero-content">
            <span className="space-eyebrow">
              <i />
              CURIOSITY DOESN’T STOP AT EARTH
            </span>
            <h1>
              Two worlds.
              <br />
              One <span>limitless</span>
              <br />
              frontier<span className="heading-star">✳</span>
            </h1>
            <p>
              Explore the Moon. Investigate Mars.
              <br />
              Turn planetary evidence into your next discovery
              <br className="desktop-break" /> with SOZO and the MOMAR
              workspaces.
            </p>
            <div className="space-hero-buttons">
              <a href="/dashboard" className="space-button primary">
                Enter mission control
                <ArrowUpRight size={18} />
              </a>
              <a href="#worlds" className="space-button text">
                Explore our worlds
                <ArrowDown size={15} />
              </a>
            </div>
            <div className="hero-small-note">
              <span className="two-world-dots">
                <i />
                <i />
              </span>
              <span>For researchers. For explorers. For what comes next.</span>
            </div>
          </div>
          <a href="#worlds" className="hero-scroll">
            <span>SCROLL TO DISCOVER</span>
            <ArrowDown size={14} />
          </a>
          <div className="hero-bottom-coordinate">
            MOON + MARS<span>SCIENTIFIC OBSERVATION ZONE OPERATOR</span>
          </div>
        </section>
        <div className="space-capability-strip">
          <span>
            <ScanLine size={14} />
            Planetary data
          </span>
          <i>+</i>
          <span>
            <Sparkles size={14} />
            Scientific research
          </span>
          <i>+</i>
          <span>
            <Orbit size={14} />
            3D exploration
          </span>
          <i>+</i>
          <span>
            <Route size={14} />
            Mission planning
          </span>
          <i>+</i>
          <span>
            <Code2 size={14} />
            Open integrations
          </span>
        </div>
        <section className="space-section worlds-section" id="worlds">
          <div className="space-section-heading">
            <div>
              <span className="space-eyebrow">01 / CHOOSE YOUR FRONTIER</span>
              <h2>
                Familiar in the sky.
                <br />
                <span>Extraordinary up close.</span>
              </h2>
            </div>
            <p>
              From the shadows of the lunar south pole to the ancient landscapes
              of Mars. Two worlds, connected by a drive to understand.
            </p>
          </div>
          <div className="world-card-grid">
            <article className="world-card lunar">
              <div className="world-card-visual">
                <div className="world-orbit" />
                <div className="world-sphere moon" />
                <span className="world-index">01 / OUR NATURAL SATELLITE</span>
                <span className="world-distance">THE LUNAR FRONTIER</span>
              </div>
              <div className="world-card-content">
                <div className="world-title-row">
                  <h3>
                    The Moon<span>Selene. Luna. Our next chapter.</span>
                  </h3>
                  <a href="/dashboard?view=moon" aria-label="Explore the Moon">
                    <ArrowUpRight size={25} />
                  </a>
                </div>
                <p>
                  Investigate polar terrain, trace the light, and follow the
                  evidence for resources in the Moon’s most challenging
                  environments.
                </p>
                <div className="world-card-stats">
                  <span>
                    <strong>
                      ≈{number(lunar.areaKm2)}
                      <small>km²</small>
                    </strong>
                    <small>South-pole workspace</small>
                  </span>
                  <span>
                    <strong>
                      {(lunar.primaryCells / 1e6).toFixed(2)}
                      <small>M</small>
                    </strong>
                    <small>Primary terrain cells</small>
                  </span>
                  <span>
                    <strong>
                      {lunar.gridMeters}
                      <small>m</small>
                    </strong>
                    <small>Workspace grid</small>
                  </span>
                </div>
                <div className="world-card-bottom">
                  <span>
                    <i />
                    SHACKLETON · DE GERLACHE · HAWORTH
                  </span>
                  <a href="/dashboard?view=moon">
                    Explore the Moon
                    <ArrowUpRight size={14} />
                  </a>
                </div>
              </div>
            </article>
            <article className="world-card martian">
              <div className="world-card-visual">
                <div className="world-orbit" />
                <div className="world-sphere mars" />
                <span className="world-index">02 / THE RED PLANET</span>
                <span className="world-distance">THE MARTIAN FRONTIER</span>
              </div>
              <div className="world-card-content">
                <div className="world-title-row">
                  <h3>
                    Mars<span>Ancient landscapes. New possibilities.</span>
                  </h3>
                  <a href="/dashboard?view=mars" aria-label="Explore Mars">
                    <ArrowUpRight size={25} />
                  </a>
                </div>
                <p>
                  Explore Jezero and Gale. Connect geology, rover observations,
                  and terrain to the questions that drive planetary science.
                </p>
                <div className="world-card-stats">
                  <span>
                    <strong>
                      ≈{number(mars.areaKm2)}
                      <small>km²</small>
                    </strong>
                    <small>Detailed terrain</small>
                  </span>
                  <span>
                    <strong>
                      {(mars.primaryCells / 1e6).toFixed(2)}
                      <small>M</small>
                    </strong>
                    <small>Primary terrain cells</small>
                  </span>
                  <span>
                    <strong>
                      {mars.gridMeters}
                      <small>m</small>
                    </strong>
                    <small>Workspace grid</small>
                  </span>
                </div>
                <div className="world-card-bottom">
                  <span>
                    <i />
                    JEZERO CRATER · GALE CRATER
                  </span>
                  <a href="/dashboard?view=mars">
                    Explore Mars
                    <ArrowUpRight size={14} />
                  </a>
                </div>
              </div>
            </article>
          </div>
          <div className="worlds-footnote">
            <ShieldCheck size={13} />
            <span>
              MOMAR prototype coverage, as reported in the project brief. These
              are workspace figures, not terrain independently ingested or
              analysed by SOZO.
            </span>
            <a href="#data">
              Inspect the evidence
              <ArrowRight size={12} />
            </a>
          </div>
        </section>
        <section className="coverage-section" id="data">
          <div className="space-section-heading">
            <div>
              <span className="space-eyebrow">
                02 / THE EVIDENCE BENEATH EXPLORATION
              </span>
              <h2>
                Big worlds.
                <br />
                <span>Details that matter.</span>
              </h2>
            </div>
            <div className="coverage-tabs" aria-label="Coverage body">
              {(["moon", "mars"] as const).map((b) => (
                <button
                  key={b}
                  className={body === b ? "active" : ""}
                  aria-pressed={body === b}
                  onClick={() => setBody(b)}
                >
                  {b === "moon" ? "The Moon" : "Mars"}
                  <span>{b === "moon" ? "01" : "02"}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="coverage-meta">
            <span>
              <i />
              MOMAR PROTOTYPE / PROJECT-REPORTED
            </span>
            <span>BRIEF DATED 27 OCT 2026</span>
          </div>
          <div className="coverage-metrics">
            {(body === "moon"
              ? [
                  [
                    "≈" + number(lunar.areaKm2),
                    "km²",
                    "South-pole workspace",
                    "240 m grid, extending to ≈84°S",
                  ],
                  [
                    (lunar.primaryCells / 1e6).toFixed(2),
                    "M",
                    "Terrain cells analysed",
                    "Primary lunar workspace only",
                  ],
                  [
                    String(lunar.integratedOrDerivedSources),
                    "",
                    "Integrated or derived sources",
                    "7 additional sources reported as not yet available",
                  ],
                  [
                    number(lunar.namedFeatures),
                    "",
                    "IAU feature names",
                    `Plus ${lunar.locatedObjects} located human-made objects`,
                  ],
                ]
              : [
                  [
                    "≈" + number(mars.areaKm2),
                    "km²",
                    "Detailed terrain",
                    "Jezero + Gale · 20 m grid",
                  ],
                  [
                    (mars.primaryCells / 1e6).toFixed(2),
                    "M",
                    "Terrain cells analysed",
                    "Primary Mars workspaces",
                  ],
                  [
                    `${mars.sourceCounts.Jezero} / ${mars.sourceCounts.Gale}`,
                    "",
                    "Regional source counts",
                    "Jezero / Gale · overlapping inventories",
                  ],
                  [
                    number(mars.namedFeatures),
                    "",
                    "IAU feature names",
                    "Reported for the Mars globe",
                  ],
                ]
            ).map(([value, unit, label, detail]) => (
              <div key={label}>
                <strong>
                  {value}
                  <small>{unit}</small>
                </strong>
                <h3>{label}</h3>
                <p>{detail}</p>
              </div>
            ))}
          </div>
          <div className="coverage-integrity">
            <div>
              <span className="combined-symbol">⊕</span>
              <div>
                <strong>
                  Two worlds. ≈{(metrics.combinedPrimaryCells / 1e6).toFixed(2)}{" "}
                  million primary terrain cells.
                </strong>
                <p>
                  The grids are different: 20 m on Mars and 240 m in the lunar
                  workspace. The lunar 960 m far-field and 480 m Diviner grids
                  overlap it and are not counted.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowMethod(!showMethod)}
              aria-expanded={showMethod}
            >
              How the numbers work
              <ChevronRight size={15} className={showMethod ? "rotated" : ""} />
            </button>
          </div>
          {showMethod && (
            <div className="coverage-method">
              <p>{metrics.methodology}</p>
              <p>
                The lunar area is a square polar-stereographic workspace.
                Observations and effective resolution vary across it. Source
                labels, grid spacing, scientific resolution, and integration
                status are distinct. No independent recalculation of these
                project-reported counts has been performed by SOZO.
              </p>
              <a href={metrics.sourceUrl} target="_blank" rel="noreferrer">
                MOMAR source project
                <ExternalLink size={13} />
              </a>
            </div>
          )}
          <div className="dataset-ribbon">
            {datasets
              .filter((d) => d.body === body)
              .slice(0, 10)
              .map((d) => (
                <a href={`/dashboard?view=catalog&body=${body}`} key={d.id}>
                  {d.name}
                  <ArrowUpRight size={10} />
                </a>
              ))}
            <a
              className="catalog-link"
              href={`/dashboard?view=catalog&body=${body}`}
            >
              Inspect the full catalog
              <ArrowRight size={12} />
            </a>
          </div>
        </section>
        <section className="space-section capability-section" id="capabilities">
          <div className="space-section-heading">
            <div>
              <span className="space-eyebrow">03 / THE LUNAR WORKSPACE</span>
              <h2>
                Follow the terrain.
                <br />
                <span>Find the bigger picture.</span>
              </h2>
            </div>
            <div>
              <p>
                Six connected ways to investigate the lunar south pole and the
                whole Moon.
              </p>
              <span className="prototype-note">
                <i />
                WORKING IN THE MOMAR PROTOTYPE
              </span>
            </div>
          </div>
          <div className="lunar-feature-grid">
            {lunarCapabilities.map((feature) => (
              <article className="lunar-feature" key={feature.letter}>
                <a
                  href="https://www.momar.si/moon/south-pole/"
                  target="_blank"
                  rel="noreferrer"
                  className="feature-image-link"
                  aria-label={`See ${feature.title} in the MOMAR prototype`}
                >
                  <img
                    src={`/planetary/${feature.image}.webp`}
                    alt={`MOMAR lunar prototype: ${feature.title}`}
                    loading="lazy"
                  />
                  <span>
                    {feature.letter}
                    <ArrowUpRight size={17} />
                  </span>
                </a>
                <div className="feature-copy">
                  <span className="feature-kicker">{feature.subtitle}</span>
                  <h3>{feature.title}</h3>
                  <p>{feature.detail}</p>
                  <details className="feature-specifics">
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
          <div className="prototype-links">
            <p>
              These previews show the external MOMAR prototype. Its live terrain
              services are not yet connected to SOZO.
            </p>
            <a
              className="space-button secondary"
              href="https://www.momar.si/moon/south-pole/"
              target="_blank"
              rel="noreferrer"
            >
              Open lunar south pole
              <ArrowUpRight size={15} />
            </a>
            <a
              className="space-button text"
              href="https://www.momar.si/moon/"
              target="_blank"
              rel="noreferrer"
            >
              Or explore the whole Moon
              <ArrowUpRight size={13} />
            </a>
          </div>
        </section>
        <section className="sozo-section" id="sozo">
          <div className="sozo-intelligence">
            <span className="space-eyebrow">
              04 / THE INTELLIGENCE BETWEEN WORLDS
            </span>
            <h2>
              Meet your
              <br />
              scientific <span>copilot.</span>
            </h2>
            <p>
              SOZO brings the research together. Ask a question, discover
              scientific publications, keep the sources, and build a record of
              how you got there.
            </p>
            <div className="sozo-acronym">
              <span>SOZO</span>
              <div>
                SCIENTIFIC OBSERVATION
                <br />
                ZONE OPERATOR
              </div>
            </div>
            <a
              className="space-button primary"
              href="/dashboard?view=scientist"
            >
              Start an investigation
              <ArrowUpRight size={17} />
            </a>
            <span className="sozo-mode">
              Available now: live literature discovery & deterministic
              statistics.
              <br />
              Model-powered synthesis and live terrain tools are the next stage.
            </span>
          </div>
          <div className="research-preview">
            <div className="preview-top">
              <span>
                <img src="/sozo-mark.svg" alt="" />
                SOZO / RESEARCH WORKSPACE
              </span>
              <span className="preview-pill">EXAMPLE QUESTION</span>
            </div>
            <div className="preview-question">
              How might terrain and illumination affect a lunar rover mission?
            </div>
            <div className="preview-path">
              <span className="preview-step-number">01</span>
              <div>
                <strong>Start with a scientific question</strong>
                <p>Set a clear scope and select your research sources.</p>
              </div>
              <CheckMark />
            </div>
            <div className="preview-path">
              <span className="preview-step-number">02</span>
              <div>
                <strong>Follow the original evidence</strong>
                <p>
                  Inspect publication metadata, abstracts, and canonical links.
                </p>
              </div>
              <CheckMark />
            </div>
            <div className="preview-path">
              <span className="preview-step-number">03</span>
              <div>
                <strong>Keep a reproducible research record</strong>
                <p>
                  Save sources and notes. Export the report with its limits.
                </p>
              </div>
              <CheckMark />
            </div>
            <div className="preview-source-row">
              <span>Crossref</span>
              <span>Europe PMC</span>
              <span>Your notebook</span>
              <ArrowRight size={14} />
            </div>
            <a className="preview-bottom-link" href="/dashboard?view=scientist">
              Your next question belongs here
              <ArrowUpRight size={16} />
            </a>
          </div>
        </section>
        <section className="developer-landing">
          <div>
            <span className="space-eyebrow">05 / SCIENCE WITHOUT SILOS</span>
            <h2>
              Your tools.
              <br />
              <span>A wider universe.</span>
            </h2>
            <p>
              A versioned research API, a connector interface, and a real
              command-line client. Bring scientific discovery into your own
              workflow.
            </p>
            <a
              href="/dashboard?view=developers"
              className="space-button secondary"
            >
              Explore the developer platform
              <ArrowUpRight size={15} />
            </a>
          </div>
          <div className="landing-code">
            <div>
              <span />
              <span />
              <span />
              <small>SOZO / RESEARCH API</small>
            </div>
            <pre>
              <code>
                <span className="code-muted">
                  // A question. A source. A research record.
                </span>
                {"\n\n"}
                <span className="code-lime">POST</span> /api/v1/research{"\n\n"}
                {"{\n  "}
                <span className="code-light">"question"</span>
                {": "}
                <span className="code-warm">
                  "Lunar south-pole illumination"
                </span>
                {",\n  "}
                <span className="code-light">"sources"</span>
                {': ["crossref", "europepmc"],\n  '}
                <span className="code-light">"mode"</span>
                {': "broad"\n}'}
              </code>
            </pre>
            <a href="/openapi.json">
              View the OpenAPI specification
              <ArrowUpRight size={13} />
            </a>
          </div>
        </section>
        <section className="space-final-cta">
          <div className="cta-orbit" aria-hidden="true" />
          <span className="space-eyebrow">
            THE NEXT FRONTIER STARTS WITH A QUESTION
          </span>
          <h2>
            Stay curious.
            <br />
            <span>Go beyond.</span>
            <i>✳</i>
          </h2>
          <a className="space-button primary" href="/dashboard">
            Launch your workspace
            <ArrowUpRight size={18} />
          </a>
          <p>Two worlds to explore. A new way to connect the evidence.</p>
        </section>
      </main>
      <footer className="space-footer">
        <div className="space-footer-top">
          <a className="space-brand" href="/">
            <img src="/sozo-mark.svg" alt="" />
            <span>
              sozo<span className="brand-dot">.</span>
            </span>
          </a>
          <p>
            For the endlessly curious.
            <br />
            For the worlds beyond.
          </p>
          <div>
            <a href="#worlds">Moon & Mars</a>
            <a href="#sozo">SOZO</a>
            <a href="/dashboard?view=catalog">Data catalog</a>
            <a href="/dashboard?view=developers">API & developers</a>
            <a href="/login">
              Mission control
              <ArrowUpRight size={12} />
            </a>
          </div>
        </div>
        <div className="space-footer-bottom">
          <span>© 2026 SOZO · SCIENTIFIC OBSERVATION ZONE OPERATOR</span>
          <div>
            <a
              href="https://svs.gsfc.nasa.gov/4720/"
              target="_blank"
              rel="noreferrer"
            >
              Moon imagery: NASA SVS / LROC / LOLA
            </a>
            <a
              href="https://science.nasa.gov/3d-resources/mars/"
              target="_blank"
              rel="noreferrer"
            >
              Mars imagery: NASA/JPL-Caltech
            </a>
          </div>
        </div>
        <p className="imagery-credit">
          Globe imagery is used for visualization, not quantitative terrain
          analysis. Prototype screenshots: MOMAR. No NASA affiliation or
          endorsement is implied.
        </p>
      </footer>
    </div>
  );
}
function CheckMark() {
  return <span className="preview-check">↗</span>;
}
