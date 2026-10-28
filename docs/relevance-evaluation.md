# Scientific relevance evaluation

Evaluation date: 28 October 2026. Implementation: `lib/science/relevance.ts` and `lib/science/retrieval.ts`. Reproducible checks: `tests/relevance.test.ts`, included in `npm test`.

## What is measured

The deterministic evaluation contains **12 manually labeled synthetic metadata fixtures**, evaluated against explicit Moon or Mars research questions. Six fixtures should be retained and six should be rejected. The labels exercise product requirements; they are neither an independent test set nor a random sample of a scientific database.

| Fixture | Expected result |
| --- | --- |
| Diviner lunar cold-trap observations for a lunar ice question | Retain |
| LOLA lunar slopes for terrain-hazard research | Retain |
| Perseverance observations for Jezero geology | Retain |
| Jezero terrain model for Martian mapping | Retain |
| Scientific terrain visualization containing “state of the art” | Retain |
| MEDA atmospheric observations for Martian weather | Retain |
| Martian measurements for a lunar question | Reject |
| Moon movie review | Reject |
| Mars music album | Reject |
| Mars chocolate marketing | Reject |
| Biomedical MARS acronym and hospital scheduling | Reject |
| Planetary name appearing only in popular culture | Reject |

Observed deterministic results:

| Measure | Count or calculation |
| --- | --- |
| True positives | 6 |
| False positives | 0 |
| True negatives | 6 |
| False negatives | 0 |
| Fixture precision | 6 / (6 + 0) = 100% |
| Fixture recall | 6 / (6 + 0) = 100% |
| Irrelevant-fixture rejection rate | 6 / (6 + 0) = 100% |

These percentages describe these twelve fixtures only. They must not be shown as SOZO's live scientific accuracy, evidence confidence, or production precision. The small set was designed alongside the rules and will underestimate unseen failure modes.

## Retrieval policy

The current classifier and ranking use explicit body aliases, scientific subjects, mission and instrument aliases, question-term overlap, publication year, available abstracts, and identifiers. The source registry describes actual connectivity. Scores are configurable policy weights, not calibrated probabilities. No vector index or semantic reranker is represented as implemented.

Results without scientific context, results about the wrong body, and entertainment or commercial distractors can be excluded on the server. Scientific visualization and education are not rejected merely for using the word “art.” Metadata cannot independently establish an observation, a paper's conclusions, peer review, spatial suitability, or mission safety.

## Exact publication context

When a question contains an explicit DOI, SOZO attempts a fixed-host Crossref lookup. Parsing accepts at most three unique identifiers with a standard `10.` prefix and a bounded modern DOI suffix. It does not accept arbitrary retrieval URLs. This deliberately restrictive parser does not cover every historical DOI syntax.

The returned record must match the requested DOI and include a title. Successful records are retained before broad-search ranking, labeled as explicitly requested context. Their inclusion does **not** establish relevance or support for the question. Missing abstracts remain missing; full text is not claimed to have been read. Lookup outages and mismatched records produce diagnostics and limitations instead of fabricated citations.

Regression tests cover DOI bounds and deduplication, retained context when broad search omits the selected work, provider identity mismatch, and a failed exact lookup alongside successful broad discovery. Other checks cover escaped metadata normalization, publication subtype labels, source failures, and missing abstracts.

## Live checks and their limits

A development search of Crossref returned four lunar and four Martian records, including “A New View of the Lunar South Pole from the Lunar Orbiter Laser Altimeter (LOLA)” (DOI `10.3847/psj/acf3e1`) and “A High-Resolution Digital Terrain Model Mosaic of the Mars 2020 Perseverance Rover Landing Site at Jezero Crater” (DOI `10.1029/2023ea003045`). This confirms retrieval and metadata handling for these requests, not scientific validation or a representative accuracy measurement.

Provider metadata for the inspected EGU and EPSC conference records used `posted-content` with subtype `other`. They are not labeled as preprints unless the provider explicitly supplies a preprint subtype. The UI reports provider metadata and review-status limitations.

Before reporting production precision, collect a larger, independently labeled holdout set covering ambiguous names, hard negative scientific records, multiple languages, missing abstracts, different scientific subjects, and live provider changes. Measure precision at the displayed result count, recall against an independently selected relevant set, rejection reasons, provider failures, and body/topic confusion. Keep the holdout separate from rule tuning.
