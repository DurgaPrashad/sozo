import type { Source } from "./types";

export type PlanetaryBody = "moon" | "mars";
export type ResearchIntent = {
  body: PlanetaryBody | "both" | null;
  topics: string[];
  missions: string[];
  years: string[];
  terms: string[];
  planetary: boolean;
  explicitCulture: boolean;
  query: string;
};

// These weights express a retrieval policy, not calibrated scientific confidence.
export const relevanceWeights = {
  body: 7, topic: 3, mission: 4, titleTerm: 2, contentTerm: 1,
  identifier: 1, abstract: 1, year: 2,
} as const;

const bodies = {
  moon: /\b(moon|lunar|selenolog\w*|shackleton|de gerlache|haworth|lro|lunar reconnaissance orbiter|lola|lroc|shadowcam|diviner|chandrayaan|chang'?e|artemis|kaguya)\b/i,
  mars: /\b(mars|martian|jezero|gale crater|olympus mons|valles marineris|perseverance|curiosity|mro|hirise|crism|mola|meda|sherloc|supercam)\b/i,
};
const subjects: Record<string, RegExp> = {
  "Geology": /\b(geolog\w*|geomorph\w*|crater\w*|regolith|sediment\w*|volcan\w*|tectonic\w*)\b/i,
  "Terrain & navigation": /\b(terrain|topograph\w*|elevation|slope\w*|rover|travers\w*|navigat\w*|route\w*|hazard\w*|roughness|dem)\b/i,
  "Landing sites": /\b(landing|lander|site selection|site suitability)\b/i,
  "Mineralogy": /\b(mineral\w*|spectroscop\w*|spectrom\w*|basalt\w*|olivine|pyroxene|hydrated|crism)\b/i,
  "Ice & illumination": /\b(ice|water|cold trap\w*|shadow\w*|illumination|sunlight|volatile\w*|diviner)\b/i,
  "Atmosphere": /\b(atmospher\w*|weather|dust|temperature|pressure|climate|meda)\b/i,
  "Missions & instruments": /\b(mission\w*|spacecraft|instrument\w*|orbiter|orbital|imagery|observation\w*|sensor\w*)\b/i,
  "Datasets & methods": /\b(dataset\w*|provenance|licens\w*|algorithm\w*|model\w*|calculation\w*|simulation\w*|mapping)\b/i,
};
const missionPatterns: [string, RegExp][] = [
  ["LRO", /\blro\b|lunar reconnaissance orbiter/i], ["LOLA", /\blola\b|lunar orbiter laser altimeter/i], ["LROC", /\blroc\b|lunar reconnaissance orbiter camera/i],
  ["ShadowCam", /\bshadowcam\b/i], ["Diviner", /\bdiviner\b/i], ["Chandrayaan", /\bchandrayaan[ -]?\d*/i],
  ["Artemis", /\bartemis\b/i], ["Chang'e", /\bchang'?e\b/i], ["Kaguya", /\bkaguya\b/i],
  ["Perseverance", /\bperseverance\b|mars 2020/i], ["Curiosity", /\bcuriosity\b|mars science laboratory/i],
  ["HiRISE", /\bhirise\b/i], ["CRISM", /\bcrism\b/i], ["MOLA", /\bmola\b/i],
  ["MEDA", /\bmeda\b/i], ["SHERLOC", /\bsherloc\b/i], ["SuperCam", /\bsupercam\b/i],
];
const scienceContext = /\b(planet\w*|lunar|martian|geolog\w*|geomorph\w*|regolith|crater\w*|rover\w*|orbiter\w*|landing|topograph\w*|terrain|mineral\w*|spectroscop\w*|atmospher\w*|spacecraft|astrobiolog\w*|biosignature\w*|remote sensing|solar wind|south pole|polar region\w*|water ice|permanent\w* shadow\w*|illumination|volatil\w*|lola|lroc|diviner|shadowcam|hirise|crism|mola|chandrayaan)\b/i;
const culture = /\b(movie|movies|cinema|cinematic|film|films|television|tv series|music|lyrics|song|songs|album|celebrity|fashion|advertising|brand marketing|chocolate|candy bar|box office|soundtrack|video game|fictional)\b/i;
const stop = new Set("a an the and or of for to in on at by with from what which how why is are was were do does can could should would about study studies research evidence scientific science recent latest new findings compare comparison show find explain investigate us our their its into between using use based not this that planetary moon lunar mars martian".split(" "));

export function classifyResearch(question: string): ResearchIntent {
  const clean = question.normalize("NFKC").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 1200);
  const moon = bodies.moon.test(clean), mars = bodies.mars.test(clean);
  const topics = Object.entries(subjects).filter(([, pattern]) => pattern.test(clean)).map(([name]) => name);
  const missions = missionPatterns.filter(([, pattern]) => pattern.test(clean)).map(([name]) => name);
  const terms = [...new Set((clean.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) ?? []).filter((term) => !stop.has(term)))].slice(0, 24);
  const body = moon && mars ? "both" : moon ? "moon" : mars ? "mars" : null;
  const explicitCulture = culture.test(clean);
  const planetary = !!body && !explicitCulture || scienceContext.test(clean);
  const qualifier = body === "moon" ? "lunar planetary science" : body === "mars" ? "Mars planetary science" : body === "both" ? "lunar Mars planetary science" : "";
  // Database query syntax is never taken from a document or provider result.
  const query = `${clean.replace(/["{}<>]/g, " ")} ${planetary && !explicitCulture ? qualifier : ""}`.replace(/\s+/g, " ").trim();
  return { body, topics, missions, terms, years: [...new Set(clean.match(/\b(?:19|20)\d{2}\b/g) ?? [])], planetary, explicitCulture, query };
}

