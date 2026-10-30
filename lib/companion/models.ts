// The models and engines behind SOZO, shared by the landing page and
// GET /api/companion/models. Status is what a visitor can use today:
// live (served by this API), ready (connect it with a server key), prototype
// (in the external MOMAR planner) or planned.
export type ModelStatus = "live" | "ready" | "prototype" | "planned";
export type ModelCategory = "Space science" | "Rockets & engines" | "Orbital calculations" | "Planetary zones" | "Planets & imagery" | "Voice";
export type SozoModel = {
  id: string;
  name: string;
  category: ModelCategory;
  provider: string;
  model: string | null;
  status: ModelStatus;
  summary: string;
  capabilities: string[];
  // How to reach it; null when it is not served by the SOZO API.
  access: { method: "GET" | "POST"; path: string; use: string } | null;
  // Which server setting it needs: "sarvam" or "meta".
  requires?: "sarvam" | "meta";
};

export const SOZO_MODELS: SozoModel[] = [
  {
    id: "sozo-mission-scientist",
    name: "SOZO Mission Scientist",
    category: "Space science",
    provider: "Sarvam AI",
    model: "sarvam-105b-conversations",
    status: "live",
    summary: "Answers questions about the Moon, Mars, the planets, spacecraft, rockets and orbital mechanics, citing the publications it retrieved.",
    capabilities: ["Mission and planetary science", "Route and map context", "Numbered citations"],
    access: { method: "POST", path: "/api/companion/chat", use: "message, optional context" },
    requires: "sarvam",
  },
  {
    id: "sozo-astro-calculator",
    name: "Astro Calculator",
    category: "Orbital calculations",
    provider: "SOZO exact engine",
    model: "astro_calculator",
    status: "live",
    summary: "Exact two-body maths for the Sun, eight planets, the Moon, Pluto and Ceres. The model calls it for every number it can compute.",
    capabilities: ["Circular orbit speed and period", "Escape velocity", "Hohmann and planet-to-planet transfers", "Synodic period"],
    access: { method: "POST", path: "/api/companion/chat", use: "results arrive in calculations" },
    requires: "sarvam",
  },
  {
    id: "sozo-rocket-performance",
    name: "Rocket Performance",
    category: "Rockets & engines",
    provider: "SOZO exact engine",
    model: "astro_calculator · rocket_equation",
    status: "live",
    summary: "The Tsiolkovsky rocket equation from specific impulse: delta-v from masses, or the mass ratio and propellant fraction a delta-v needs.",
    capabilities: ["Delta-v budgets", "Mass ratio", "Propellant fraction", "Exhaust velocity"],
    access: { method: "POST", path: "/api/companion/chat", use: "ask with Isp and masses" },
    requires: "sarvam",
  },
  {
    id: "meta-llama-4-maverick",
    name: "Meta Llama 4 Maverick",
    category: "Space science",
    provider: "Meta",
    model: "Llama-4-Maverick-17B-128E-Instruct-FP8",
    status: "ready",
    summary: "A second conversation model on any OpenAI-compatible Llama host. It answers when Sarvam fails, or first when requested.",
    capabilities: ["Fallback answers", "Choose it per request", "Same calculator tools"],
    access: { method: "POST", path: "/api/companion/chat", use: "provider: \"meta\"" },
    requires: "meta",
  },
  {
    id: "sozo-planetary-vision",
    name: "Planetary Vision",
    category: "Planets & imagery",
    provider: "Sarvam AI",
    model: "gemma4",
    status: "live",
    summary: "Reads a map or screenshot the user chooses to share: visible craters, labels and route lines. It cannot see hidden layers or measurements.",
    capabilities: ["Shared map snapshots", "Visible labels and features"],
    access: { method: "POST", path: "/api/companion/chat", use: "context.screenshot" },
    requires: "sarvam",
  },
  {
    id: "sozo-literature",
    name: "Literature Retrieval",
    category: "Space science",
    provider: "Crossref · Europe PMC",
    model: null,
    status: "live",
    summary: "Finds and ranks publications for a question, then hands their abstracts to the model as numbered evidence.",
    capabilities: ["Relevance ranking", "DOI metadata", "Research runs"],
    access: { method: "POST", path: "/api/companion/chat", use: "retrieve: true" },
  },
  {
    id: "sozo-voice",
    name: "SOZO Voice",
    category: "Voice",
    provider: "Sarvam AI",
    model: "bulbul:v4-flash · saaras:v4",
    status: "live",
    summary: "Speaks answers aloud and transcribes spoken questions, with an optional robot voice made in the browser.",
    capabilities: ["Text to speech", "Speech to text"],
    access: { method: "POST", path: "/api/companion/text-to-speech", use: "and /speech-to-text" },
    requires: "sarvam",
  },
  {
    id: "momar-route-planner",
    name: "MOMAR Route Planner",
    category: "Planetary zones",
    provider: "MOMAR prototype",
    model: null,
    status: "prototype",
    summary: "Lower-risk and shortest routes from slope, roughness, shadow and terrain quality at the lunar south pole and in Jezero Crater.",
    capabilities: ["Up to eight stops", "Rover and astronaut profiles", "GeoJSON and PDF plans"],
    access: null,
  },
  {
    id: "momar-zones",
    name: "Light, Ice & Science Zones",
    category: "Planetary zones",
    provider: "MOMAR prototype",
    model: null,
    status: "prototype",
    summary: "Permanent shadow, Diviner cold traps below 110 K and ice-stability depth on the Moon; geologic contacts and CRISM coverage on Mars.",
    capabilities: ["Sunlight and Earth visibility", "Resource evidence, never confirmed ice", "Science targets"],
    access: null,
  },
  {
    id: "sozo-trajectory-designer",
    name: "Trajectory Designer",
    category: "Orbital calculations",
    provider: "SOZO",
    model: null,
    status: "planned",
    summary: "Lambert solutions on real ephemerides: porkchop plots, launch windows and arrival conditions for Moon, Mars and outer-planet missions.",
    capabilities: ["Launch windows", "Porkchop plots", "Gravity-assist sequences"],
    access: null,
  },
  {
    id: "sozo-propulsion-studio",
    name: "Propulsion Studio",
    category: "Rockets & engines",
    provider: "SOZO",
    model: null,
    status: "planned",
    summary: "Engine trade studies: chamber pressure, expansion ratio, thrust and specific impulse for chemical and electric propulsion.",
    capabilities: ["Engine cycles", "Nozzle expansion", "Staging trades"],
    access: null,
  },
  {
    id: "sozo-radiation-zones",
    name: "Radiation & Space Weather",
    category: "Planetary zones",
    provider: "SOZO",
    model: null,
    status: "planned",
    summary: "Van Allen belts, solar particle events and surface dose on the Moon and Mars, for crew and electronics planning.",
    capabilities: ["Belt crossings", "Solar events", "Surface dose"],
    access: null,
  },
];

export const MODEL_STATUS_LABEL: Record<ModelStatus, string> = {
  live: "LIVE",
  ready: "READY TO CONNECT",
  prototype: "MOMAR PROTOTYPE",
  planned: "PLANNED",
};

// The catalog as the API serves it: "configured" says whether this server
// has the key a model needs (configuration, not health).
export function modelCatalog(configured: { sarvam: boolean; meta: boolean; metaModel?: string | null }) {
  return SOZO_MODELS.map((entry) => {
    const ready = entry.requires ? configured[entry.requires] : entry.status === "live";
    const model = entry.id === "meta-llama-4-maverick" && configured.metaModel ? configured.metaModel : entry.model;
    const status: ModelStatus = entry.requires === "meta" && ready ? "live" : entry.status;
    return { ...entry, model, status, configured: entry.access ? ready : null };
  });
}
