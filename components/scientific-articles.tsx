"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowUpRight, BookOpen, Loader2, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import type { ArticleDiscovery, ScientificArticle } from "../lib/science/retrieval";
import { Modal } from "./sozo-ui";

function askLink(article: ScientificArticle) {
  return "/dashboard?" + new URLSearchParams({ view: "research", q: `Investigate this ${article.body === "moon" ? "lunar" : "Martian"} publication: ${article.title}. ${article.doi ? `DOI: ${article.doi}.` : ""} Explain its evidence and limitations for terrain or mission planning.` });
}
export default function ScientificArticles({ compact = false }: { compact?: boolean }) {
  const [body, setBody] = useState("all"), [query, setQuery] = useState(""), [term, setTerm] = useState("");
  const [result, setResult] = useState<ArticleDiscovery | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [limit, setLimit] = useState(compact ? 4 : 8), [selected, setSelected] = useState<ScientificArticle | null>(null);
  const [topic, setTopic] = useState("all"), [kind, setKind] = useState("all"), [sort, setSort] = useState("relevance"), [recent, setRecent] = useState(false);
  const section = useRef<HTMLElement>(null), controller = useRef<AbortController | null>(null);
  const [visible, setVisible] = useState(!compact);
  useEffect(() => {
    if (!compact || !section.current) return;
    const observer = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) { setVisible(true); observer.disconnect(); } }, { rootMargin: "350px" });
    observer.observe(section.current);
    return () => observer.disconnect();
  }, [compact]);
  const search = useCallback(async () => {
    controller.current?.abort();
    const request = new AbortController(); controller.current = request;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/articles?" + new URLSearchParams({ body, q: term, limit: String(limit) }), { signal: request.signal, headers: { Accept: "application/json" } });
      const data = await response.json() as ArticleDiscovery & { error?: string };
      if (!response.ok) throw new Error(data.error || "Article discovery is unavailable.");
      if (!request.signal.aborted) { setResult(data); if (data.diagnostics?.every((item: { ok: boolean }) => !item.ok)) setError("The publication provider could not be reached. Please retry."); }
    } catch (failure) { if (!request.signal.aborted) setError(failure instanceof Error ? failure.message : "Article discovery could not complete."); }
    finally { if (!request.signal.aborted) setBusy(false); }
  }, [body, term, limit]);
  useEffect(() => { if (visible) void search(); return () => controller.current?.abort(); }, [visible, search]);
  const submit = (event: FormEvent) => { event.preventDefault(); setLimit(compact ? 4 : 8); if (term === query.trim()) void search(); else setTerm(query.trim()); };
  const records = useMemo(() => {
    const items = (result?.records ?? []).filter((article) => (topic === "all" || article.topics.includes(topic)) && (kind === "all" || (kind === "preprint" ? article.type === "Preprint" : article.type === "Journal article")) && (!recent || Number(article.year) >= new Date().getFullYear() - 5));
    if (sort === "date") items.sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0));
    return items;
  }, [result, topic, kind, sort, recent]);
  const topics = [...new Set((result?.records ?? []).flatMap((article) => article.topics))];
  return <section ref={section} id={compact ? "articles" : undefined} className={`scientific-articles ${compact ? "articles-landing" : "articles-workspace"}`} aria-labelledby="articles-title">
    <div className="articles-heading">
      <div><span className="section-kicker">ARTICLES & SCIENTIFIC DISCOVERIES</span><h2 id="articles-title">{compact ? <>Discover the science<br />behind the next frontier.</> : "Follow the evidence."}</h2><p>Explore Moon and Mars research from identifiable scientific publications. Inspect the record, then bring the question to SOZO.</p></div>
      <button className="text-link" onClick={() => void search()} disabled={busy || !visible}><RefreshCw size={14} className={busy ? "spin" : ""} /> Refresh discovery</button>
    </div>
    <form className="articles-search" onSubmit={submit}>
      <Search size={18} /><input aria-label="Search scientific articles" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={180} placeholder="Search a mission, instrument, or scientific question…" />
      <button className="primary-button" type="submit" disabled={busy}>Search <ArrowUpRight size={14} /></button>
    </form>
    <div className="articles-toolbar">
      <div className="articles-worlds" aria-label="Filter articles by world">{[["all", "Both worlds"], ["moon", "The Moon"], ["mars", "Mars"]].map(([value, label]) => <button type="button" key={value} aria-pressed={body === value} onClick={() => { setBody(value); setLimit(compact ? 4 : 8); }}>{label}</button>)}</div>
      <label><SlidersHorizontal size={13} /><span className="sr-only">Scientific subject</span><select aria-label="Scientific subject" value={topic} onChange={(event) => setTopic(event.target.value)}><option value="all">All subjects</option>{topics.map((item) => <option key={item}>{item}</option>)}</select></label>
      <select aria-label="Publication type" value={kind} onChange={(event) => setKind(event.target.value)}><option value="all">All publication types</option><option value="paper">Journal articles</option><option value="preprint">Preprints</option></select>
      <select aria-label="Sort scientific articles" value={sort} onChange={(event) => setSort(event.target.value)}><option value="relevance">Scientific relevance</option><option value="date">Publication year</option></select>
      <label className="articles-recent"><input type="checkbox" checked={recent} onChange={(event) => setRecent(event.target.checked)} /> Last 5 years</label>
    </div>
    {error ? <div role="alert" className="articles-state"><BookOpen size={26} /><h3>Discovery needs another try.</h3><p>{error}</p><button className="secondary-button" onClick={() => void search()}>Retry</button></div> : busy && !result ? <div role="status" className="articles-state"><Loader2 className="spin" size={26} /><p>Retrieving scientific publication metadata…</p></div> : visible && result && !records.length ? <div className="articles-state"><BookOpen size={26} /><h3>No publications match these checks.</h3><p>Try a specific mission or instrument, broaden the subject, or reset your publication filters. Missing evidence is never replaced with fictional articles.</p></div> : <div className="articles-grid" aria-busy={busy}>{records.map((article) => <article className={`science-article ${article.body}`} key={article.doi || article.title}>
      <div className="article-meta"><span className={`article-world ${article.body}`}>{article.body === "moon" ? "THE MOON" : article.body === "mars" ? "MARS" : "MOON + MARS"}</span><span>{article.year || "Year unavailable"} · {article.type}</span></div>
      <h3><button onClick={() => setSelected(article)}>{article.title}</button></h3>
      <p>{article.abstract ? article.abstract.slice(0, 260) + (article.abstract.length > 260 ? "…" : "") : "Abstract unavailable in this record. Open the original publication to inspect its methods and findings."}</p>
      <div className="article-source"><BookOpen size={13} /><span>{article.journal || article.provider}</span></div>
      <div className="article-check">Crossref metadata retrieved · Review status not established</div>
      <div className="article-actions"><button className="text-link" onClick={() => setSelected(article)}>Inspect record <ArrowUpRight size={13} /></button><a className="text-link" href={askLink(article)}>Ask SOZO <ArrowUpRight size={13} /></a></div>
    </article>)}</div>}
    {result && !error && <div className="articles-footnote"><div><span>{records.length} RECORDS SHOWN · SOURCE: CROSSREF</span><p>Retrieved {new Date(result.retrievedAt).toLocaleString()} · Publication dates refer to the record’s year, not observation time. Metadata checks do not verify scientific conclusions.</p>{result.records.filter((item) => item.body === "moon" || item.body === "both").length < 2 && body !== "mars" && <p>Fewer than two lunar records passed this search. Broaden your query or retry discovery.</p>}{result.records.filter((item) => item.body === "mars" || item.body === "both").length < 2 && body !== "moon" && <p>Fewer than two Martian records passed this search. Broaden your query or retry discovery.</p>}</div>{limit < 24 && <button className="secondary-button" disabled={busy} onClick={() => setLimit((value) => Math.min(24, value + 8))}>{busy ? "Retrieving…" : "Discover more"} <ArrowUpRight size={13} /></button>}</div>}
    {selected && <Modal title="Scientific publication record" onClose={() => setSelected(null)} wide><div className="article-detail"><span className="section-kicker">{selected.body.toUpperCase()} / {selected.provider}</span><h2>{selected.title}</h2><p>{selected.authors}</p><dl><div><dt>Publication</dt><dd>{selected.journal || "Not supplied"}</dd></div><div><dt>Publication year</dt><dd>{selected.year || "Not supplied"}</dd></div><div><dt>Type</dt><dd>{selected.type}</dd></div><div><dt>Review status</dt><dd>{selected.peerReview}</dd></div><div><dt>DOI</dt><dd>{selected.doi || "Not supplied"}</dd></div><div><dt>Record retrieved</dt><dd>{new Date(selected.retrievedAt).toLocaleString()}</dd></div></dl><h3>Provider abstract excerpt</h3><p className="article-abstract">{selected.abstract ? selected.abstract.slice(0, 2000) + (selected.abstract.length > 2000 ? "… Continue at the original source." : "") : "No abstract was supplied. SOZO has not inferred findings from the title."}</p><h3>Why this record was included</h3><ul>{selected.relevanceReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul><p className="article-caveat">This is provider metadata and an available abstract excerpt. Full text, scientific claims, licensing, and review status require checking the original publication. Related terrain products are not inferred from this record.</p><div className="article-actions"><a className="primary-button" href={selected.url} target="_blank" rel="noreferrer">Read original publication <ArrowUpRight size={14} /></a><a className="secondary-button" href={askLink(selected)}>Investigate with SOZO <ArrowUpRight size={14} /></a></div></div></Modal>}
  </section>;
}