export function classifySourceBody(source: Pick<Source, "title" | "abstract">): PlanetaryBody | "both" | null {
  const text = `${source.title} ${source.abstract}`;
  const moon = bodies.moon.test(text), mars = bodies.mars.test(text);
  return moon && mars ? "both" : moon ? "moon" : mars ? "mars" : null;
}

export function sourceTopics(source: Pick<Source, "title" | "abstract">): string[] {
  const text = `${source.title} ${source.abstract}`;
  return Object.entries(subjects).filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
}

export type RankedSource = { source: Source; score: number; reasons: string[]; accepted: boolean; rejection?: string };
export function assessRelevance(source: Source, intent: ResearchIntent): RankedSource {
  const text = `${source.title} ${source.abstract}`.toLowerCase();
  const title = source.title.toLowerCase();
  const reasons: string[] = [];
  const rejected = (rejection: string): RankedSource => ({ source, score: 0, reasons, accepted: false, rejection });
  if (!source.title.trim() || !/^https:\/\//i.test(source.url)) return rejected("Missing title or secure source URL");
  if (!intent.explicitCulture && culture.test(source.title) && !scienceContext.test(source.title)) return rejected("Entertainment or commercial title without scientific context");
  const body = classifySourceBody(source);
  if (intent.planetary && !scienceContext.test(text)) return rejected("No planetary science context in the retrieved title or abstract");
  if (intent.body && intent.body !== "both" && body !== intent.body && body !== "both") return rejected("Requested planetary body absent from retrieved metadata");
  let score = 0;
  if (intent.body && body && (intent.body === "both" || body === intent.body || body === "both")) { score += relevanceWeights.body; reasons.push(`Matches ${body === "moon" ? "the Moon" : body === "mars" ? "Mars" : "both worlds"}`); }
  const topics = sourceTopics(source).filter((topic) => intent.topics.includes(topic));
  score += topics.length * relevanceWeights.topic;
  if (topics.length) reasons.push(`Subject: ${topics.join(", ")}`);
  const missions = missionPatterns.filter(([name, pattern]) => intent.missions.includes(name) && pattern.test(text)).map(([name]) => name);
  score += missions.length * relevanceWeights.mission;
  if (missions.length) reasons.push(`Mission or instrument: ${missions.join(", ")}`);
  const matched = intent.terms.filter((term) => new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:s|es)?\\b`, "i").test(text));
  score += matched.reduce((n, term) => n + (title.includes(term) ? relevanceWeights.titleTerm : relevanceWeights.contentTerm), 0);
  if (matched.length) reasons.push(`Question terms: ${matched.slice(0, 6).join(", ")}`);
  if (source.doi) score += relevanceWeights.identifier;
  if (source.abstract) { score += relevanceWeights.abstract; reasons.push("Provider abstract available"); }
  if (intent.years.includes(source.year)) { score += relevanceWeights.year; reasons.push(`Publication year ${source.year}`); }
  // The body alone is insufficient when the question asks a specific subject.
  if (intent.planetary && intent.topics.length && !topics.length && !missions.length && matched.length < 2) return rejected("Planetary name matches, but the requested scientific subject does not");
  if (!intent.body && intent.terms.length && matched.length === 0) return rejected("No question terms in retrieved metadata");
  return { source, score, reasons, accepted: true };
}

export function rankScientificSources(sources: Source[], intent: ResearchIntent) {
  const assessed = sources.map((source) => assessRelevance(source, intent));
  return { accepted: assessed.filter((item) => item.accepted).sort((a, b) => b.score - a.score), rejected: assessed.filter((item) => !item.accepted) };
}

export const scientificSourceRegistry = [
  { name: "Crossref", domain: "api.crossref.org", tier: 2, type: "Publication metadata", subjects: ["All sciences"], connectivity: "Live API", method: "REST works search", usage: "Provider metadata; inspect publisher terms for abstracts and full text." },
  { name: "Europe PMC", domain: "www.ebi.ac.uk", tier: 2, type: "Publication metadata", subjects: ["Life sciences", "Astrobiology"], connectivity: "Live API", method: "REST core search", usage: "Preserve provider identifiers; full-text rights vary by article." },
  { name: "NASA / JPL / PDS", domain: "nasa.gov", tier: 1, type: "Mission archives and datasets", subjects: ["Moon", "Mars"], connectivity: "NASA media archive connected separately; PDS scientific retrieval not connected", method: "NASA media REST; PDS integration planned", usage: "Preserve product identifiers, credits and individual usage conditions." },
  { name: "USGS Astrogeology", domain: "astrogeology.usgs.gov", tier: 1, type: "Planetary maps", subjects: ["Moon", "Mars"], connectivity: "Reference links only", method: "Not yet connected to research retrieval", usage: "Retain map authorship, product version and metadata." },
  { name: "ESA PSA", domain: "archives.esac.esa.int", tier: 1, type: "Mission datasets", subjects: ["Planetary science"], connectivity: "Not connected", method: "Archive adapter required", usage: "Observe mission-specific release and acknowledgement terms." },
  { name: "ISRO / JAXA", domain: "isro.gov.in / jaxa.jp", tier: 1, type: "Mission archives", subjects: ["Moon", "Planetary science"], connectivity: "Not connected", method: "Archive adapters required", usage: "Check dataset-level licensing and acknowledgement requirements." },
] as const;
