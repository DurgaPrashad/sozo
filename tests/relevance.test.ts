import test from "node:test";
import assert from "node:assert/strict";
import { classifyResearch, assessRelevance, rankScientificSources } from "../lib/science/relevance";
import { discoverArticles, retrieveEvidence, plainText, crossrefPublicationType, extractRequestedDois } from "../lib/science/retrieval";
import type { Source } from "../lib/science/types";

const source = (title: string, abstract = ""): Source => ({ id: "x", title, abstract, authors: "A. Scientist", journal: "Planetary Science", year: "2024", url: "https://doi.org/10.1234/test", doi: "10.1234/test", type: "Journal article", provider: "Crossref", retrievedAt: "2026-10-28T00:00:00Z" });

test("normalizes repeatedly escaped markup, decimal and hexadecimal entities", () => {
  assert.equal(plainText("&amp;lt;p&amp;gt;The NASA rover&amp;#8217;s terrain &amp;#8211; a study&amp;lt;/p&amp;gt;"), "The NASA rover’s terrain – a study");
  assert.equal(plainText("&lt;jats:p&gt;Moon &amp;amp; Mars &amp;#x2014; 20&nbsp;m&lt;/jats:p&gt;"), "Moon & Mars — 20 m");
  assert.equal(plainText("LOLA &plusmn; 5&#176; &Delta;T"), "LOLA ± 5° ΔT");
});

test("decoded markup stays plain text and invalid code points cannot crash discovery", () => {
  assert.equal(plainText("&lt;img src=x onerror=alert(1)&gt;Lunar &lt;script&gt;alert(1)&lt;/script&gt;terrain"), "Lunar terrain");
  assert.equal(plainText("&#x110000; &#0; &#xD800;"), "� � �");
  assert.equal(plainText("1 < 5 and 7 > 3"), "1 < 5 and 7 > 3");
});

test("posted content is a preprint only when the provider subtype establishes it", () => {
  assert.equal(crossrefPublicationType({ type: "posted-content", subtype: "preprint" }), "Preprint");
  assert.equal(crossrefPublicationType({ type: "posted-content", subtype: "presentation" }), "Presentation");
  assert.equal(crossrefPublicationType({ type: "posted-content", subtype: "other", "group-title": "oral" }), "Posted content · other");
  assert.equal(crossrefPublicationType({ type: "posted-content" }), "Posted content (subtype unavailable)");
  assert.equal(crossrefPublicationType({ type: "proceedings-article" }), "Conference paper");
});

test("identifies instrument, lunar body, topic and requested year", () => {
  const intent = classifyResearch("LOLA slopes and illumination near Shackleton in 2024");
  assert.equal(intent.body, "moon");
  assert.ok(intent.missions.includes("LOLA"));
  assert.ok(intent.topics.includes("Ice & illumination"));
  assert.deepEqual(intent.years, ["2024"]);
  assert.match(intent.query, /lunar planetary science/);
});

test("planetary science screening rejects movie, music and acronym distractors", () => {
  const intent = classifyResearch("Mars rover terrain and geology");
  const irrelevant = [source("Mars: a science fiction film", "A rover on a fictional planet."), source("Mars music album review"), source("MARS model improves hospital scheduling", "A model of hospital routes and staff allocation.")];
  for (const candidate of irrelevant) assert.equal(assessRelevance(candidate, intent).accepted, false, candidate.title);
});

test("preserves scientific visualizations and educational planetary content", () => {
  const intent = classifyResearch("Mars terrain mapping");
  assert.equal(assessRelevance(source("State of the art in Martian terrain mapping", "Scientific visualization of rover elevation maps."), intent).accepted, true);
});

test("body and topic must match, while requested instruments rank higher", () => {
  const intent = classifyResearch("Lunar LOLA slopes and terrain hazards");
  assert.equal(assessRelevance(source("Mars rover terrain hazards", "Slopes at Jezero."), intent).accepted, false);
  const ranked = rankScientificSources([
    source("Lunar terrain hazards", "Lunar regolith slope measurements."),
    source("LOLA lunar terrain slopes", "Terrain hazards from LOLA elevation measurements."),
  ], intent);
  assert.match(ranked.accepted[0].source.title, /^LOLA/);
});

