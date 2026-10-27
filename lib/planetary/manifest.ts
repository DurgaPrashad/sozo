export type PlanetaryBody = "moon" | "mars";
export type Dataset = {
  id: string;
  name: string;
  body: PlanetaryBody;
  category:
    | "Terrain"
    | "Imagery"
    | "Illumination"
    | "Resources"
    | "Geology"
    | "Names & missions";
  mode: "Integrated" | "Streamed" | "Derived" | "Archived" | "Catalogued";
  resolution: string;
  provider: string;
  coverage: string;
  detail: string;
  sourceUrl: string;
  verifiedInSozo: false;
  lastSynchronized: null;
};
export const coverageManifest = {
  version: "momar-brief-2026-10-27",
  reportedAt: "2026-10-27",
  provenance: "MOMAR project brief supplied by the workspace owner",
  verification: "Project-reported; not independently recomputed by SOZO",
  sourceUrl: "https://www.momar.si/",
  bodies: {
    moon: {
      name: "The Moon",
      areaKm2: 133000,
      primaryCells: 2310000,
      gridMeters: 240,
      extent: "South-pole workspace to ≈84°S",
      integratedOrDerivedSources: 20,
      notYetAvailable: 7,
      namedFeatures: 2045,
      locatedObjects: 71,
      regions: ["South pole", "Shackleton", "de Gerlache", "Haworth"],
      url: "https://www.momar.si/moon/south-pole/",
      globeUrl: "https://www.momar.si/moon/",
      limitations: [
        "Area describes a square polar-stereographic workspace, not uniform observational coverage.",
        "The overlapping 960 m far-field and 480 m Diviner grids are excluded from the primary-cell total.",
        "Potential ice and modelled stability do not establish confirmed ice.",
      ],
    },
    mars: {
      name: "Mars",
      areaKm2: 1410,
      primaryCells: 3650000,
      gridMeters: 20,
      extent: "Detailed Jezero + Gale workspaces",
      sourceCounts: { Jezero: 14, Gale: 9 },
      namedFeatures: 219,
      regions: ["Jezero Crater", "Gale Crater"],
      url: "https://www.momar.si/explore/",
      globeUrl: "https://www.momar.si/globe/",
      limitations: [
        "Regional source counts overlap; 14 Jezero and 9 Gale sources are not summed into a unique-source total.",
        "The supplied Mars inventory has 16 labels and does not identify ingestion status for every label.",
      ],
    },
  },
} as const;
export function planetaryMetrics() {
  return {
    ...coverageManifest,
    combinedPrimaryCells: Object.values(coverageManifest.bodies).reduce(
      (total, body) => total + body.primaryCells,
      0,
    ),
    methodology:
      "Sum the two project-reported primary terrain-cell counts. Retain each grid resolution. Exclude overlapping lunar far-field and Diviner grids. Do not interpret workspace area as uniform observation coverage.",
  };
}
type Row = [
  string,
  Dataset["category"],
  Dataset["mode"],
  string,
  string,
  string,
];
const lunar: Row[] = [
  [
    "LOLA south-pole terrain",
    "Terrain",
    "Integrated",
    "240 m grid",
    "NASA / LRO · LOLA",
    "Elevation, uncertainty, effective resolution, and laser return counts.",
  ],
  [
    "LOLA far-field terrain",
    "Terrain",
    "Integrated",
    "960 m grid",
    "NASA / LRO · LOLA",
    "Overlapping far-field coverage; excluded from primary cells.",
  ],
  [
    "LOLA 5 m slopes",
    "Terrain",
    "Streamed",
    "5 m product · inside 87°S",
    "NASA / LRO · LOLA",
    "Read live within the stated polar coverage in the MOMAR prototype.",
  ],
  [
    "Permanent shadows",
    "Illumination",
    "Integrated",
    "Source-dependent",
    "Barker et al. 2023",
    "Permanently shadowed regions; coverage and uncertainty must be inspected.",
  ],
  [
    "Surface roughness",
    "Terrain",
    "Integrated",
    "Source-dependent",
    "Barker et al. 2023",
    "Terrain roughness product used in the reported prototype.",
  ],
  [
    "LROC NAC mosaic",
    "Imagery",
    "Streamed",
    "1 m mosaic",
    "USGS / LROC",
    "High-resolution imagery is streamed; not uniformly observed everywhere.",
  ],
  [
    "ShadowCam mosaic",
    "Imagery",
    "Streamed",
    "1 m mosaic",
    "USGS / ShadowCam",
    "Imagery of permanently shadowed terrain where available.",
  ],
  [
    "USGS ice favorability",
    "Resources",
    "Integrated",
    "Source-dependent",
    "USGS",
    "Favorability index; not a confirmed ice detection.",
  ],
  [
    "Global LOLA elevation",
    "Terrain",
    "Integrated",
    "Global product",
    "NASA / LRO · LOLA",
    "Global lunar relief; distinct from local workspace grids.",
  ],
  [
    "LROC WAC imagery",
    "Imagery",
    "Integrated",
    "Global mosaic",
    "NASA / LRO · LROC",
    "Wide-angle camera imagery for the whole-Moon view.",
  ],
  [
    "Kaguya mineral maps",
    "Geology",
    "Integrated",
    "Source-dependent",
    "JAXA / Kaguya",
    "Mineralogical observations and their original interpretations.",
  ],
  [
    "USGS geologic map",
    "Geology",
    "Integrated",
    "Map-scale product",
    "USGS",
    "Regional geological units; not point-scale ground truth.",
  ],
  [
    "IAU feature names",
    "Names & missions",
    "Integrated",
    "2,045 names reported",
    "IAU",
    "Official lunar nomenclature, with record-level sources.",
  ],
  [
    "Human-made object locations",
    "Names & missions",
    "Integrated",
    "71 located objects",
    "LROC · Wagner et al. 2017",
    "Located objects only. Planned missions are not placed on the surface.",
  ],
  [
    "JPL Horizons",
    "Illumination",
    "Streamed",
    "Ephemeris-dependent",
    "NASA / JPL",
    "Sun and Earth ephemerides; specific calculations require the original query.",
  ],
  [
    "Terrain shadow products",
    "Illumination",
    "Derived",
    "Terrain-grid dependent",
    "MOMAR · derived",
    "Computed terrain shadows; inherits terrain and ephemeris uncertainty.",
  ],
  [
    "Lunar routes",
    "Terrain",
    "Derived",
    "Mission-dependent",
    "MOMAR · derived",
    "Shortest and lower-risk paths for explicit rover and travel constraints.",
  ],
  [
    "Diviner temperatures",
    "Resources",
    "Integrated",
    "480 m overlapping grid",
    "NASA / LRO · Diviner",
    "Cold traps below 110 K and modelled ice stability; excluded from primary cells.",
  ],
  [
    "LOLA Sun & Earth visibility",
    "Illumination",
    "Integrated",
    "Long-term product",
    "NASA / LRO · LOLA",
    "Long-term illumination and Earth visibility for the lunar workspace.",
  ],
  [
    "LROC NAC images",
    "Imagery",
    "Streamed",
    "Observation-dependent",
    "NASA / LRO · LROC",
    "Individual observations retain their own resolution, date, and footprint.",
  ],
];
const martian: Row[] = [
  [
    "CTX terrain",
    "Terrain",
    "Catalogued",
    "20 m workspace grid",
    "NASA / MRO · CTX",
    "Detailed terrain used by the reported regional workspaces.",
  ],
  [
    "CTX imagery",
    "Imagery",
    "Catalogued",
    "Source-dependent",
    "NASA / MRO · CTX",
    "Context-camera imagery with original observation footprints.",
  ],
  [
    "USGS geological map",
    "Geology",
    "Catalogued",
    "Map-scale product",
    "USGS",
    "Geological units and their source map scale.",
  ],
  [
    "CRISM mineral observations",
    "Geology",
    "Catalogued",
    "Observation-dependent",
    "NASA / MRO · CRISM",
    "Mineralogical interpretation requires observation-level quality checks.",
  ],
  [
    "Perseverance & Curiosity traverses",
    "Names & missions",
    "Catalogued",
    "Mission-dependent",
    "NASA / JPL",
    "Recorded rover traverses; not new routes computed by SOZO.",
  ],
  [
    "IAU feature names",
    "Names & missions",
    "Catalogued",
    "219 features reported",
    "IAU",
    "Official Mars nomenclature in the reported globe.",
  ],
  [
    "HiRISE terrain",
    "Terrain",
    "Catalogued",
    "Source-dependent",
    "NASA / MRO · HiRISE",
    "High-resolution terrain where stereo products exist.",
  ],
  [
    "MEDA weather observations",
    "Resources",
    "Archived",
    "Archived observations",
    "NASA / Mars 2020 · MEDA",
    "Archived weather observations, not live telemetry.",
  ],
  [
    "Perseverance images",
    "Imagery",
    "Catalogued",
    "Observation-dependent",
    "NASA / JPL",
    "Mission imaging archive.",
  ],
  [
    "THEMIS thermal inertia",
    "Resources",
    "Catalogued",
    "Source-dependent",
    "NASA / Mars Odyssey · THEMIS",
    "Thermal product and its interpretation.",
  ],
  [
    "TES thermal inertia",
    "Resources",
    "Catalogued",
    "Source-dependent",
    "NASA / Mars Global Surveyor · TES",
    "Thermal-inertia measurements and derived products.",
  ],
  [
    "HiRISE imagery",
    "Imagery",
    "Catalogued",
    "Observation-dependent",
    "NASA / MRO · HiRISE",
    "High-resolution imagery with footprint limits.",
  ],
  [
    "THEMIS infrared",
    "Imagery",
    "Catalogued",
    "Observation-dependent",
    "NASA / Mars Odyssey · THEMIS",
    "Infrared imaging observations.",
  ],
  [
    "MOLA relief",
    "Terrain",
    "Catalogued",
    "Global product",
    "NASA / Mars Global Surveyor · MOLA",
    "Global Mars relief.",
  ],
  [
    "MSL Gale DEM",
    "Terrain",
    "Catalogued",
    "Source-dependent",
    "NASA / MSL / USGS",
    "Gale Crater terrain reference.",
  ],
  [
    "CTX mosaic",
    "Imagery",
    "Catalogued",
    "Source-dependent",
    "NASA / MRO · CTX",
    "Context imagery mosaic; not unique additional territory.",
  ],
];
export const datasets: Dataset[] = [
  ...lunar.map((r, i) => toDataset(r, "moon", i)),
  ...martian.map((r, i) => toDataset(r, "mars", i)),
];
function toDataset(
  [name, category, mode, resolution, provider, detail]: Row,
  body: PlanetaryBody,
  index: number,
): Dataset {
  return {
    id: `${body}-${index + 1}`,
    name,
    body,
    category,
    mode,
    resolution,
    provider,
    coverage:
      body === "moon"
        ? "Lunar south pole / global products"
        : "Jezero, Gale / global products",
    detail,
    sourceUrl:
      body === "moon"
        ? "https://www.momar.si/moon/south-pole/"
        : "https://www.momar.si/",
    verifiedInSozo: false,
    lastSynchronized: null,
  };
}
export const lunarCapabilities = [
  {
    letter: "A",
    title: "Terrain & light",
    subtitle: "See the surface. Understand the shadows.",
    image: "moon-light",
    specifics: [
      "Terrain products retain uncertainty, effective resolution, and laser return counts.",
      "USGS streams LROC NAC and ShadowCam 1 m mosaics, including available observations within permanent shadows.",
      "Sunlight at a chosen moment is computed from terrain and JPL Horizons in the MOMAR prototype.",
    ],
    detail:
      "LOLA 240 m terrain with uncertainty and return counts. Live 5 m slopes inside 87°S. LROC NAC and ShadowCam mosaics, plus long-term Sun and Earth visibility.",
  },
  {
    letter: "B",
    title: "A route with a reason",
    subtitle: "Compare distance. Inspect the trade-offs.",
    image: "moon-routes",
    specifics: [
      "Compare shortest and lower-risk routes with up to eight stops.",
      "Inspect sunlight and Earth line of sight along the route, plus a return-to-start check.",
      "Battery estimates use the mission figures you provide.",
    ],
    detail:
      "Shortest and lower-risk routes with up to eight stops, for an Apollo LRV-class rover, a VIPER-class rover, or on foot. Slope, roughness, shadow, and terrain quality inform risk.",
  },
  {
    letter: "C",
    title: "Follow the resource evidence",
    subtitle: "Potential is a question, not a discovery.",
    image: "moon-ice",
    specifics: [
      "Barker et al. 2023 supplies permanent-shadow and roughness products.",
      "Diviner cold traps use the reported threshold below 110 K.",
      "Favorability and modelled stability are evidence to investigate, never confirmed ice.",
    ],
    detail:
      "Permanent shadows and roughness from Barker et al. 2023, Diviner cold traps below 110 K, modelled ice-stability depth, and USGS favorability. Never presented as confirmed ice.",
  },
  {
    letter: "D",
    title: "A different perspective",
    subtitle: "Play back the route in three dimensions.",
    image: "moon-3d-playback",
    specifics: [
      "Playback follows LOLA 5 m terrain with an Apollo LRV and an astronaut.",
      "The project reports a Sun/Earth ephemeris check against JPL Horizons to 0.00002°; SOZO has not independently repeated that validation.",
      "Terrain shadows are computed; nearby craters, rocks, and dust are labelled illustrative.",
    ],
    detail:
      "MOMAR prototype playback on LOLA 5 m terrain, with Sun and Earth positioned using JPL Horizons. Close-range craters, rocks, and dust are illustrative.",
  },
  {
    letter: "E",
    title: "The whole Moon, connected",
    subtitle: "Every landmark has a history.",
    image: "moon-globe",
    specifics: [
      "The object inventory cites LROC and Wagner et al. 2017, with evidence for each location.",
      "Apollo, Luna, Chang’e, and other located landers are distinct from planned missions.",
      "The globe combines LROC WAC, global LOLA elevation, Kaguya mineral maps, and USGS geology.",
    ],
    detail:
      "2,045 IAU names and 71 located human-made objects from LROC. WAC imagery, global elevation, mineral maps, geology, and evidence for each object. Planned missions stay off the surface.",
  },
  {
    letter: "F",
    title: "From investigation to mission",
    subtitle: "Keep the reasoning with the route.",
    image: "moon-mission-plan",
    specifics: [
      "The dark PDF report preserves distance, mission time, steepest cell, both routes, and arrival visibility.",
      "GeoJSON exports include routes and stops.",
      "The MOMAR Mission Scientist uses computed values; the brief describes optional Claude with a user-supplied key and numeric checks. This is an external prototype capability.",
    ],
    detail:
      "The MOMAR prototype reports both routes, timeline, sources, limits, sunlight, Earth visibility, and science along the way. PDF and GeoJSON exports preserve the plan.",
  },
];
