"use client";
import { useState, useEffect, type FormEvent } from "react";
import {
  Plus,
  Activity,
  ArrowUpRight,
  ArrowRight,
  Download,
  Copy,
  Code2,
  Terminal,
  LockKeyhole,
  Trash2,
  Leaf,
  Orbit,
  Cable,
  ShieldCheck,
  Loader2,
  Check,
  Search,
  Beaker,
  Atom,
} from "lucide-react";
import { api, download, date } from "../lib/client";
import { descriptiveStatistics } from "../lib/science/stats";
import type { Capability } from "../lib/science/connectors";
import { Modal, PageHeading } from "./sozo-ui";
export type Connector = {
  id: string;
  name: string;
  url: string;
  type: string;
  capabilities: Capability[];
};
type Common = { notify: (v: string) => void; refresh: () => void };
export function Integrations({
  connectors,
  notify,
  refresh,
}: Common & { connectors: Connector[] }) {
  const [show, setShow] = useState(false);
  const [name, setName] = useState("");
  const [url, setURL] = useState("");
  const [caps, setCaps] = useState<Capability[]>([]);
  const [approved, setApproved] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState("");
  const [tested, setTested] = useState<Record<string, string>>({});
  const open = (n = "") => {
    setName(n);
    setURL("");
    setCaps([]);
    setApproved([]);
    setError("");
    setShow(true);
  };
  const discover = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const d = await api("connectors/discover", {
        method: "POST",
        body: JSON.stringify({ url }),
      });
      setCaps(d.capabilities);
      setName(name || d.name);
      setApproved([]);
      if (!d.capabilities.length)
        setError("No supported public GET operations were found.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const register = async () => {
    setBusy(true);
    try {
      await api("connectors", {
        method: "POST",
        body: JSON.stringify({ name, url, approved }),
      });
      refresh();
      setShow(false);
      notify("Approved read capabilities connected.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const test = async (id: string) => {
    setTesting(id);
    try {
      const d = await api("connectors/test", {
        method: "POST",
        body: JSON.stringify({ provider: id }),
      });
      setTested((s) => ({ ...s, [id]: d.checkedAt }));
      notify("Connection verified with a live request.");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setTesting("");
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="CONNECTED TO POSSIBILITY"
        title="A wider world of knowledge."
        description="Bring trusted scientific sources and compatible APIs into your workspace."
      >
        <button className="primary-button" onClick={() => open()}>
          <Plus size={16} />
          Add integration
        </button>
      </PageHeading>
      <div className="integration-section-label">
        <span>RESEARCH SOURCES</span>
        <span>Public access · ready to search</span>
      </div>
      <div className="integration-grid">
        {[
          {
            id: "crossref",
            name: "Crossref",
            desc: "Explore publication metadata, DOI records, and scientific literature across disciplines.",
            docs: "https://www.crossref.org/documentation/retrieve-metadata/rest-api/",
          },
          {
            id: "europepmc",
            name: "Europe PMC",
            desc: "Discover life science publications, abstracts, and biomedical research records.",
            docs: "https://europepmc.org/RestfulWebService",
          },
        ].map((p) => (
          <article className="integration-card" key={p.id}>
            <div className="integration-card-top">
              <span
                className={`source-logo large ${p.id === "crossref" ? "crossref" : "epmc"}`}
              >
                {p.id === "crossref" ? (
                  <>
                    c<span>r</span>
                  </>
                ) : (
                  <Leaf size={27} />
                )}
              </span>
              <span className="status completed">
                <span className="status-dot" />
                Public API
              </span>
            </div>
            <h3>{p.name}</h3>
            <p>{p.desc}</p>
            <div className="integration-meta">
              <span>
                <ShieldCheck size={13} />
                Read-only
              </span>
              <span>Native connector</span>
            </div>
            {tested[p.id] && (
              <p className="test-success">
                <Check size={13} />
                Verified {new Date(tested[p.id]).toLocaleTimeString()}
              </p>
            )}
            <div className="integration-actions">
              <button
                className="secondary-button"
                disabled={testing === p.id}
                onClick={() => test(p.id)}
              >
                {testing === p.id ? (
                  <Loader2 size={14} className="spin" />
                ) : (
                  <Activity size={14} />
                )}
                Test connection
              </button>
              <a
                className="icon-button"
                href={p.docs}
                target="_blank"
                rel="noreferrer"
                aria-label={`${p.name} documentation`}
              >
                <ArrowUpRight size={18} />
              </a>
            </div>
          </article>
        ))}
      </div>
      <div className="integration-section-label">
        <span>YOUR INTEGRATIONS</span>
        <span>{connectors.length} connected</span>
      </div>
      <div className="integration-grid">
        {connectors.map((c) => (
          <article className="integration-card" key={c.id}>
            <div className="integration-card-top">
              <span className="source-logo custom">
                <Cable size={25} />
              </span>
              <span className="outline-tag">OpenAPI 3</span>
            </div>
            <h3>{c.name}</h3>
            <p className="break-word">{c.url}</p>
            <div className="integration-meta">
              {c.capabilities.length} approved read capabilities
            </div>
            <div className="capability-list">
              {c.capabilities.slice(0, 4).map((cap) => (
                <span key={cap.id}>
                  <Check size={12} />
                  {cap.name}
                </span>
              ))}
            </div>
            <button
              className="text-button danger"
              onClick={async () => {
                try {
                  await api(`connectors/${c.id}`, { method: "DELETE" });
                  refresh();
                  notify("Integration disconnected.");
                } catch (e) {
                  notify((e as Error).message);
                }
              }}
            >
              <Trash2 size={14} />
              Disconnect
            </button>
          </article>
        ))}
        <article className="integration-card momar-card">
          <div className="integration-card-top">
            <span className="source-logo momar">
              <Orbit size={27} />
            </span>
            <span className="outline-tag">Setup required</span>
          </div>
          <h3>
            MOMAR<span className="small muted"> / Moon & Mars</span>
          </h3>
          <p>
            Connect your planetary intelligence platform through its real
            OpenAPI contract.
          </p>
          <div className="integration-meta">No endpoint configured</div>
          <button className="secondary-button" onClick={() => open("MOMAR")}>
            Configure connection
            <ArrowUpRight size={14} />
          </button>
        </article>
        <button className="integration-add" onClick={() => open()}>
          <span>
            <Plus size={24} />
          </span>
          <h3>Your tools. One workspace.</h3>
          <p>Add an approved OpenAPI endpoint.</p>
          <span className="text-button">
            Connect an API
            <ArrowRight size={14} />
          </span>
        </button>
      </div>
      <div className="info-callout">
        <ShieldCheck size={19} />
        <div>
          <strong>Every connection has a boundary.</strong>
          <p>
            Only approved public GET operations are available. MCP, OAuth, and
            write operations are not enabled in this release.
          </p>
        </div>
      </div>
      {show && (
        <Modal
          title={
            name === "MOMAR"
              ? "Connect MOMAR to SOZO."
              : "Connect a new perspective."
          }
          wide
          onClose={() => setShow(false)}
        >
          <p className="modal-description">
            Discover an OpenAPI 3 JSON specification, review its permissions,
            then approve the capabilities you need.
          </p>
          <form onSubmit={discover}>
            <label className="field-label" htmlFor="connector-name">
              Integration name
            </label>
            <input
              id="connector-name"
              required
              maxLength={100}
              placeholder="e.g. My scientific API"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <label className="field-label" htmlFor="connector-url">
              OpenAPI specification URL
            </label>
            <input
              id="connector-url"
              type="url"
              required
              placeholder="https://your-api.example/openapi.json"
              value={url}
              onChange={(e) => {
                setURL(e.target.value);
                setCaps([]);
              }}
            />
            <p className="field-help">
              The host must be approved by your administrator in
              SOZO_CONNECTOR_HOSTS. Credentials, external schema references, and
              write operations are not supported yet.
            </p>
            <button className="secondary-button" disabled={busy}>
              {busy ? (
                <Loader2 size={15} className="spin" />
              ) : (
                <Search size={15} />
              )}
              Discover capabilities
            </button>
          </form>
          {error && <p className="form-error">{error}</p>}
          {caps.length > 0 && (
            <>
              <h3 className="subsection-heading">Approve read capabilities</h3>
              <div className="discovered-capabilities">
                {caps.map((c) => (
                  <label key={c.id}>
                    <input
                      type="checkbox"
                      checked={approved.includes(c.id)}
                      onChange={(e) =>
                        setApproved((a) =>
                          e.target.checked
                            ? [...a, c.id]
                            : a.filter((x) => x !== c.id),
                        )
                      }
                    />
                    <span>
                      <strong>{c.name}</strong>
                      <code>GET {c.path}</code>
                      <small>{c.description.slice(0, 180)}</small>
                    </span>
                    <span className="outline-tag">Read-only</span>
                  </label>
                ))}
              </div>
              <div className="modal-actions">
                <button
                  className="primary-button"
                  disabled={!approved.length || busy}
                  onClick={register}
                >
                  Connect {approved.length} capabilities
                  <ArrowRight size={15} />
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
export function AnalysisLab() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<ReturnType<
    typeof descriptiveStatistics
  > | null>(null);
  const [error, setError] = useState("");
  return (
    <>
      <PageHeading
        eyebrow="MAKE THE NUMBERS SPEAK"
        title="From data to understanding."
        description="Reproducible descriptive statistics, calculated directly from your values."
      >
        <span className="outline-tag">
          <ShieldCheck size={14} />
          Deterministic computation
        </span>
      </PageHeading>
      <div className="analysis-grid">
        <form
          className="analysis-input panel"
          onSubmit={(e) => {
            e.preventDefault();
            try {
              setResult(descriptiveStatistics(input));
              setError("");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <h3>Your dataset</h3>
          <p className="muted small">
            Paste 2–10,000 numbers separated by commas, spaces, or new lines.
            Use one consistent unit.
          </p>
          <label className="field-label" htmlFor="dataset">
            Numeric values
          </label>
          <textarea
            id="dataset"
            placeholder="12.4, 15.2, 13.8, 17.1, 14.5…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={9}
          />
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button">
            <Beaker size={16} />
            Analyze data
            <ArrowRight size={15} />
          </button>
          <button
            className="text-button"
            type="button"
            onClick={() => {
              setInput("2, 4, 4, 4, 5, 5, 7, 9");
              setResult(null);
              setError("");
            }}
          >
            Try a reference dataset
          </button>
        </form>
        <div className="analysis-output panel">
          <span className="section-eyebrow">
            ANALYSIS RESULTS
            <Atom size={16} />
          </span>
          {result ? (
            <>
              <div className="stats-grid">
                {(
                  [
                    "count",
                    "mean",
                    "median",
                    "min",
                    "max",
                    "sampleStandardDeviation",
                  ] as const
                ).map((k) => (
                  <div className="stat-tile" key={k}>
                    <span>
                      {
                        {
                          count: "Values",
                          mean: "Mean",
                          median: "Median",
                          min: "Minimum",
                          max: "Maximum",
                          sampleStandardDeviation: "Sample std. deviation",
                        }[k]
                      }
                    </span>
                    <strong>
                      {result[k].toLocaleString(undefined, {
                        maximumSignificantDigits: 7,
                      })}
                    </strong>
                  </div>
                ))}
              </div>
              <div
                className="data-bars"
                aria-label="Values scaled to the observed range"
              >
                {result.input.slice(0, 80).map((n, i) => (
                  <div
                    key={i}
                    title={String(n)}
                    style={{
                      height: `${10 + (85 * (n - result.min)) / (result.max - result.min || 1)}%`,
                    }}
                  />
                ))}
              </div>
              <p className="small muted">
                {result.method} The chart displays up to the first 80 values,
                scaled to the observed range.
              </p>
              <button
                className="secondary-button"
                onClick={() =>
                  download(
                    "sozo-analysis.json",
                    JSON.stringify(result, null, 2),
                  )
                }
              >
                <Download size={15} />
                Export reproducible result
              </button>
            </>
          ) : (
            <div className="analysis-placeholder">
              <Activity size={40} strokeWidth={1} />
              <h3>Let the evidence take shape.</h3>
              <p>
                Your statistics will appear here.
                <br />
                No model estimates. Just your data.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
type WebsiteKey = { id: string; key: string; label: string; origins: string[]; createdAt: string };
export function Developers({ notify }: { notify: (v: string) => void }) {
  const [tab, setTab] = useState("quickstart");
  const [base, setBase] = useState("");
  const [keys, setKeys] = useState<
    { id: string; name: string; prefix: string; createdAt: string }[]
  >([]);
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [sites, setSites] = useState<WebsiteKey[]>([]);
  const [siteLabel, setSiteLabel] = useState(""), [siteOrigins, setSiteOrigins] = useState("");
  useEffect(() => setBase(window.location.origin), []);
  // Publishable keys live with the companion API, not /api/v1.
  const websiteKeys = async (method = "GET", body?: unknown) => {
    const response = await fetch("/api/companion/publishable-keys", { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const data = (await response.json()) as { error?: { message?: string }; keys?: WebsiteKey[] };
    if (!response.ok) throw new Error(data.error?.message || "Something went wrong. Please try again.");
    return data;
  };
  const loadSites = async () => {
    try {
      setSites((await websiteKeys()).keys ?? []);
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const embed = (key: string) =>
    `<script src="${base}/embed/sozo-widget.js"></script>\n<sozo-companion api-base="${base}" publishable-key="${key}"></sozo-companion>\n<script>\n  // Optional: "scan the route" flies SOZO to this panel and reads it.\n  document.querySelector("sozo-companion")\n    .registerTarget("route", document.querySelector("#route-panel"));\n</script>`;
  const loadKeys = async () => {
    try {
      setKeys((await api("keys")).keys);
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notify("Copied to clipboard.");
    } catch {
      notify("Clipboard is unavailable.");
    }
  };
  const code = `curl -X POST '${base}/api/v1/research' \\\n  -H "Authorization: Bearer $SOZO_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"question":"Mars rover terrain planning",\n       "sources":["crossref"],"mode":"broad"}'`;
  const codeBlock = (title: string, content: string) => (
    <div className="code-block">
      <div>
        <span>
          <Terminal size={14} />
          {title}
        </span>
        <button onClick={() => copy(content)}>
          <Copy size={13} />
          Copy
        </button>
      </div>
      <pre>
        <code>{content}</code>
      </pre>
    </div>
  );
  return (
    <>
      <PageHeading
        eyebrow="BUILT TO CONNECT"
        title="Your science. Your stack."
        description="Bring SOZO into your application with a stable, versioned API."
      >
        <a href="/openapi.json" download className="secondary-button">
          <Download size={15} />
          OpenAPI spec
        </a>
      </PageHeading>
      <div className="filter-tabs dev-tabs">
        {[
          ["quickstart", "Quickstart"],
          ["reference", "API reference"],
          ["keys", "API keys"],
          ["websites", "Website keys"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => {
              setTab(id);
              if (id === "keys") loadKeys();
              if (id === "websites") loadSites();
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "quickstart" && (
        <div className="developer-content">
          <div className="developer-intro">
            <span className="step-number">01</span>
            <div>
              <h3>Ask your first question.</h3>
              <p>
                Create an API key, submit a research request, then poll its
                persisted record. SOZO returns real source metadata and
                abstracts.
              </p>
            </div>
          </div>
          {codeBlock("cURL", code)}
          <div className="developer-intro">
            <span className="step-number">02</span>
            <div>
              <h3>Make yourself at home in the terminal.</h3>
              <p>
                The dependency-free CLI manages projects, research, and
                integrations.
              </p>
            </div>
          </div>
          {codeBlock(
            "Terminal",
            `export SOZO_BASE_URL="${base}"\nexport SOZO_API_KEY="<your-key>"\n\nnode cli/sozo.mjs research run --question "Mars rover terrain planning"\nnode cli/sozo.mjs research status <research-run-id>\nnode cli/sozo.mjs connect list`,
          )}
          <a className="text-button" href="/embed/demo.html" target="_blank" rel="noreferrer">Open companion integration demo ↗</a>
          <a className="text-button" href="/docs/companion-integration.md" target="_blank" rel="noreferrer">Companion API & embed guide ↗</a>
          <a className="text-button" href="/cli/sozo.mjs" download>
            <Download size={14} />
            Download the SOZO CLI
          </a>
          <div className="info-callout">
            <LockKeyhole size={19} />
            <div>
              <strong>One API. Local and live.</strong>
              <p>
                The landing page is public. A SOZO API key protects your workspace and works with both the local server and the live API. Keep long-lived keys in your backend. Issue a short-lived origin-bound session for an embedded companion.
              </p>
            </div>
          </div>
        </div>
      )}
      {tab === "reference" && (
        <div className="api-reference">
          {[
            ["GET", "/health", "Service health and release mode"],
            ["GET", "/workspace", "Workspace, projects, notes, and history"],
            ["POST", "/projects", "Create a research project"],
            [
              "POST",
              "/research",
              "Start a bounded source search · returns 202",
            ],
            ["GET", "/research/{id}", "Run status, citations, and limitations"],
            ["POST", "/research/{id}/cancel", "Cancel an active run"],
            ["GET", "/research/{id}/report", "Retrieve a JSON research report"],
            [
              "POST",
              "/connectors/discover",
              "Inspect an OpenAPI specification",
            ],
            ["POST", "/connectors", "Register approved read operations"],
            [
              "POST",
              "/connectors/{id}/invoke",
              "Invoke an approved capability",
            ],
            ["DELETE", "/connectors/{id}", "Revoke an integration"],
            ["GET", "/audit", "Latest 100 workspace audit events"],
          ].map(([method, path, detail]) => (
            <div className="api-row" key={path + method}>
              <span className={`method ${method.toLowerCase()}`}>{method}</span>
              <code>/api/v1{path}</code>
              <p>{detail}</p>
            </div>
          ))}
        </div>
      )}
      {tab === "websites" && (
        <div className="key-section">
          <h3>SOZO on any website.</h3>
          <p>
            A publishable key is public: it goes in your page. It works only
            from the websites you list, and each visitor gets a ten-minute
            companion session that shares your workspace quotas (30 requests a
            minute, 240 an hour). Signed-in or high-volume products should
            issue sessions from their backend instead.
          </p>
          <form
            className="key-form website-key-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await websiteKeys("POST", { label: siteLabel, origins: siteOrigins.split(/[\s,]+/).filter(Boolean) });
                setSiteLabel("");
                setSiteOrigins("");
                loadSites();
                notify("Website key created.");
              } catch (e) {
                notify((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <input required maxLength={100} placeholder="Label, e.g. MOMAR planner" aria-label="Website key label" value={siteLabel} onChange={(e) => setSiteLabel(e.target.value)} />
            <input required placeholder="https://www.momar.si, http://localhost:3000" aria-label="Websites allowed to use the key" value={siteOrigins} onChange={(e) => setSiteOrigins(e.target.value)} />
            <button className="primary-button" disabled={busy}>
              <Plus size={15} />
              Create key
            </button>
          </form>
          <div className="keys-list">
            {sites.map((k) => (
              <div key={k.id}>
                <Code2 size={18} />
                <span>
                  <strong>{k.label}</strong>
                  <small>
                    {k.key} · {k.origins.join(", ")} · Created {date(k.createdAt)}
                  </small>
                </span>
                <button className="text-button" onClick={() => copy(embed(k.key))}>
                  <Copy size={14} />
                  Embed code
                </button>
                <button
                  className="text-button danger"
                  onClick={async () => {
                    try {
                      await websiteKeys("DELETE", { id: k.id });
                      loadSites();
                      notify("Website key revoked.");
                    } catch (e) {
                      notify((e as Error).message);
                    }
                  }}
                >
                  Revoke
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          {codeBlock("HTML", embed(sites[0]?.key ?? "sozo_pk_your_key"))}
        </div>
      )}
      {tab === "keys" && (
        <div className="key-section">
          <h3>Keys to your workspace.</h3>
          <p>
            Keys inherit your access. Keep them on the server and revoke unused
            keys.
          </p>
          <form
            className="key-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const d = await api("keys", {
                  method: "POST",
                  body: JSON.stringify({ name }),
                });
                setNewKey(d.token);
                setName("");
                loadKeys();
              } catch (e) {
                notify((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <input
              required
              maxLength={100}
              placeholder="Key name, e.g. Research service"
              aria-label="API key name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button className="primary-button" disabled={busy}>
              <Plus size={15} />
              Create key
            </button>
          </form>
          {newKey && (
            <div className="new-key">
              <strong>Copy your key now. It is shown only once.</strong>
              <code>{newKey}</code>
              <button className="secondary-button" onClick={() => copy(newKey)}>
                <Copy size={14} />
                Copy key
              </button>
              <button className="text-button" onClick={() => setNewKey("")}>
                Dismiss
              </button>
            </div>
          )}
          <div className="keys-list">
            {keys.map((k) => (
              <div key={k.id}>
                <LockKeyhole size={18} />
                <span>
                  <strong>{k.name}</strong>
                  <small>
                    {k.prefix}•••• · Created {date(k.createdAt)}
                  </small>
                </span>
                <button
                  className="text-button danger"
                  onClick={async () => {
                    try {
                      await api(`keys/${k.id}`, { method: "DELETE" });
                      loadKeys();
                      notify("API key revoked.");
                    } catch (e) {
                      notify((e as Error).message);
                    }
                  }}
                >
                  Revoke
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