test("explicit culture question is not silently rewritten as planetary science", () => {
  const intent = classifyResearch("Moon movie soundtrack");
  assert.equal(intent.explicitCulture, true);
  assert.doesNotMatch(intent.query, /planetary science/);
  assert.equal(assessRelevance(source("Moon movie soundtrack"), intent).accepted, true);
});

test("article discovery returns actual provider records, excludes distractors, keeps missing abstract", async () => {
  const result = await discoverArticles({ body: "moon", limit: 4 }, async () => ({ message: { items: [
    { title: ["Lunar south pole terrain illumination"], DOI: "10.1234/lunar", type: "journal-article", published: { "date-parts": [[2024]] } },
    { title: ["Moon movie review"], DOI: "10.1234/movie" },
    { title: ["Mars atmospheric observations"], DOI: "10.1234/mars" },
  ] } }));
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].title, "Lunar south pole terrain illumination");
  assert.equal(result.records[0].abstract, "");
  assert.equal(result.records[0].peerReview, "Not established by this record");
  assert.equal(result.diagnostics[0].excluded, 2);
});

test("article discovery exposes provider failure without manufacturing cards", async () => {
  const result = await discoverArticles({ body: "mars" }, async () => { throw new Error("Provider outage"); });
  assert.equal(result.records.length, 0);
  assert.equal(result.diagnostics[0].ok, false);
  assert.equal(result.diagnostics[0].error, "Provider outage");
});

test("unknown research providers are never routed to another provider", async () => {
  const result = await retrieveEvidence("Lunar geology", ["unknown"], "focused");
  assert.equal(result.providerStatus.length, 0);
  assert.equal(result.usage.requests, 0);
  assert.equal(result.citations.length, 0);
});

test("requested DOI extraction is bounded, deduplicated and trims sentence punctuation", () => {
  assert.deepEqual(extractRequestedDois("Inspect (https://doi.org/10.3847/PSJ/acf3e1). DOI:10.3847/psj/acf3e1; plus 10.1029/2023ea003045, 10.3390/rs18020310 and 10.1234/fourth."), ["10.3847/psj/acf3e1", "10.1029/2023ea003045", "10.3390/rs18020310"]);
  assert.deepEqual(extractRequestedDois("10.1/not-a-real-prefix 10.1234/"), []);
  assert.deepEqual(extractRequestedDois("10.1234/" + "a".repeat(201)), []);
});

test("explicit DOI context remains even when broad-search ranking would omit its title", async () => {
  const urls: string[] = [];
  const result = await retrieveEvidence("Explain lunar terrain hazards in selected DOI: 10.1234/selected.", ["crossref"], "focused", async (url) => {
    urls.push(url);
    return url.includes("?")
      ? { message: { items: [{ DOI: "10.1234/unrelated", title: ["Moon movie soundtrack"], type: "posted-content" }] } }
      : { message: { DOI: "10.1234/SELECTED", title: ["The selected observation record"], type: "journal-article" } };
  });
  assert.equal(result.citations.length, 1);
  assert.equal(result.citations[0].doi, "10.1234/SELECTED");
  assert.equal(result.citations[0].title, "The selected observation record");
  assert.equal(result.citations[0].abstract, "");
  assert.equal(result.diagnostics.exactDois[0].ok, true);
  assert.equal(result.diagnostics.rejected, 1);
  assert.equal(result.usage.requests, 2);
  assert.ok(urls.includes("https://api.crossref.org/works/10.1234%2Fselected"));
  assert.match(result.limitations.join(" "), /user-selected context/);
});

test("DOI lookup mismatch is diagnosed and never replaced by a fabricated citation", async () => {
  const result = await retrieveEvidence("Inspect DOI: 10.1234/requested", [], "focused", async () => ({ message: { DOI: "10.1234/different", title: ["A different work"] } }));
  assert.equal(result.citations.length, 0);
  assert.equal(result.diagnostics.exactDois[0].ok, false);
  assert.match(result.diagnostics.exactDois[0].error!, /different or missing DOI/);
  assert.equal(result.providerStatus[0].ok, false);
});

