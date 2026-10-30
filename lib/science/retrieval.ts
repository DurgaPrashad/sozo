import type { Source, ResearchResult } from "./types";
import { classifyResearch, rankScientificSources, classifySourceBody, sourceTopics, type PlanetaryBody } from "./relevance";
export function plainText(value: unknown): string {
  const entities: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
    lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", ndash: "–", mdash: "—",
    hellip: "…", minus: "−", deg: "°", plusmn: "±", times: "×", divide: "÷",
    micro: "µ", middot: "·", bull: "•", copy: "©", reg: "®", trade: "™",
    alpha: "α", beta: "β", gamma: "γ", delta: "δ", Delta: "Δ", mu: "μ",
    sigma: "σ", Sigma: "Σ", pi: "π", tau: "τ", omega: "ω", Omega: "Ω",
    epsilon: "ε", theta: "θ", lambda: "λ", nu: "ν", rho: "ρ", phi: "φ", chi: "χ", psi: "ψ",
    sup2: "²", sup3: "³", frac12: "½", le: "≤", ge: "≥", ne: "≠", asymp: "≈", prime: "′", Prime: "″",
    thinsp: " ", ensp: " ", emsp: " ", zwj: "", zwnj: "", shy: "",
  };
  let text = String(value ?? "");
  // Some publication deposits escape markup more than once. Decode a bounded
  // number of layers, then strip markup again; never pass metadata to innerHTML.
  for (let layer = 0; layer < 4; layer++) {
    const next = text
      .replace(/&(#x[\da-f]+|#\d+|[a-z][a-z\d]+);/gi, (entity, code: string) => {
        if (code[0] !== "#") return entities[code] ?? entities[code.toLowerCase()] ?? entity;
        const point = code[1].toLowerCase() === "x"
          ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10);
        return Number.isFinite(point) && point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
          ? String.fromCodePoint(point) : "�";
      })
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
      .replace(/<\/?[a-z][a-z\d:-]*(?:\s[^<>]*?)?\s*\/?>/gi, " ");
    if (next === text) break;
    text = next;
  }
  return text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}

