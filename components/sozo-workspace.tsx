"use client";
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type FormEvent,
} from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  FlaskConical,
  LibraryBig,
  NotebookPen,
  Cable,
  Code2,
  Settings2,
  CircleHelp,
  X,
  Check,
  Clock3,
  BookOpen,
  Globe2,
  SlidersHorizontal,
  Paperclip,
  Menu,
  ArrowLeft,
  Download,
  Trash2,
  Loader2,
  Atom,
  Orbit,
  Leaf,
  Dna,
  Activity,
  ShieldCheck,
  Layers3,
  Folder,
  Bell,
  Beaker,
  LockKeyhole,
  AlertCircle,
  Sparkles,
  LogOut,
} from "lucide-react";
import SpaceArchive from "./space-archive";
import CompanionConsole from "./companion-console";
import ScientificArticles from "./scientific-articles";
import ScientificText from "./scientific-text";
import type { ResearchRun, Source, Project, Note } from "../lib/science/types";
import { api, download, date } from "../lib/client";
import {
  MissionOverview,
  PlanetaryExplorer,
  PlanetaryCatalog,
} from "./planetary-dashboard";
import {
  Status,
  Modal,
  PageHeading,
  SearchField,
  EmptyState,
  SourceCard,
  OrbitalArt,
} from "./sozo-ui";
import {
  Integrations,
  AnalysisLab,
  Developers,
  type Connector,
} from "./sozo-panels";
type View =
  | "companion"
  | "articles"
  | "overview"
  | "archive"
  | "scientist"
  | "moon"
  | "mars"
  | "catalog"
  | "research"
  | "library"
  | "notebook"
  | "integrations"
  | "developers"
  | "projects"
  | "analysis"
  | "run";
