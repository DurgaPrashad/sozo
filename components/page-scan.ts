// Finding and reading the part of a page the user asks SOZO to scan. It runs
// only on request and reads only visible text: never form fields, images or
// map pixels. Nothing leaves the page until the question is sent.
import { redact } from "../lib/companion/scan";
export { SCAN_REQUEST } from "../lib/companion/scan";
export type ScanTarget = { element: Element; label: string; describe?: () => string | Record<string, unknown> };
export type ScanReading = { target: string; title?: string; url?: string; text: string };

const MAPS = ".leaflet-container, .maplibregl-map, .mapboxgl-map, .cesium-widget, .ol-viewport, gmp-map, [data-sozo-map]";
const SKIP = "script, style, noscript, template, input, textarea, select, option, [contenteditable=''], [contenteditable='true'], [data-sozo-ignore], [aria-hidden='true']";
const MAX_TEXT = 4000;

const area = (element: Element) => {
  const r = element.getBoundingClientRect();
  const w = Math.min(r.right, innerWidth) - Math.max(r.left, 0), h = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
  return w > 40 && h > 40 ? w * h : 0;
};
const largest = (elements: Element[]) => elements.map((element) => ({ element, size: area(element) })).filter((x) => x.size > 0).sort((a, b) => b.size - a.size)[0]?.element ?? null;
const named = (message: string, name: string) => new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(message);

// The target the message names, else the host's default, else the largest
// visible map, marked area or canvas. `whole` means read the whole view.
export function findScanTarget(message: string, registered: Map<string, ScanTarget>, exclude: Element | null): (ScanTarget & { whole: boolean }) | null {
  // A map may contain the companion itself; its own text is skipped on reading.
  const outside = (element: Element) => element.isConnected && !exclude?.contains(element);
  for (const [name, target] of registered) if (name !== "default" && outside(target.element) && named(message, name)) return { ...target, whole: false };
  const marked = [...document.querySelectorAll<HTMLElement>("[data-sozo-target]")].filter(outside);
  const match = marked.find((element) => named(message, element.dataset.sozoTarget!));
  if (match) return { element: match, label: match.dataset.sozoTarget!, whole: false };
  const preset = registered.get("default");
  if (preset && outside(preset.element)) return { ...preset, whole: true };
  const map = largest([...document.querySelectorAll(MAPS)].filter(outside));
  if (map) return { element: map, label: "map", whole: true };
  const area = largest(marked);
  if (area) return { element: area, label: (area as HTMLElement).dataset.sozoTarget!, whole: false };
  const canvas = largest([...document.querySelectorAll("canvas")].filter((c) => outside(c) && c.clientWidth >= 240 && c.clientHeight >= 160));
  return canvas ? { element: canvas, label: "view", whole: true } : null;
}

// Visible text inside the target (or the whole view), in reading order.
export function readScan(target: ScanTarget & { whole?: boolean }, exclude: Element | null): ScanReading {
  const parts: string[] = [];
  const described = target.describe?.();
  if (described) parts.push((typeof described === "string" ? described : JSON.stringify(described)).slice(0, 1500));
  const root = target.whole ? document.body : target.element;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let total = parts.join("").length, last = "";
  for (let node = walker.nextNode(), seen = 0; node && total < MAX_TEXT && seen < 8000; node = walker.nextNode(), seen++) {
    const parent = node.parentElement;
    if (!parent || parent.closest(SKIP) || exclude?.contains(parent)) continue;
    const text = (node.nodeValue ?? "").replace(/\s+/g, " ").trim();
    if (!text || text === last) continue;
    range.selectNodeContents(node);
    const r = range.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    // A whole-view scan reads only what is on screen; a named area reads all of it.
    if (target.whole && (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth)) continue;
    parts.push(text);
    last = text;
    total += text.length + 1;
  }
  return {
    target: target.label.slice(0, 120),
    title: document.title.slice(0, 200) || undefined,
    url: (location.origin + location.pathname).slice(0, 500),
    text: redact(parts.join("\n")).slice(0, MAX_TEXT),
  };
}