test("DOI lookup outage retains successful broad discovery and reports the missing exact record", async () => {
  const result = await retrieveEvidence("Lunar terrain DOI: 10.1234/missing", ["crossref"], "focused", async (url) => {
    if (!url.includes("?")) throw new Error("Requested DOI unavailable");
    return { message: { items: [{ DOI: "10.1234/terrain", title: ["Lunar terrain mapping"], abstract: "LOLA elevation and terrain observations." }] } };
  });
  assert.equal(result.citations.length, 1);
  assert.equal(result.citations[0].doi, "10.1234/terrain");
  assert.equal(result.diagnostics.exactDois[0].ok, false);
  assert.ok(result.limitations.some((item) => item.includes("Requested DOI unavailable")));
});

const evaluationFixtures: { label: string; question: string; candidate: Source; relevant: boolean }[] = [
  { label: "lunar shadow observations", question: "Lunar south pole ice and illumination", candidate: source("Diviner lunar south pole cold traps", "Lunar water ice stability in permanently shadowed terrain."), relevant: true },
  { label: "lunar terrain route evidence", question: "LOLA lunar slopes and terrain hazards", candidate: source("Lunar slopes measured by LOLA", "Terrain elevation, slopes and roughness for traverse planning."), relevant: true },
  { label: "Mars rover geology", question: "Mars rover geology at Jezero", candidate: source("Perseverance rover sampling in Jezero crater", "Martian geological and mineralogical observations."), relevant: true },
  { label: "Mars terrain model", question: "Mars terrain mapping", candidate: source("A terrain model of Jezero crater, Mars", "Orbital imagery and terrain mapping."), relevant: true },
  { label: "scientific visualization", question: "Mars terrain mapping", candidate: source("State of the art in Martian terrain visualization", "Scientific elevation mapping and rover route visualization."), relevant: true },
  { label: "Mars atmosphere", question: "Mars atmosphere MEDA observations", candidate: source("MEDA measurements of the Martian atmosphere", "Pressure, weather and dust observations from Mars."), relevant: true },
  { label: "wrong world", question: "Lunar south pole illumination", candidate: source("Mars rover terrain", "Martian illumination measurements."), relevant: false },
  { label: "film distractor", question: "Lunar geology", candidate: source("Moon movie review", "A film set on the Moon."), relevant: false },
  { label: "music distractor", question: "Mars terrain mapping", candidate: source("Mars music album", "A musical journey."), relevant: false },
  { label: "commercial homonym", question: "Mars geology", candidate: source("Mars chocolate brand marketing", "Commercial product promotion."), relevant: false },
  { label: "biomedical acronym", question: "Mars rover navigation", candidate: source("MARS scheduling model for hospitals", "Clinical staff routes and patient scheduling."), relevant: false },
  { label: "name-only mention", question: "Mars atmosphere", candidate: source("Mars in popular culture", "Artistic depictions in a gallery."), relevant: false },
];
test("labeled deterministic relevance fixtures report precision and rejection counts", () => {
  let truePositive = 0, falsePositive = 0, trueNegative = 0, falseNegative = 0;
  for (const fixture of evaluationFixtures) {
    const accepted = assessRelevance(fixture.candidate, classifyResearch(fixture.question)).accepted;
    if (fixture.relevant && accepted) truePositive++;
    else if (fixture.relevant) falseNegative++;
    else if (accepted) falsePositive++;
    else trueNegative++;
    assert.equal(accepted, fixture.relevant, fixture.label);
  }
  assert.deepEqual({ truePositive, falsePositive, trueNegative, falseNegative }, { truePositive: 6, falsePositive: 0, trueNegative: 6, falseNegative: 0 });
  assert.equal(truePositive / (truePositive + falsePositive), 1);
  assert.equal(trueNegative / (trueNegative + falsePositive), 1);
});