type Workspace = {
  user: { name: string; email: string; method?: string };
  projects: Project[];
  runs: ResearchRun[];
  notes: Note[];
  connectors: Connector[];
};
const initial: Workspace = {
  user: { name: "Researcher", email: "" },
  projects: [],
  runs: [],
  notes: [],
  connectors: [],
};
const domains = [
  "All sciences",
  "Planetary science",
  "Life sciences",
  "Climate & Earth",
  "Physics & materials",
];
const starters = [
  {
    domain: "Planetary science",
    title: "Beyond our world.",
    question: "How does Martian terrain influence rover exploration?",
    prompt: "Mars rover terrain slope route planning",
    Icon: Orbit,
    color: "orange",
    tag: "From the Moon to Mars",
  },
  {
    domain: "Planetary science",
    title: "Follow the light.",
    question: "What evidence supports ice stability near the lunar south pole?",
    prompt: "lunar south pole ice stability Diviner",
    Icon: Dna,
    color: "green",
    tag: "The permanently shadowed regions",
  },
  {
    domain: "Planetary science",
    title: "Read the terrain.",
    question: "How do LOLA elevation and slope data affect lunar route planning?",
    prompt: "LOLA lunar terrain slope resolution",
    Icon: Globe2,
    color: "blue",
    tag: "The lunar surface",
  },
  {
    domain: "Physics & materials",
    title: "Energy for the journey.",
    question: "How do Mars rover power systems constrain route planning?",
    prompt: "Mars rover battery energy route planning",
    Icon: Atom,
    color: "purple",
    tag: "Rover constraints, made explicit",
  },
];
const nav = [
  { view: "overview", label: "Mission overview", Icon: LayoutDashboard },
  { view: "moon", label: "Moon explorer", Icon: Orbit },
  { view: "mars", label: "Mars explorer", Icon: Globe2 },
  { view: "companion", label: "Talk with SOZO", Icon: Sparkles },
  { view: "articles", label: "Scientific articles", Icon: BookOpen },
  { view: "scientist", label: "SOZO scientist", Icon: Sparkles },
  { view: "catalog", label: "Data catalog", Icon: Layers3 },
  { view: "archive", label: "NASA space archive", Icon: Globe2 },
  { view: "research", label: "My research", Icon: FlaskConical },
  { view: "library", label: "Source library", Icon: LibraryBig },
  { view: "notebook", label: "Notebook", Icon: NotebookPen },
  { view: "analysis", label: "Analysis lab", Icon: Beaker },
  { view: "integrations", label: "Integrations", Icon: Cable },
  { view: "developers", label: "API & developers", Icon: Code2 },
] as const;
export default function SozoWorkspace() {
  const [view, setView] = useState<View>("overview");
  const [ws, setWS] = useState<Workspace>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [question, setQuestion] = useState("");
  const [domain, setDomain] = useState("Planetary science");
  const [mode, setMode] = useState("broad");
  const [sources, setSources] = useState(["crossref", "europepmc"]);
  const [submitting, setSubmitting] = useState(false);
  const [modal, setModal] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [run, setRun] = useState<ResearchRun | null>(null);
  const [runTab, setRunTab] = useState("overview");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [catalogBody, setCatalogBody] = useState("all");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectDesc, setProjectDesc] = useState("");
  const [projectColor, setProjectColor] = useState("lime");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [events, setEvents] = useState<
    { id: string; action: string; createdAt: string }[]
  >([]);
  const composer = useRef<HTMLTextAreaElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const notify = useCallback((v: string) => setToast(v), []);
  // Each view starts at its top rather than at the previous view's offset.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [view]);
  const refresh = useCallback(async () => {
    try {
      setWS(await api("workspace"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    refresh();
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("view");
    if (requested && nav.some((n) => n.view === requested))
      setView(requested as View);
    const body = params.get("body");
    if (body === "moon" || body === "mars") setCatalogBody(body);
    const q = params.get("question") || params.get("q");
    if (q) {
      setQuestion(q.slice(0, 1500));
      setView("scientist");
    }
  }, [refresh]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (run?.status !== "running") return;
    let stopped = false;
    const timer = setInterval(async () => {
      try {
        const d = await api(`research/${run.id}`);
        if (!stopped) {
          setRun(d.run);
          if (d.run.status !== "running") refresh();
        }
      } catch (e) {
        if (!stopped) notify((e as Error).message);
      }
    }, 1300);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [run?.id, run?.status, refresh, notify]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setView("research");
        setSearch("");
        setTimeout(
          () =>
            document
              .querySelector<HTMLInputElement>(".search-field input")
              ?.focus(),
          0,
        );
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const navigate = (v: View) => {
    setView(v);
    setSearch("");
    setFilter("all");
    setMobileNav(false);
    setProjectId(null);
  };
  const open = (m: string) => {
    setFormError("");
    setModal(m);
  };
  const newResearch = () => {
    setView("scientist");
    setQuestion("");
    setMobileNav(false);
    setTimeout(() => composer.current?.focus(), 30);
  };
  const starter = (i: number) => {
    setDomain(starters[i].domain);
    setQuestion(starters[i].prompt);
    setView("scientist");
    setModal("");
    setTimeout(() => {
      composer.current?.focus();
      composer.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 30);
  };
  const startResearch = async (
    text: string,
    options: { domain: string; mode: string; sources: string[] },
  ) => {
    if (text.trim().length < 5 || !options.sources.length) return;
    setSubmitting(true);
    try {
      const d = await api("research", {
        method: "POST",
        body: JSON.stringify({ question: text, ...options, projectId }),
      });
      setRun(d.run);
      setRunTab("overview");
      setView("run");
      refresh();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    return startResearch(question, { domain, mode, sources });
  };
  const openRun = (r: ResearchRun) => {
    setRun(r);
    setRunTab("overview");
    setView("run");
  };
  const remove = async (resource: string, id: string) => {
    try {
      await api(`${resource}/${id}`, { method: "DELETE" });
      refresh();
      notify("Removed from your workspace.");
      return true;
    } catch (e) {
      notify((e as Error).message);
      return false;
    }
  };
  const saveSource = async (s: Source) => {
    try {
      await api("notes", {
        method: "POST",
        body: JSON.stringify({
          title: s.title.slice(0, 300),
          content: `${s.authors}\n${s.journal} · ${s.year}\n\n${s.abstract || "No abstract supplied."}\n\nRetrieved from ${s.provider} on ${date(s.retrievedAt)}.`,
          sourceUrl: s.url,
        }),
      });
      refresh();
      notify("Source saved to your notebook.");
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const allSources = [
    ...new Map(
      ws.runs
        .flatMap((r) => r.result?.citations ?? [])
        .map((s) => [s.doi || s.url, s]),
    ).values(),
  ];
  const project = ws.projects.find((p) => p.id === projectId);
  const filteredRuns = ws.runs.filter(
    (r) =>
      (!projectId || r.projectId === projectId) &&
      (filter === "all" || r.status === filter) &&
      r.question.toLowerCase().includes(search.toLowerCase()),
  );
  const title =
    view === "run"
      ? "Research workspace"
      : project?.name || nav.find((n) => n.view === view)?.label || "Projects";
  const exportRun = (format: "md" | "json") => {
    if (!run) return;
    if (format === "json")
      download(`sozo-${run.id}.json`, JSON.stringify(run, null, 2));
    else
      download(
        "sozo-research.md",
        `# ${run.question}\n\n${run.result?.answer || run.error || run.status}\n\n## Sources\n\n${run.result?.citations.map((s) => `### [${s.id}] ${s.title}\n${s.authors} (${s.year})\n${s.url}\n\n${s.abstract}\n`).join("\n") || ""}\n## Limitations\n\n${run.result?.limitations.map((l) => `- ${l}`).join("\n") || ""}\n\nRetrieved ${run.createdAt}`,
        "text/markdown",
      );
  };
  const sourceCards = (items: Source[]) => (
    <div className="source-grid">
      {items.map((s) => (
        <SourceCard
          key={s.doi || s.url}
          source={s}
          onSave={saveSource}
          saved={ws.notes.some((n) => n.sourceUrl === s.url)}
        />
      ))}
    </div>
  );
  const runRows = (items: ResearchRun[]) => (
    <div className="run-list">
      {items.map((r) => (
        <button key={r.id} className="run-row" onClick={() => openRun(r)}>
          <span className="run-icon">
            <FlaskConical size={18} />
          </span>
          <div>
            <strong>{r.question}</strong>
            <small>
              {r.domain}
              <span>·</span>
              {date(r.createdAt)}
              <span>·</span>
              {r.result?.citations.length || 0} sources
            </small>
          </div>
          <Status status={r.status} />
          <ArrowUpRight className="row-arrow" size={17} />
        </button>
      ))}
    </div>
  );

  return (
    <div className="app-shell">
      {mobileNav && (
        <button
          className="nav-backdrop"
          onClick={() => setMobileNav(false)}
          aria-label="Close navigation"
        />
      )}
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <button
          className="brand"
          onClick={() => navigate("overview")}
          aria-label="SOZO home"
        >
          <img src="/sozo-mark.svg" alt="" />
          <span>
            sozo<span className="brand-period">.</span>
          </span>
        </button>
        <div className="workspace-switch">
          <span className="workspace-glyph">
            <Orbit size={17} />
          </span>
          <div>
            <strong>Mission workspace</strong>
            <span>The Moon. Mars. Beyond.</span>
          </div>
          <button
            onClick={() => open("settings")}
            aria-label="Workspace settings"
          >
            <ChevronDown size={14} />
          </button>
        </div>
        <button className="new-research" onClick={newResearch}>
          <Plus size={17} />
          <span>New research</span>
          <span className="keyboard-symbol">↗</span>
        </button>
        <div className="nav-caption">YOUR WORKSPACE</div>
        <nav aria-label="Main navigation">
          {nav.map(({ view: v, label, Icon }) => (
            <button
              key={v}
              className={`nav-item ${view === v && !projectId ? "active" : ""}`}
              aria-current={view === v && !projectId ? "page" : undefined}
              onClick={() => navigate(v)}
            >
              <Icon size={17} />
              <span>{label}</span>
              {v === "research" && ws.runs.length > 0 && (
                <span className="nav-count">{ws.runs.length}</span>
              )}
              {v === "integrations" && <span className="nav-tiny-dot" />}
            </button>
          ))}
        </nav>
        <div className="projects-caption">
          <button onClick={() => navigate("projects")}>PROJECTS</button>
          <button onClick={() => open("project")} aria-label="Create project">
            <Plus size={15} />
          </button>
        </div>
        <div className="sidebar-projects">
          {ws.projects.slice(0, 5).map((p) => (
            <button
              key={p.id}
              className={`project-link ${projectId === p.id ? "selected" : ""}`}
              onClick={() => {
                setProjectId(p.id);
                setView("research");
                setMobileNav(false);
              }}
            >
              <span className={`project-dot ${p.color}`} />
              <span>{p.name}</span>
            </button>
          ))}
          {!ws.projects.length && (
            <button
              className="add-first-project"
              onClick={() => open("project")}
            >
              <Folder size={14} />
              Create your first project
            </button>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <div className="note-spark">✳</div>
            <p>
              A little curiosity.
              <br />
              <span>Infinite possibility.</span>
            </p>
            <button onClick={() => open("guide")}>
              Meet your workspace
              <ArrowUpRight size={13} />
            </button>
          </div>
          <div className="sidebar-help">
            <button onClick={() => open("guide")}>
              <CircleHelp size={15} />
              Help & getting started
            </button>
            <button onClick={() => open("settings")} aria-label="Settings">
              <Settings2 size={16} />
            </button>
          </div>
          <button className="profile" onClick={() => open("settings")}>
            <span className="avatar">
              {ws.user.name.charAt(0).toUpperCase()}
              <i />
            </span>
            <span>
              <strong>{ws.user.name}</strong>
              <small>Research workspace</small>
            </span>
            <ChevronDown size={14} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMobileNav(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <span className="breadcrumb-home">
              <LayoutDashboard size={15} />
              Workspace
            </span>
            <ChevronRight size={12} />
            <strong>{title}</strong>
          </div>
          <div className="topbar-right">
            <span className="system-status">
              <i />
              Evidence-first. Always.
            </span>
            <span className="header-divider" />
            <button
              className="icon-button"
              aria-label="Workspace activity"
              onClick={() => {
                open("activity");
                api("audit")
                  .then((d) => setEvents(d.events))
                  .catch((e) => notify(e.message));
              }}
            >
              <Bell size={17} />
            </button>
            <button
              className="icon-button help-icon"
              onClick={() => open("guide")}
              aria-label="Quick guide"
            >
              <CircleHelp size={18} />
            </button>
            <button
              className="top-avatar"
              aria-label="Your account"
              onClick={() => open("settings")}
            >
              {ws.user.name.charAt(0).toUpperCase()}
            </button>
          </div>
        </header>
        <main className="main-content">
          {error && (
            <div className="workspace-banner">
              <AlertCircle size={16} />
              <span>{error}</span>
              {error.includes("Sign in") ? (
                <a href="/login?returnTo=%2Fdashboard" target="_top">
                  Sign in
                  <ArrowUpRight size={14} />
                </a>
              ) : (
                <button onClick={refresh}>Try again</button>
              )}
            </div>
          )}
          {view === "overview" && (
            <MissionOverview
              runs={ws.runs}
              userName={ws.user.name}
              launching={submitting}
              onLaunch={(text, depth) => {
                setQuestion(text);
                setMode(depth);
                void startResearch(text, {
                  domain: "Planetary science",
                  mode: depth,
                  sources: ["crossref", "europepmc"],
                });
              }}
              onCompanion={() => navigate("companion")}
              onExplore={(body) => navigate(body)}
              onResearch={(q) => {
                setQuestion(q);
                setDomain("Planetary science");
                setView("scientist");
              }}
              onOpen={openRun}
              onCatalog={() => navigate("catalog")}
            />
          )}
          {(view === "moon" || view === "mars") && (
            <PlanetaryExplorer
              key={view}
              body={view}
              onResearch={(q) => {
                setQuestion(q);
                setDomain("Planetary science");
                setView("scientist");
              }}
            />
          )}
          {view === "archive" && <SpaceArchive />}
          {view === "companion" && <CompanionConsole />}
          {view === "articles" && <ScientificArticles />}
          {view === "catalog" && (
            <PlanetaryCatalog initialBody={catalogBody} key={catalogBody} />
          )}
          {view === "scientist" && (
            <>
              <section className="hero">
                <div className="hero-copy">
                  <div className="eyebrow">
                    <span />A WORKSPACE FOR WHAT COMES NEXT
                  </div>
                  <h1>
                    Big questions.
                    <br />
                    Brighter discoveries<span className="hero-period">.</span>
                  </h1>
                  <p>
                    Bring your curiosity. Connect the evidence.
                    <br />
                    Make room for your next breakthrough.
                  </p>
                </div>
                <OrbitalArt />
              </section>
              <div className="research-grid">
                <div>
                  <form className="composer" onSubmit={submit}>
                    <div className="composer-heading">
                      <span className="composer-spark">
                        <Sparkles size={18} />
                      </span>
                      <span>What will you discover today?</span>
                      <span className="composer-label">RESEARCH</span>
                    </div>
                    <textarea
                      ref={composer}
                      aria-label="Research question"
                      placeholder="Ask a scientific question, explore a hypothesis, or follow an idea…"
                      value={question}
                      maxLength={1500}
                      onChange={(e) => setQuestion(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                          submit();
                      }}
                    />
                    <div className="composer-toolbar">
                      <div className="composer-options">
                        <label className="composer-select">
                          <Globe2 size={14} />
                          <select
                            aria-label="Research discipline"
                            value={domain}
                            onChange={(e) => setDomain(e.target.value)}
                          >
                            {domains.map((d) => (
                              <option key={d}>{d}</option>
                            ))}
                          </select>
                          <ChevronDown size={12} />
                        </label>
                        <label className="composer-select mode-select">
                          <SlidersHorizontal size={14} />
                          <select
                            aria-label="Search depth"
                            value={mode}
                            onChange={(e) => setMode(e.target.value)}
                          >
                            <option value="broad">Broad discovery</option>
                            <option value="focused">Focused search</option>
                          </select>
                          <ChevronDown size={12} />
                        </label>
                      </div>
                      <button
                        className="primary-button research-submit"
                        disabled={
                          submitting ||
                          question.trim().length < 5 ||
                          !sources.length
                        }
                      >
                        {submitting ? (
                          <Loader2 className="spin" size={15} />
                        ) : (
                          <>
                            <span>Start research</span>
                            <ArrowUpRight size={16} />
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                  <div className="composer-under">
                    <span>
                      <LockKeyhole size={12} />
                      Private by default. Grounded in sources.
                    </span>
                    <button onClick={() => open("sources")}>
                      <span className="tiny-green-dot" />
                      {sources.length} sources selected
                      <ChevronDown size={12} />
                    </button>
                  </div>
                  <div className="prompt-suggestions">
                    <span>A little inspiration</span>
                    <button onClick={() => starter(0)}>
                      Explore Mars
                      <ArrowUpRight size={12} />
                    </button>
                    <button onClick={() => starter(1)}>
                      Lunar ice evidence
                      <ArrowUpRight size={12} />
                    </button>
                    <button onClick={() => starter(2)}>
                      Lunar terrain
                      <ArrowUpRight size={12} />
                    </button>
                  </div>
                </div>
                <aside className="knowledge-card">
                  <div className="section-eyebrow">
                    A WORLD OF KNOWLEDGE
                    <Cable size={14} />
                  </div>
                  <h3>
                    Great research
                    <br />
                    starts at the source.
                  </h3>
                  <div className="knowledge-source">
                    <span className="source-logo crossref">
                      c<span>r</span>
                    </span>
                    <div>
                      <strong>Crossref</strong>
                      <small>Scientific literature</small>
                    </div>
                    <span className="tiny-green-dot" />
                  </div>
                  <div className="knowledge-source">
                    <span className="source-logo epmc">
                      <Leaf size={20} />
                    </span>
                    <div>
                      <strong>Europe PMC</strong>
                      <small>Life sciences & biomedicine</small>
                    </div>
                    <span className="tiny-green-dot" />
                  </div>
                  <button
                    className="text-button"
                    onClick={() => navigate("integrations")}
                  >
                    Explore integrations
                    <ArrowRight size={14} />
                  </button>
                </aside>
              </div>
              <section className="directions-section">
                <div className="section-header">
                  <div>
                    <h2>Follow your curiosity</h2>
                    <p>Different disciplines. Endless directions.</p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => open("disciplines")}
                  >
                    Explore all disciplines
                    <ArrowUpRight size={14} />
                  </button>
                </div>
                <div className="starter-grid">
                  {starters.map((s, i) => (
                    <button
                      key={s.domain}
                      className={`starter-card ${s.color}`}
                      onClick={() => starter(i)}
                    >
                      <div className="starter-top">
                        <span>{s.domain}</span>
                        <s.Icon size={28} strokeWidth={1.1} />
                      </div>
                      <h3>{s.title}</h3>
                      <p>{s.question}</p>
                      <div className="starter-bottom">
                        <span>{s.tag}</span>
                        <span className="starter-arrow">
                          <ArrowUpRight size={16} />
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
              <section className="recent-section">
                <div className="section-header">
                  <div>
                    <h2>
                      Your recent research
                      <span className="heading-count">
                        {ws.runs.length.toString().padStart(2, "0")}
                      </span>
                    </h2>
                    <p>Pick up a thought. Take it somewhere new.</p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => navigate("research")}
                  >
                    View all research
                    <ArrowRight size={14} />
                  </button>
                </div>
                {ws.runs.length ? (
                  runRows(ws.runs.slice(0, 3))
                ) : (
                  <div className="recent-empty">
                    <div className="empty-research-icon">
                      <FlaskConical size={24} strokeWidth={1.2} />
                      <span>✦</span>
                    </div>
                    <div>
                      <h3>Your next idea belongs here.</h3>
                      <p>Start a question and build a trail of discovery.</p>
                    </div>
                    <button
                      className="secondary-button"
                      onClick={() => composer.current?.focus()}
                    >
                      Start your first research
                      <ArrowUpRight size={14} />
                    </button>
                  </div>
                )}
              </section>
              <footer className="workspace-footer">
                <span>
                  <img src="/sozo-mark.svg" alt="" />
                  Made for curious minds.
                </span>
                <span>
                  Explore thoughtfully. Discover responsibly.
                  <span className="footer-star">✳</span>
                </span>
              </footer>
            </>
          )}
          {view === "research" && (
            <>
              <PageHeading
                eyebrow={project ? "RESEARCH PROJECT" : "YOUR WORKSPACE"}
                title={project?.name || "A trail of discovery."}
                description={
                  project?.description ||
                  "Every question, every source, every step forward."
                }
              >
                <button className="primary-button" onClick={newResearch}>
                  <Plus size={16} />
                  New research
                </button>
              </PageHeading>
              <div className="collection-toolbar">
                <div className="filter-tabs">
                  {[
                    ["all", "All research"],
                    ["completed", "Completed"],
                    ["running", "In progress"],
                    ["partial", "Partial"],
                  ].map(([v, label]) => (
                    <button
                      key={v}
                      className={filter === v ? "active" : ""}
                      onClick={() => setFilter(v)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <SearchField
                  value={search}
                  onChange={setSearch}
                  placeholder="Search your research…"
                />
              </div>
              {loading ? (
                <div className="loading-state">
                  <Loader2 className="spin" />
                  Opening your workspace…
                </div>
              ) : filteredRuns.length ? (
                runRows(filteredRuns)
              ) : (
                <EmptyState
                  icon={<FlaskConical size={36} strokeWidth={1.1} />}
                  title={
                    search || filter !== "all"
                      ? "No research matches this view."
                      : "A question is a great beginning."
                  }
                  description="Your research will appear here, with sources and a complete record."
                  action="Start a research question"
                  onAction={newResearch}
                />
              )}
            </>
          )}
          {view === "library" && (
            <>
              <PageHeading
                eyebrow="YOUR EVIDENCE, CONNECTED"
                title="A library of possibility."
                description="The scientific sources behind your research, all in one place."
              >
                <span className="outline-tag">
                  <BookOpen size={14} />
                  {allSources.length} unique sources
                </span>
              </PageHeading>
              <div className="collection-toolbar">
                <span className="small muted">
                  Collected from your research runs
                </span>
                <SearchField
                  value={search}
                  onChange={setSearch}
                  placeholder="Find a publication…"
                />
              </div>
              {allSources.length ? (
                sourceCards(
                  allSources.filter((s) =>
                    `${s.title} ${s.authors} ${s.journal}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  ),
                )
              ) : (
                <EmptyState
                  icon={<LibraryBig size={36} strokeWidth={1.1} />}
                  title="Good evidence is worth keeping."
                  description="Run your first question to collect real scientific publications here."
                  action="Discover sources"
                  onAction={newResearch}
                />
              )}
            </>
          )}
          {view === "notebook" && (
            <>
              <PageHeading
                eyebrow="THOUGHTS WORTH KEEPING"
                title="Room for your ideas."
                description="Save a source, capture a thought, connect the dots."
              >
                <button
                  className="secondary-button"
                  onClick={() => importRef.current?.click()}
                >
                  <Paperclip size={15} />
                  Import note
                </button>
                <button
                  className="primary-button"
                  onClick={() => {
                    setNoteTitle("");
                    setNoteContent("");
                    open("note");
                  }}
                >
                  <Plus size={16} />
                  New note
                </button>
              </PageHeading>
              <div className="collection-toolbar">
                <span className="small muted">
                  {ws.notes.length} notes in your notebook
                </span>
                <SearchField
                  value={search}
                  onChange={setSearch}
                  placeholder="Search your notes…"
                />
              </div>
              {ws.notes.length ? (
                <div className="notes-grid">
                  {ws.notes
                    .filter((n) =>
                      `${n.title} ${n.content}`
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                    )
                    .map((n) => (
                      <article className="note-card" key={n.id}>
                        <span className="section-eyebrow">
                          {n.sourceUrl ? "SAVED SOURCE" : "RESEARCH NOTE"}
                          <NotebookPen size={15} />
                        </span>
                        <button
                          className="note-open"
                          onClick={() => {
                            setSelectedNote(n);
                            open("read-note");
                          }}
                        >
                          <h3>{n.title}</h3>
                          <p>{n.content}</p>
                        </button>
                        <div className="note-footer">
                          <span>{date(n.createdAt)}</span>
                          <button
                            className="icon-button"
                            aria-label={`Delete ${n.title}`}
                            onClick={() => remove("notes", n.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </article>
                    ))}
                </div>
              ) : (
                <EmptyState
                  icon={<NotebookPen size={36} strokeWidth={1.1} />}
                  title="Give your thoughts a home."
                  description="Keep research notes and save useful publication abstracts as you explore."
                  action="Write your first note"
                  onAction={() => open("note")}
                />
              )}
            </>
          )}
          {view === "projects" && (
            <>
              <PageHeading
                eyebrow="MAKE SPACE FOR BIG IDEAS"
                title="Connected by a question."
                description="Organize your research around the things that matter to you."
              >
                <button
                  className="primary-button"
                  onClick={() => open("project")}
                >
                  <Plus size={16} />
                  New project
                </button>
              </PageHeading>
              {ws.projects.length ? (
                <div className="projects-grid">
                  {ws.projects.map((p) => (
                    <article className="project-card" key={p.id}>
                      <div>
                        <span className={`project-folder ${p.color}`}>
                          <Folder size={23} />
                        </span>
                        <button
                          className="icon-button"
                          aria-label={`Delete project ${p.name}`}
                          onClick={() => remove("projects", p.id)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      <button
                        onClick={() => {
                          setProjectId(p.id);
                          setView("research");
                        }}
                      >
                        <h3>{p.name}</h3>
                        <p>
                          {p.description || "A space for your next discovery."}
                        </p>
                        <span>
                          {ws.runs.filter((r) => r.projectId === p.id).length}{" "}
                          research runs
                          <ArrowUpRight size={16} />
                        </span>
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<Folder size={36} strokeWidth={1.1} />}
                  title="One idea. A whole new direction."
                  description="Create a project to keep related questions and research together."
                  action="Create your first project"
                  onAction={() => open("project")}
                />
              )}
            </>
          )}
          {view === "integrations" && (
            <Integrations
              connectors={ws.connectors}
              notify={notify}
              refresh={refresh}
            />
          )}
          {view === "analysis" && <AnalysisLab />}
          {view === "developers" && <Developers notify={notify} />}
          {view === "run" && run && (
            <div className="run-detail">
              <button
                className="text-button back-button"
                onClick={() => navigate("research")}
              >
                <ArrowLeft size={15} />
                Back to my research
              </button>
              <div className="run-detail-top">
                <span className="eyebrow">{run.domain}</span>
                <Status status={run.status} />
              </div>
              <h1>{run.question}</h1>
              <div className="run-detail-meta">
                <span>
                  <Clock3 size={13} />
                  {date(run.createdAt)}
                </span>
                <span>
                  <Globe2 size={13} />
                  {run.sources
                    .map((s) => (s === "crossref" ? "Crossref" : "Europe PMC"))
                    .join(" + ")}
                </span>
                <span>
                  <ShieldCheck size={13} />
                  Literature discovery
                </span>
              </div>
              <div className="run-detail-actions">
                {run.status === "running" ? (
                  <button
                    className="secondary-button"
                    onClick={async () => {
                      try {
                        const d = await api(`research/${run.id}/cancel`, {
                          method: "POST",
                          body: "{}",
                        });
                        setRun({ ...run, status: d.status });
                        refresh();
                      } catch (e) {
                        notify((e as Error).message);
                      }
                    }}
                  >
                    Cancel research
                    <X size={14} />
                  </button>
                ) : (
                  <>
                    <button
                      className="secondary-button"
                      onClick={() => exportRun("md")}
                    >
                      <Download size={14} />
                      Export report
                    </button>
                    <button
                      className="secondary-button"
                      onClick={() => exportRun("json")}
                    >
                      <Code2 size={14} />
                      JSON
                    </button>
                    <button
                      className="text-button"
                      onClick={() => {
                        setQuestion(run.question);
                        setDomain(run.domain);
                        setView("scientist");
                      }}
                    >
                      Research again
                      <ArrowUpRight size={14} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label="Delete research"
                      onClick={async () => {
                        if (await remove("research", run.id))
                          navigate("research");
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                )}
              </div>
              <div className="filter-tabs dev-tabs">
                {[
                  ["overview", "Overview"],
                  ["sources", `Sources ${run.result?.citations.length ?? ""}`],
                  ["activity", "Research activity"],
                ].map(([v, label]) => (
                  <button
                    key={v}
                    className={runTab === v ? "active" : ""}
                    onClick={() => setRunTab(v)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {run.status === "running" && (
                <div className="research-working">
                  <span className="working-orbit">
                    <Orbit size={38} strokeWidth={1} />
                  </span>
                  <h3>Following the evidence.</h3>
                  <p>
                    Searching your selected scientific sources.
                    <br />
                    Your question and progress are saved automatically.
                  </p>
                  <div className="working-steps">
                    {run.progress.map((p, i) => (
                      <span key={i}>
                        <Check size={13} />
                        {p.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {run.error && (
                <div className="info-callout warning">
                  <AlertCircle size={19} />
                  <div>
                    <strong>Research needs another look.</strong>
                    <p>{run.error}</p>
                  </div>
                </div>
              )}
              {run.status === "cancelled" && (
                <div className="info-callout">
                  <CircleHelp size={19} />
                  <div>
                    <strong>Research cancelled.</strong>
                    <p>You can start a new search whenever you are ready.</p>
                  </div>
                </div>
              )}
              {run.result && runTab === "overview" && (
                <>
                  <div className="result-metrics">
                    <div>
                      <span>Publications retrieved</span>
                      <strong>
                        {run.result.citations.length}
                        <BookOpen size={19} />
                      </strong>
                    </div>
                    <div>
                      <span>Abstracts available</span>
                      <strong>
                        {run.result.findings.length}
                        <NotebookPen size={19} />
                      </strong>
                    </div>
                    <div>
                      <span>Source retrieval time</span>
                      <strong>
                        {(run.result.usage.durationMs / 1000).toFixed(1)}
                        <small>sec</small>
                        <Clock3 size={19} />
                      </strong>
                    </div>
                  </div>
                  <article className="result-summary panel">
                    <span className="section-eyebrow">
                      RESEARCH OVERVIEW
                      <FlaskConical size={16} />
                    </span>
                    <h2>A starting point for understanding.</h2>
                    <ScientificText text={run.result.answer} sources={run.result.citations} />
                    <div className="provider-results">
                      {run.result.providerStatus.map((p) => (
                        <span key={p.name} className={p.ok ? "ok" : "bad"}>
                          {p.ok ? (
                            <Check size={13} />
                          ) : (
                            <AlertCircle size={13} />
                          )}{" "}
                          {p.name} ·{" "}
                          {p.ok ? `${p.count} publications` : "Unavailable"}
                        </span>
                      ))}
                    </div>
                  </article>
                  <h3 className="subsection-heading">
                    Start with the sources<span>Metadata relevance rules</span>
                  </h3>
                  {sourceCards(run.result.citations.slice(0, 4))}
                  {run.result.citations.length > 4 && (
                    <button
                      className="secondary-button all-sources-button"
                      onClick={() => setRunTab("sources")}
                    >
                      View all {run.result.citations.length} sources
                      <ArrowRight size={15} />
                    </button>
                  )}
                  <div className="limitations">
                    <h3>
                      <ShieldCheck size={17} />
                      What this research can tell you
                    </h3>
                    {run.result.limitations.map((l, i) => (
                      <p key={i}>{l}</p>
                    ))}
                  </div>
                </>
              )}
              {run.result &&
                runTab === "sources" &&
                sourceCards(run.result.citations)}
              {runTab === "activity" && (
                <div className="timeline">
                  {run.progress.map((p, i) => (
                    <div key={i}>
                      <span>
                        <Check size={14} />
                      </span>
                      <div>
                        <strong>{p.label}</strong>
                        <small>{new Date(p.at).toLocaleTimeString()}</small>
                      </div>
                    </div>
                  ))}
                  <p className="small muted">Research ID: {run.id}</p>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
      <input
        ref={importRef}
        type="file"
        accept=".txt,.md"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          if (file.size > 20000) {
            notify("Import a text or Markdown file smaller than 20 KB.");
            return;
          }
          try {
            await api("notes", {
              method: "POST",
              body: JSON.stringify({
                title: file.name.slice(0, 300),
                content: await file.text(),
              }),
            });
            refresh();
            notify("Imported into your notebook.");
          } catch (e) {
            notify((e as Error).message);
          }
          e.target.value = "";
        }}
      />
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          <span>{toast}</span>
          <button
            onClick={() => setToast("")}
            aria-label="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
      )}
      {modal === "project" && (
        <Modal title="Make room for a new idea." onClose={() => setModal("")}>
          <p className="modal-description">
            A project brings related research questions together.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const d = await api("projects", {
                  method: "POST",
                  body: JSON.stringify({
                    name: projectName,
                    description: projectDesc,
                    color: projectColor,
                  }),
                });
                await refresh();
                setModal("");
                setProjectId(d.project.id);
                setView("research");
                setProjectName("");
                setProjectDesc("");
                notify("Your project is ready.");
              } catch (e) {
                setFormError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="field-label" htmlFor="project-name">
              Project name
            </label>
            <input
              id="project-name"
              autoFocus
              required
              maxLength={100}
              placeholder="e.g. Beyond Earth"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
            />
            <label className="field-label" htmlFor="project-desc">
              A little context <span>(optional)</span>
            </label>
            <textarea
              id="project-desc"
              rows={3}
              maxLength={500}
              placeholder="What would you like to explore?"
              value={projectDesc}
              onChange={(e) => setProjectDesc(e.target.value)}
            />
            <label className="field-label">Project color</label>
            <div className="color-options">
              {["lime", "blue", "purple", "orange"].map((c) => (
                <button
                  type="button"
                  key={c}
                  className={`color-swatch ${c} ${projectColor === c ? "selected" : ""}`}
                  onClick={() => setProjectColor(c)}
                  aria-label={`${c} project color`}
                  aria-pressed={projectColor === c}
                >
                  {projectColor === c && <Check size={15} />}
                </button>
              ))}
            </div>
            {formError && <p className="form-error">{formError}</p>}
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setModal("")}
              >
                Cancel
              </button>
              <button className="primary-button" disabled={busy}>
                <Plus size={15} />
                Create project
              </button>
            </div>
          </form>
        </Modal>
      )}
      {modal === "sources" && (
        <Modal
          title="Choose where curiosity takes you."
          onClose={() => setModal("")}
        >
          <p className="modal-description">
            Broad discovery retrieves up to 8 results per source; focused search
            retrieves up to 4.
          </p>
          {[
            [
              "crossref",
              "Crossref",
              "Multidisciplinary publication metadata and DOI records",
            ],
            [
              "europepmc",
              "Europe PMC",
              "Life sciences, biomedical publications, and abstracts",
            ],
          ].map(([id, name, detail]) => (
            <label className="source-choice" key={id}>
              <span>
                <strong>{name}</strong>
                <small>{detail}</small>
              </span>
              <input
                type="checkbox"
                checked={sources.includes(id)}
                onChange={(e) =>
                  setSources((s) =>
                    e.target.checked ? [...s, id] : s.filter((x) => x !== id),
                  )
                }
              />
            </label>
          ))}
          {ws.projects.length > 0 && (
            <>
              <label className="field-label">Save research to project</label>
              <select
                className="field-select"
                value={projectId || ""}
                onChange={(e) => setProjectId(e.target.value || null)}
              >
                <option value="">Personal research</option>
                {ws.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </>
          )}
          <div className="modal-actions">
            <button
              className="primary-button"
              disabled={!sources.length}
              onClick={() => setModal("")}
            >
              Save preferences
              <Check size={15} />
            </button>
          </div>
        </Modal>
      )}
      {modal === "note" && (
        <Modal title="Capture a thought." onClose={() => setModal("")}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await api("notes", {
                  method: "POST",
                  body: JSON.stringify({
                    title: noteTitle,
                    content: noteContent,
                  }),
                });
                await refresh();
                setModal("");
                setNoteTitle("");
                setNoteContent("");
                notify("Note saved.");
              } catch (e) {
                setFormError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="field-label" htmlFor="note-title">
              Title
            </label>
            <input
              id="note-title"
              autoFocus
              required
              maxLength={300}
              placeholder="An idea worth keeping…"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
            />
            <label className="field-label" htmlFor="note-content">
              Your note
            </label>
            <textarea
              id="note-content"
              rows={8}
              maxLength={20000}
              placeholder="A thought, a connection, a question for later…"
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
            />
            {formError && <p className="form-error">{formError}</p>}
            <div className="modal-actions">
              <button className="primary-button" disabled={busy}>
                <NotebookPen size={15} />
                Save note
              </button>
            </div>
          </form>
        </Modal>
      )}
      {modal === "read-note" && selectedNote && (
        <Modal title={selectedNote.title} wide onClose={() => setModal("")}>
          <div className="read-note-content">{selectedNote.content}</div>
          {selectedNote.sourceUrl && (
            <a
              className="text-button"
              href={selectedNote.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open original source
              <ArrowUpRight size={14} />
            </a>
          )}
          <div className="modal-actions">
            <button
              className="secondary-button"
              onClick={() =>
                download(
                  "sozo-note.md",
                  `# ${selectedNote.title}\n\n${selectedNote.content}\n\n${selectedNote.sourceUrl || ""}`,
                  "text/markdown",
                )
              }
            >
              <Download size={15} />
              Export note
            </button>
          </div>
        </Modal>
      )}
      {modal === "disciplines" && (
        <Modal
          title="Where will curiosity take you?"
          onClose={() => setModal("")}
        >
          <div className="discipline-options">
            {starters.map((s, i) => (
              <button key={s.domain} onClick={() => starter(i)}>
                <s.Icon size={23} />
                <span>
                  <strong>{s.domain}</strong>
                  <small>{s.tag}</small>
                </span>
                <ArrowUpRight size={17} />
              </button>
            ))}
          </div>
        </Modal>
      )}
      {modal === "guide" && (
        <Modal
          title="A workspace for your curious mind."
          onClose={() => setModal("")}
        >
          <div className="guide-brand">
            <img src="/sozo-mark.svg" alt="SOZO symbol" />
            <span>sozo.</span>
          </div>
          <p className="modal-description">
            Find scientific literature, follow the sources, and build a lasting
            research record.
          </p>
          <div className="guide-steps">
            <div>
              <Globe2 size={20} />
              <span>
                <strong>Ask a question.</strong>
                <p>
                  Start with specific scientific terms and choose your sources.
                </p>
              </span>
            </div>
            <div>
              <BookOpen size={20} />
              <span>
                <strong>Follow the evidence.</strong>
                <p>
                  Inspect real publication metadata and abstracts, with links to
                  the originals.
                </p>
              </span>
            </div>
            <div>
              <NotebookPen size={20} />
              <span>
                <strong>Connect your thinking.</strong>
                <p>
                  Save sources, capture notes, and organize questions into
                  projects.
                </p>
              </span>
            </div>
          </div>
          <div className="info-callout">
            <CircleHelp size={18} />
            <p>
              SOZO connects publication discovery with Sarvam research, voice and explicit image context. Direct MOMAR routing and arbitrary code execution are not configured.
            </p>
          </div>
          <div className="modal-actions">
            <button
              className="primary-button"
              onClick={() => {
                setModal("");
                newResearch();
              }}
            >
              Let curiosity lead
              <ArrowUpRight size={15} />
            </button>
          </div>
        </Modal>
      )}
      {modal === "settings" && (
        <Modal title="Your corner of discovery." onClose={() => setModal("")}>
          <div className="settings-profile">
            <span className="avatar">
              {ws.user.name.charAt(0).toUpperCase()}
            </span>
            <div>
              <h3>{ws.user.name}</h3>
              <p>
                {ws.user.email ||
                  "Sign in to save your research across sessions."}
              </p>
            </div>
          </div>
          <div className="settings-row">
            <span>
              <strong>Workspace</strong>
              <small>Personal · private by default</small>
            </span>
            <ShieldCheck size={20} />
          </div>
          <div className="settings-row">
            <span>
              <strong>Research engine</strong>
              <small>Live literature discovery · no model configured</small>
            </span>
            <span className="outline-tag">v0.3</span>
          </div>
          <div className="settings-row">
            <span>
              <strong>The SOZO identity</strong>
              <small>Your mark, recreated as scalable vectors</small>
            </span>
            <a className="text-button" href="/sozo-logo.svg" download>
              Logo
              <Download size={14} />
            </a>
          </div>
          <div className="settings-row">
            <span>
              <strong>Transparent symbol</strong>
              <small>Lime-green SVG · any resolution</small>
            </span>
            <a className="text-button" href="/sozo-mark.svg" download>
              SVG
              <Download size={14} />
            </a>
          </div>
          <div className="settings-row">
            <span>
              <strong>Complete brand kit</strong>
              <small>Symbol, logo, and wordmark · SVG + PNG</small>
            </span>
            <a className="text-button" href="/sozo-brand-kit.zip" download>
              Download
              <Download size={14} />
            </a>
          </div>
          <div className="modal-actions">
            <button
              className="secondary-button"
              onClick={async () => {
                if (ws.user.method === "chatgpt") {
                  window.location.assign("/signout-with-chatgpt?return_to=/");
                  return;
                }
                await fetch("/api/auth/logout", { method: "POST" });
                window.location.assign("/login");
              }}
            >
              <LogOut size={15} />
              Sign out
            </button>
          </div>
        </Modal>
      )}
      {modal === "activity" && (
        <Modal title="A record of your curiosity." onClose={() => setModal("")}>
          {events.length ? (
            <div className="activity-list">
              {events.map((a) => (
                <div key={a.id}>
                  <span className="activity-icon">
                    <Activity size={16} />
                  </span>
                  <span>
                    <strong>
                      {a.action.replaceAll(".", " · ").replaceAll("_", " ")}
                    </strong>
                    <small>
                      {date(a.createdAt)} ·{" "}
                      {new Date(a.createdAt).toLocaleTimeString()}
                    </small>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="modal-description">
              Your research, notes, and integration activity will appear here.
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}
