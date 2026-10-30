// The holographic frame SOZO draws over the part of a page it scans: a
// level laser from top to bottom, then an upright one from side to side, with
// the beam fanning out from the robot's sensor lens. Inline styles only, so it
// looks the same on any host page.
export type ScanPhase = "travel" | "vertical" | "horizontal" | "done";
export type ScanOverlay = {
  update(frame: { rect: DOMRect; lens: { x: number; y: number } | null; phase: ScanPhase; progress: number; label: string }): void;
  remove(): void;
};
const SVG = "http://www.w3.org/2000/svg";

// The visible part of an element, so a full-screen map is scanned as seen.
export function visibleRect(element: Element) {
  const r = element.getBoundingClientRect();
  const left = Math.max(r.left, 0), top = Math.max(r.top, 0);
  return new DOMRect(left, top, Math.max(0, Math.min(r.right, innerWidth) - left), Math.max(0, Math.min(r.bottom, innerHeight) - top));
}

export function createScanOverlay(): ScanOverlay {
  const id = `sozo-scan-${Math.random().toString(36).slice(2, 8)}`;
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  Object.assign(svg.style, { position: "fixed", inset: "0", width: "100vw", height: "100vh", pointerEvents: "none", zIndex: "2147483646", opacity: "0", transition: "opacity .3s ease" });
  svg.innerHTML = `<defs><pattern id="${id}" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M22 0H0V22" fill="none" stroke="rgba(108,188,255,.16)"/></pattern></defs>
    <polygon data-part="fan" fill="rgba(61,155,255,.13)" stroke="rgba(143,208,255,.35)" stroke-width="1"/>
    <rect data-part="frame" fill="url(#${id})" stroke="rgba(108,188,255,.5)" stroke-width="1" rx="3"/>
    <rect data-part="swept" fill="rgba(61,155,255,.11)"/>
    <path data-part="corners" fill="none" stroke="#8fd0ff" stroke-width="2.5" stroke-linecap="round"/>
    <line data-part="laser" stroke="#e4f3ff" stroke-width="2" stroke-linecap="round" style="filter:drop-shadow(0 0 5px #3d9bff) drop-shadow(0 0 12px #2f8bff)"/>
    <text data-part="label" fill="#a6dfff" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" font-size="11" letter-spacing="1.3" style="paint-order:stroke" stroke="rgba(2,6,14,.85)" stroke-width="3"></text>`;
  const part = <T extends SVGElement>(name: string) => svg.querySelector(`[data-part="${name}"]`) as T;
  const fan = part<SVGPolygonElement>("fan"), frame = part<SVGRectElement>("frame"), swept = part<SVGRectElement>("swept");
  const corners = part<SVGPathElement>("corners"), laser = part<SVGLineElement>("laser"), label = part<SVGTextElement>("label");
  document.body.appendChild(svg);
  requestAnimationFrame(() => { svg.style.opacity = "1"; });
  const set = (element: SVGElement, values: Record<string, number | string>) => { for (const [k, v] of Object.entries(values)) element.setAttribute(k, String(v)); };
  return {
    update({ rect, lens, phase, progress, label: name }) {
      const { left, top, width, height } = rect, right = left + width, bottom = top + height;
      set(frame, { x: left, y: top, width, height });
      const c = Math.min(22, width / 4, height / 4);
      corners.setAttribute("d", `M${left} ${top + c}V${top}H${left + c}M${right - c} ${top}H${right}V${top + c}M${right} ${bottom - c}V${bottom}H${right - c}M${left + c} ${bottom}H${left}V${bottom - c}`);
      let a: [number, number] | null = null, b: [number, number] | null = null;
      if (phase === "vertical") {
        const y = top + progress * height;
        a = [left, y]; b = [right, y];
        set(swept, { x: left, y: top, width, height: y - top });
      } else if (phase === "horizontal") {
        const x = left + progress * width;
        a = [x, top]; b = [x, bottom];
        set(swept, { x: left, y: top, width: x - left, height });
      } else set(swept, { x: left, y: top, width: phase === "done" ? width : 0, height });
      laser.style.display = a ? "" : "none";
      if (a && b) set(laser, { x1: a[0], y1: a[1], x2: b[0], y2: b[1] });
      fan.style.display = a && lens ? "" : "none";
      if (a && b && lens) fan.setAttribute("points", `${lens.x},${lens.y} ${a[0]},${a[1]} ${b[0]},${b[1]}`);
      const status = phase === "vertical" ? "TOP → BOTTOM" : phase === "horizontal" ? "SIDE → SIDE" : phase === "done" ? "COMPLETE" : "LOCKING ON";
      label.textContent = `SOZO · SCAN ${name.toUpperCase()} · ${status}`;
      set(label, { x: Math.max(8, Math.min(left, innerWidth - 320)), y: top > 24 ? top - 9 : top + 18 });
    },
    remove() {
      svg.style.opacity = "0";
      setTimeout(() => svg.remove(), 320);
    },
  };
}
