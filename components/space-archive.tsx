"use client";
import {
  useEffect,
  useCallback,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Search,
  ArrowUpRight,
  Loader2,
  Database,
  Image as ImageIcon,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { api } from "../lib/client";
import { PageHeading, Modal } from "./sozo-ui";
import type { SpaceSearch, SpaceRecord } from "../lib/science/space-data";
export default function SpaceArchive() {
  const [query, setQuery] = useState("lunar south pole"),
    [media, setMedia] = useState<"all" | "image" | "video">("all"),
    [result, setResult] = useState<SpaceSearch | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<SpaceRecord | null>(null);
  const current = useRef<AbortController | null>(null);
  const search = useCallback(async (term: string, kind: typeof media) => {
    current.current?.abort();
    const controller = new AbortController();
    current.current = controller;
    setBusy(true);
    setError("");
    try {
      const data = await api<SpaceSearch>(
        "space-data?" + new URLSearchParams({ q: term, media: kind }),
        { signal: controller.signal },
      );
      if (!controller.signal.aborted) setResult(data);
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }, []);
  useEffect(() => {
    void search("lunar south pole", "all");
    return () => current.current?.abort();
  }, [search]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void search(query, media);
  };
  return (
    <div className="nasa-archive">
      <PageHeading
        eyebrow="ORIGINAL SOURCES / LIVE DISCOVERY"
        title="A universe of evidence."
        description="Search NASA’s image and video archive. Inspect the original record, its date, and its provenance."
      >
        <a
          className="secondary-button"
          href="https://images.nasa.gov/"
          target="_blank"
          rel="noreferrer"
        >
          NASA archive
          <ArrowUpRight size={14} />
        </a>
      </PageHeading>
      <form className="archive-search" onSubmit={submit}>
        <Search size={19} />
        <input
          aria-label="Search NASA archive"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          minLength={2}
          maxLength={160}
          required
          placeholder="Search the Moon, Mars, missions, or instruments…"
        />
        <select
          aria-label="NASA media type"
          value={media}
          onChange={(e) => setMedia(e.target.value as typeof media)}
        >
          <option value="all">All media</option>
          <option value="image">Images</option>
          <option value="video">Videos</option>
        </select>
        <button type="submit" className="primary-button" disabled={busy}>
          {busy ? <Loader2 className="spin" size={15} /> : <Search size={15} />}
          Search
        </button>
      </form>
      <div className="archive-filters">
        <span>EXPLORE</span>
        {[
          "lunar south pole",
          "Mars rover",
          "astronaut extravehicular activity",
          "lunar habitat",
        ].map((term) => (
          <button
            key={term}
            onClick={() => {
              setQuery(term);
              void search(term, media);
            }}
          >
            {term}
          </button>
        ))}
      </div>
      <div className="catalog-notice">
        <ShieldCheck size={19} />
        <div>
          <strong>Original NASA archive records</strong>
          <p>
            This is a live search of historical media and source captions. These
            records are not live telemetry, a DEM, or terrain-route output.
            Inspect mission dates and original product limitations before
            scientific use.
          </p>
        </div>
      </div>
      {error ? (
        <div className="archive-state" role="alert">
          <Database size={30} />
          <h3>NASA search could not complete.</h3>
          <p>{error}</p>
          <button
            className="secondary-button"
            onClick={() => void search(query, media)}
          >
            Try again
          </button>
        </div>
      ) : busy ? (
        <div className="archive-state" role="status">
          <Loader2 size={28} className="spin" />
          <p>Searching the original NASA archive…</p>
        </div>
      ) : result ? (
        <>
          <div className="archive-summary">
            <span>
              {result.records.length} RECORDS SHOWN
              {result.totalAvailable !== null
                ? ` / ${result.totalAvailable.toLocaleString("en-US")} MATCHES IN THE ARCHIVE`
                : ""}
            </span>
            <p>
              Retrieved {new Date(result.retrievedAt).toLocaleString()} ·{" "}
              <a href={result.requestUrl} target="_blank" rel="noreferrer">
                Original API response
                <ExternalLink size={10} />
              </a>
            </p>
          </div>
          {result.records.length ? (
            <div className="archive-results">
              {result.records.map((record) => (
                <article key={record.id} className="archive-result">
                  <a
                    href={record.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open NASA record: ${record.title}`}
                  >
                    {record.thumbnail ? (
                      <img
                        src={record.thumbnail}
                        alt={record.title}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <ImageIcon size={40} />
                    )}
                  </a>
                  <div>
                    <div className="archive-item-meta">
                      <span>
                        {record.center} / {record.kind.toUpperCase()}
                      </span>
                      <span>
                        {record.date.slice(0, 10) || "DATE NOT PROVIDED"}
                      </span>
                    </div>
                    <h3>{record.title}</h3>
                    <p>
                      {record.description ||
                        "No description was supplied for this record."}
                    </p>
                    <button
                      className="archive-source"
                      onClick={() => setSelected(record)}
                    >
                      Inspect provenance
                      <ArrowUpRight size={14} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="archive-state">
              <Search size={29} />
              <h3>No records matched this search.</h3>
              <p>Try a shorter scientific term or another mission.</p>
            </div>
          )}
        </>
      ) : null}
      {selected && (
        <Modal title={selected.title} wide onClose={() => setSelected(null)}>
          <p className="dataset-detail-description">
            {selected.description || "No source description supplied."}
          </p>
          <dl className="dataset-details">
            <div>
              <dt>Provider</dt>
              <dd>NASA Image and Video Library</dd>
            </div>
            <div>
              <dt>NASA record identifier</dt>
              <dd>{selected.id}</dd>
            </div>
            <div>
              <dt>Original record date</dt>
              <dd>{selected.date || "Not supplied"}</dd>
            </div>
            <div>
              <dt>Center / creator</dt>
              <dd>
                {selected.center} / {selected.creator}
              </dd>
            </div>
            <div>
              <dt>Retrieved by SOZO</dt>
              <dd>{result?.retrievedAt}</dd>
            </div>
          </dl>
          <div className="info-callout">
            <ShieldCheck size={17} />
            <p>
              Original captions are reproduced as source metadata. They are not
              an independent scientific validation by SOZO. Follow the record
              for credit and usage terms.
            </p>
          </div>
          <div className="modal-actions">
            <a
              className="secondary-button"
              href={selected.metadataUrl}
              target="_blank"
              rel="noreferrer"
            >
              Original metadata
              <ExternalLink size={13} />
            </a>
            <a
              className="primary-button"
              href={selected.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open NASA record
              <ArrowUpRight size={14} />
            </a>
          </div>
        </Modal>
      )}
    </div>
  );
}