export function crossrefPublicationType(item: Record<string, any>): string {
  if (item.type === "posted-content") {
    const subtype = plainText(item.subtype).toLowerCase();
    if (subtype === "preprint") return "Preprint";
    if (["presentation", "poster", "abstract"].includes(subtype))
      return subtype === "presentation" ? "Presentation" : subtype === "poster" ? "Poster" : "Conference abstract";
    return subtype ? `Posted content · ${subtype}` : "Posted content (subtype unavailable)";
  }
  if (item.type === "journal-article") return "Journal article";
  if (item.type === "proceedings-article") return "Conference paper";
  return plainText(item.type || "Publication");
}
export function deduplicateSources(sources: Source[]): Source[] {
  const seen = new Set<string>();
  return sources
    .filter((s) => {
      const key =
        s.doi?.toLowerCase().replace(/^https?:\/\/doi.org\//, "") ||
        s.title
          .toLowerCase()
          .normalize("NFKC")
          .replace(/[\s.,;:!?()'"-]/g, "");
      if (!s.title || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((s, i) => ({ ...s, id: `S${i + 1}` }));
}
export async function getJSON(url: string, timeoutMs = 12000) {
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "SOZO-Research/0.1" },
    redirect: "manual",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(
      response.status === 429
        ? "Source rate limit reached. Try again shortly."
        : `Source returned HTTP ${response.status}.`,
    );
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Source returned an empty response.");
  let size = 0;
  let raw = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 4_000_000)
        throw new Error("Source response exceeded the size limit.");
      raw += decoder.decode(part.value, { stream: true });
    }
  } finally {
    await reader.cancel();
  }
  return JSON.parse(raw + decoder.decode());
}
function crossrefSource(item: Record<string, any>, id: string, at: string): Source {
  return {
    id,
    title: plainText(item.title?.[0]),
    authors: (Array.isArray(item.author) ? item.author : []).slice(0, 4)
      .map((a: any) => plainText([a.given, a.family].filter(Boolean).join(" "))).join(", ") || "Author information unavailable",
    year: String(item.published?.["date-parts"]?.[0]?.[0] ?? ""),
    journal: plainText(item["container-title"]?.[0] ?? item.publisher),
    doi: typeof item.DOI === "string" ? item.DOI : undefined,
    url: item.DOI ? `https://doi.org/${encodeURIComponent(item.DOI).replace(/%2F/g, "/")}` : "https://search.crossref.org/",
    abstract: plainText(item.abstract).slice(0, 5000), provider: "Crossref",
    type: crossrefPublicationType(item), retrievedAt: at,
  };
}

export async function searchCrossref(question: string, limit: number, fetcher = getJSON): Promise<Source[]> {
  const url = new URL("https://api.crossref.org/works");
  url.searchParams.set("query.bibliographic", question);
  url.searchParams.set("rows", String(limit));
  const data = await fetcher(url.toString());
  const at = new Date().toISOString();
  return (data.message?.items ?? []).map((item: Record<string, any>, i: number) => crossrefSource(item, `crossref-${i}`, at));
}

function canonicalDoi(value: string): string {
  return value.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "").toLowerCase();
}

export function extractRequestedDois(question: string): string[] {
  // Fixed DOI syntax and small bounds keep free-text questions from choosing a
  // fetch host, growing URLs indefinitely, or issuing an unbounded request fanout.
  const matches = question.slice(0, 12000).match(/\b10\.\d{4,9}\/[a-z\d._;()/:+-]+/gi) ?? [];
  const dois: string[] = [];
  for (const match of matches) {
    let doi = match.replace(/[.,;:!?]+$/, "");
    while (doi.endsWith(")") && (doi.match(/\)/g)?.length ?? 0) > (doi.match(/\(/g)?.length ?? 0)) doi = doi.slice(0, -1);
    if (doi.length > 200 || !/^10\.\d{4,9}\/[a-z\d][a-z\d._;()/:+-]*$/i.test(doi)) continue;
    const normalized = canonicalDoi(doi);
    if (!dois.includes(normalized)) dois.push(normalized);
    if (dois.length === 3) break;
  }
  return dois;
}

export async function lookupCrossrefDoi(doi: string, fetcher = getJSON): Promise<Source> {
  if (extractRequestedDois(doi).length !== 1 || extractRequestedDois(doi)[0] !== canonicalDoi(doi)) throw new Error("Invalid DOI identifier.");
  const identifier = canonicalDoi(doi);
  const data = await fetcher(`https://api.crossref.org/works/${encodeURIComponent(identifier)}`);
  const item = data.message;
  if (!item || typeof item !== "object" || typeof item.DOI !== "string" || canonicalDoi(item.DOI) !== identifier)
    throw new Error("Crossref returned a record with a different or missing DOI.");
  const source = crossrefSource(item, "crossref-requested", new Date().toISOString());
  if (!source.title) throw new Error("Crossref returned DOI metadata without a title.");
  return source;
}
export async function searchEuropePMC(
  question: string,
  limit: number,
  fetcher = getJSON,
): Promise<Source[]> {
  const url = new URL(
    "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
  );
  url.searchParams.set("query", question);
  url.searchParams.set("format", "json");
  url.searchParams.set("resultType", "core");
  url.searchParams.set("pageSize", String(limit));
  const data = await fetcher(url.toString());
  const at = new Date().toISOString();
  return (data.resultList?.result ?? []).map(
    (item: Record<string, any>, i: number) => ({
      id: `epmc-${i}`,
      title: plainText(item.title),
      authors: plainText(item.authorString) || "Author information unavailable",
      year: String(item.pubYear ?? ""),
      journal: plainText(item.journalInfo?.journal?.title),
      doi: item.doi,
      url: item.doi
        ? `https://doi.org/${encodeURIComponent(item.doi).replace(/%2F/g, "/")}`
        : `https://europepmc.org/article/${encodeURIComponent(item.source)}/${encodeURIComponent(item.id)}`,
      abstract: plainText(item.abstractText).slice(0, 5000),
      provider: "Europe PMC",
      type:
        item.pubTypeList?.pubType?.some((x: string) => /preprint/i.test(x)) ||
        item.source === "PPR"
          ? "Preprint"
          : "Publication",
      retrievedAt: at,
    }),
  );
}
export type RetrievalDiagnostics = {
  intent: ReturnType<typeof classifyResearch>;
  ranking: "Metadata and lexical policy; no semantic model or vector index";
  candidates: number;
  accepted: number;
  rejected: number;
  rejectionReasons: Record<string, number>;
  providerQueries: { provider: string; query: string }[];
  exactDois: { doi: string; ok: boolean; error?: string }[];
};

export async function retrieveEvidence(
  question: string,
  providers: string[],
  mode: string,
  fetcher = getJSON,
): Promise<ResearchResult & { diagnostics: RetrievalDiagnostics }> {
  const start = Date.now();
  const intent = classifyResearch(question);
  const requestedDois = extractRequestedDois(question);
  const limit = mode === "broad" ? 12 : 8;
  const eligible = [...new Set(providers)].filter((name) => ["crossref", "europepmc"].includes(name));
  const tasks = [
    ...requestedDois.map((doi) => ({ name: `Crossref DOI ${doi}`, query: doi, doi, run: async () => [await lookupCrossrefDoi(doi, fetcher)] })),
    ...eligible.map((name) => ({ name: name === "crossref" ? "Crossref" : "Europe PMC", query: intent.query, doi: null, run: () => name === "crossref" ? searchCrossref(intent.query, limit, fetcher) : searchEuropePMC(intent.query, limit, fetcher) })),
  ];
  const results = await Promise.allSettled(tasks.map((task) => task.run()));
  const status = results.map((r, i) => ({
    name: tasks[i].name, ok: r.status === "fulfilled", count: r.status === "fulfilled" ? r.value.length : 0,
    ...(r.status === "rejected" ? { error: r.reason instanceof Error ? r.reason.message : "Source unavailable." } : {}),
  }));
  const exactDois = requestedDois.map((doi, i) => ({ doi, ok: status[i].ok, ...(status[i].error ? { error: status[i].error } : {}) }));
  const pinnedDois = new Set(exactDois.filter((item) => item.ok).map((item) => item.doi));
  // Exact records are first so deduplication preserves the explicitly selected
  // publication even when a broad search returns a different metadata version.
  const candidates = deduplicateSources(results.flatMap((r) => r.status === "fulfilled" ? r.value : []));
  const pinned = candidates.filter((source) => source.doi && pinnedDois.has(canonicalDoi(source.doi)));
  const ranked = rankScientificSources(candidates.filter((source) => !source.doi || !pinnedDois.has(canonicalDoi(source.doi))), intent);
  const citations = [
    ...pinned.map((source) => ({ source, reasons: ["Exact DOI explicitly requested in the question; preserved independently of broad-search ranking", "Provider metadata retrieved; full text and scientific conclusions not independently verified"] })),
    ...ranked.accepted,
  ].map(({ source, reasons }, i) => ({ ...source, id: `S${i + 1}`, relevanceReasons: reasons, verification: "Provider metadata retrieved; original conclusions not independently verified" }));
  const withAbstracts = citations.filter((s) => s.abstract);
  const rejectionReasons: Record<string, number> = {};
  for (const item of ranked.rejected) rejectionReasons[item.rejection!] = (rejectionReasons[item.rejection!] ?? 0) + 1;
  return {
    answer: citations.length
      ? `${citations.length} publications are available for review: ${pinned.length} explicitly requested DOI records and ${ranked.accepted.length} records passing the scientific metadata checks. ${withAbstracts.length} include provider abstracts; ${ranked.rejected.length} other candidates were excluded. Review the original sources before drawing a scientific conclusion.`
      : "The retrieved metadata does not establish an evidence-backed answer to this question. No requested DOI records or publications passing relevance checks were retrieved. Try a specific planetary body, mission, instrument, or scientific subject.",
    citations,
    findings: withAbstracts.map((s) => ({ text: s.abstract, sourceId: s.id })),
    providerStatus: status,
    diagnostics: {
      intent, ranking: "Metadata and lexical policy; no semantic model or vector index",
      candidates: candidates.length, accepted: citations.length, rejected: ranked.rejected.length,
      rejectionReasons, exactDois, providerQueries: tasks.map((task) => ({ provider: task.name, query: task.query })),
    },
    limitations: [
      "Literature discovery retrieves source metadata and abstracts. These excerpts are not a verified scientific synthesis or a substitute for the original paper.",
      "Relevance uses body, subject, mission, question-term and date rules. It is not semantic similarity, scientific confidence, or a peer-review assessment.",
      ...(pinned.length ? ["Explicitly requested DOI records are retained as user-selected context. Their inclusion is not a claim that they support the question or are relevant to mission planning."] : []),
      "Publication type does not establish peer review. Full texts, numerical calculations, terrain conditions and citation support have not been independently verified.",
      "Coverage is limited to the selected publication databases plus explicitly requested Crossref DOI records. Official mission datasets and MOMAR route calculations require separate connected adapters.",
      ...status.filter((s) => !s.ok).map((s) => `${s.name}: ${s.error}`),
    ],
    usage: { durationMs: Date.now() - start, sourcesRetrieved: citations.length, requests: tasks.length, model: null },
  };
}

export type ScientificArticle = Source & {
  body: PlanetaryBody | "both";
  topics: string[];
  relevanceReasons: string[];
  verification: "Provider metadata retrieved";
  peerReview: "Not established by this record";
};
export type ArticleDiscovery = {
  records: ScientificArticle[];
  retrievedAt: string;
  query: string;
  diagnostics: { provider: string; query: string; ok: boolean; candidates: number; accepted: number; excluded: number; error?: string }[];
  limitations: string[];
};
export async function discoverArticles(
  options: { body?: PlanetaryBody | "all"; query?: string; limit?: number } = {},
  fetcher = getJSON,
): Promise<ArticleDiscovery> {
  const body = options.body ?? "all";
  if (!["moon", "mars", "all"].includes(body)) throw new Error("Choose Moon, Mars or all worlds.");
  const query = (options.query ?? "").trim();
  if (query.length > 180) throw new Error("Use an article query of at most 180 characters.");
  const limit = Number.isFinite(options.limit) ? Math.min(24, Math.max(2, Math.floor(options.limit!))) : 8;
  const targets: PlanetaryBody[] = body === "all" ? ["moon", "mars"] : [body];
  const diagnostics: ArticleDiscovery["diagnostics"] = [];
  const batches = await Promise.all(targets.map(async (target) => {
    const term = query
      ? `${target === "moon" ? "lunar" : "Mars"} ${query}`
      : target === "moon" ? "lunar south pole terrain illumination ice observations" : "Mars rover Jezero Gale geology terrain observations";
    const intent = classifyResearch(term);
    try {
      const candidates = deduplicateSources(await searchCrossref(intent.query, Math.min(48, limit * 4), fetcher));
      const ranked = rankScientificSources(candidates, intent);
      const articles = ranked.accepted.map(({ source, reasons }) => ({
        ...source, body: classifySourceBody(source)!, topics: sourceTopics(source), relevanceReasons: reasons,
        verification: "Provider metadata retrieved" as const, peerReview: "Not established by this record" as const,
      })).filter((article) => article.body === target || article.body === "both");
      diagnostics.push({ provider: "Crossref", query: intent.query, ok: true, candidates: candidates.length, accepted: articles.length, excluded: candidates.length - articles.length });
      return articles.slice(0, body === "all" ? Math.ceil(limit / 2) : limit);
    } catch (error) {
      diagnostics.push({ provider: "Crossref", query: intent.query, ok: false, candidates: 0, accepted: 0, excluded: 0, error: error instanceof Error ? error.message : "Discovery failed." });
      return [];
    }
  }));
  const records: ScientificArticle[] = [];
  // Interleave the two worlds instead of letting one collection consume the page.
  const seen = new Set<string>();
  for (let i = 0; i < limit; i++) for (const batch of batches) {
    const article = batch[i];
    if (!article || records.length >= limit) continue;
    const key = article.doi?.toLowerCase() || article.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key); records.push({ ...article, id: `article-${records.length + 1}` });
  }
  return {
    records, retrievedAt: new Date().toISOString(), query,
    diagnostics,
    limitations: [
      "Live Crossref publication metadata, ranked by transparent body, subject, mission and question-term checks. This is not a comprehensive literature review.",
      "Publication year is distinct from retrieval time and observation date. Missing dates and abstracts remain unavailable.",
      "Peer review and source conclusions are not independently verified. No protected full text or unrelated illustrative imagery is republished.",
      "Official mission updates and dataset adapters are listed separately in the source registry; they are not part of this article feed yet.",
    ],
  };
}
