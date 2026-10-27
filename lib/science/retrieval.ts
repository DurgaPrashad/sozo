import type { Source, ResearchResult } from "./types";
export function plainText(value: unknown): string {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
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
export async function getJSON(url: string) {
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "SOZO-Research/0.1" },
    redirect: "manual",
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok)
    throw new Error(
      response.status === 429
        ? "Source rate limit reached. Try again shortly."
        : `Source returned HTTP ${response.status}.`,
    );
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
export async function searchCrossref(
  question: string,
  limit: number,
  fetcher = getJSON,
): Promise<Source[]> {
  const url = new URL("https://api.crossref.org/works");
  url.searchParams.set("query.bibliographic", question);
  url.searchParams.set("rows", String(limit));
  const data = await fetcher(url.toString());
  const at = new Date().toISOString();
  return (data.message?.items ?? []).map(
    (item: Record<string, any>, i: number) => ({
      id: `crossref-${i}`,
      title: plainText(item.title?.[0]),
      authors:
        (item.author ?? [])
          .slice(0, 4)
          .map((a: any) => [a.given, a.family].filter(Boolean).join(" "))
          .join(", ") || "Author information unavailable",
      year: String(item.published?.["date-parts"]?.[0]?.[0] ?? ""),
      journal: plainText(item["container-title"]?.[0] ?? item.publisher),
      doi: item.DOI,
      url: item.DOI
        ? `https://doi.org/${encodeURIComponent(item.DOI).replace(/%2F/g, "/")}`
        : "https://search.crossref.org/",
      abstract: plainText(item.abstract).slice(0, 5000),
      provider: "Crossref",
      type:
        item.type === "posted-content"
          ? "Preprint"
          : item.type === "journal-article"
            ? "Journal article"
            : plainText(item.type || "Publication"),
      retrievedAt: at,
    }),
  );
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
export async function retrieveEvidence(
  question: string,
  providers: string[],
  mode: string,
): Promise<ResearchResult> {
  const start = Date.now();
  const limit = mode === "broad" ? 8 : 4;
  const results = await Promise.allSettled(
    providers.map((name) =>
      name === "crossref"
        ? searchCrossref(question, limit)
        : searchEuropePMC(question, limit),
    ),
  );
  const status = results.map((r, i) => ({
    name: providers[i] === "crossref" ? "Crossref" : "Europe PMC",
    ok: r.status === "fulfilled",
    count: r.status === "fulfilled" ? r.value.length : 0,
    ...(r.status === "rejected"
      ? {
          error:
            r.reason instanceof Error
              ? r.reason.message
              : "Source unavailable.",
        }
      : {}),
  }));
  const citations = deduplicateSources(
    results.flatMap((r) => (r.status === "fulfilled" ? r.value : [])),
  );
  const withAbstracts = citations.filter((s) => s.abstract);
  return {
    answer: citations.length
      ? `This search retrieved ${citations.length} unique publications from ${status
          .filter((s) => s.ok)
          .map((s) => s.name)
          .join(
            " and ",
          )}. ${withAbstracts.length} include abstracts you can inspect below. Results are ranked by the source databases; relevance and scientific conclusions require your review.`
      : "No publications were retrieved for this question. Try a shorter query with specific scientific terms, or select another source.",
    citations,
    findings: withAbstracts.map((s) => ({ text: s.abstract, sourceId: s.id })),
    providerStatus: status,
    limitations: [
      "Literature discovery mode: no language model is configured. SOZO provides source metadata and abstracts, not an AI-generated scientific conclusion.",
      "Search ranking is not an assessment of evidence quality. Publication type does not establish peer review; verify the original publication.",
      "Coverage is limited to the selected databases. Full texts, calculations, and citation support have not been independently verified.",
      ...status.filter((s) => !s.ok).map((s) => `${s.name}: ${s.error}`),
    ],
    usage: {
      durationMs: Date.now() - start,
      sourcesRetrieved: citations.length,
      requests: providers.length,
      model: null,
    },
  };
}
