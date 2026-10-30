"use client";
import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { RotateCcw, MoveHorizontal, Volume2, ScanLine } from "lucide-react";
import { createScanOverlay, visibleRect, type ScanOverlay, type ScanPhase } from "./scan-overlay";
// scan() with a target flies the robot to that element and scans it; without
// one the robot scans in place. Resolves when the sweep is complete; the robot
// then flies home on its own.
export type RobotControls = { scan(target?: Element | null, label?: string): Promise<void> };
export type RobotCompanionProps = {
  assetBase?: string;
  speaking?: boolean;
  signal?: "idle" | "listening" | "thinking" | "speaking";
  greeting?: boolean;
  controls?: { current: RobotControls | null };
  // Replaces the Scan button's in-place scan, e.g. to scan the page and ask.
  onScan?: () => void;
};
export default function RobotCompanion({ assetBase = "", speaking = false, signal = "idle", greeting = true, controls, onScan }: RobotCompanionProps) {
  const activity = useRef({ speaking, signal });
  activity.current = { speaking, signal };
  const scanner = useRef<RobotControls["scan"] | null>(null);
  const [scanning, setScanning] = useState(false);
  const runScan = async (target?: Element | null, label?: string) => {
    if (!scanner.current) return;
    setScanning(true);
    try { await scanner.current(target, label); } finally { setScanning(false); }
  };
  useImperativeHandle(controls, () => ({ scan: runScan }));
  const audio = useRef<HTMLAudioElement | null>(null);
  const [audioError, setAudioError] = useState("");
  const greet = () => {
    if (!greeting) return;
    audio.current?.pause();
    const player = new Audio(`${assetBase}/audio/sozo-hello.wav`);
    audio.current = player;
    activity.current.speaking = true;
    player.onended = () => { activity.current.speaking = false; };
    player.onerror = () => { activity.current.speaking = false; setAudioError("Greeting audio is unavailable. You can still wave hello."); };
    void player.play().catch(() => { activity.current.speaking = false; setAudioError("Select hello again to play the greeting."); });
  };
  const host = useRef<HTMLDivElement>(null);
  const reset = useRef<(() => void) | null>(null);
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let disposed = false,
      frame = 0,
      inView = false,
      started = false;
    let cleanup = () => {};
    const initialize = async () => {
      if (started || !host.current || disposed) return;
      started = true;
      try {
        const [THREE, { GLTFLoader }, { OrbitControls }, { RoomEnvironment }] =
          await Promise.all([
            import("three"),
            import("three/addons/loaders/GLTFLoader.js"),
            import("three/addons/controls/OrbitControls.js"),
            import("three/addons/environments/RoomEnvironment.js"),
          ]);
        if (disposed || !host.current) return;
        const element = host.current;
        const renderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: true,
          powerPreference: "low-power",
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        renderer.setClearColor(0x000000, 0);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.9;
        renderer.domElement.setAttribute("aria-hidden", "true");
        element.appendChild(renderer.domElement);
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 40);
        camera.position.set(0, 0.08, 4.9);
        const controls = new OrbitControls(camera, renderer.domElement);
        renderer.domElement.style.touchAction = "pan-y";
        controls.target.set(0, 0.08, 0);
        controls.enablePan = false;
        controls.enableZoom = false;
        controls.enableDamping = true;
        controls.minPolarAngle = Math.PI / 2;
        controls.maxPolarAngle = Math.PI / 2;
        controls.minAzimuthAngle = -1.15;
        controls.maxAzimuthAngle = 1.15;
        controls.touches.TWO = null;
        const room = new RoomEnvironment();
        const pmrem = new THREE.PMREMGenerator(renderer);
        const environment = pmrem.fromScene(room, 0.035);
        scene.environment = environment.texture;
        room.dispose();
        pmrem.dispose();
        scene.add(new THREE.HemisphereLight(0xf4f8ff, 0x101826, 0.9));
        const key = new THREE.DirectionalLight(0xffffff, 2.3);
        key.position.set(-3, 4, 5);
        scene.add(key);
        const rim = new THREE.DirectionalLight(0xbcdfff, 1.6);
        rim.position.set(3, 2, -2);
        scene.add(rim);
        // Cool blue fill from the beam side, as in the design reference.
        const signalLight = new THREE.DirectionalLight(0x3d9bff, 1.4);
        signalLight.position.set(4, 1, 1.5);
        scene.add(signalLight);
        // Ceramic-white armour; the masks below paint joints and trim graphite.
        const silver = new THREE.MeshPhysicalMaterial({
          color: 0xeef1f5,
          metalness: 0.06,
          roughness: 0.36,
          clearcoat: 0.55,
          clearcoatRoughness: 0.22,
          envMapIntensity: 1,
        });
        // Masks follow this supplied untextured mesh in its original coordinates.
        // Fragment masks preserve smooth material edges without changing triangles.
        silver.onBeforeCompile = (shader) => {
          shader.vertexShader = shader.vertexShader
            .replace(
              "#include <common>",
              `#include <common>
              varying vec3 vRobotPosition;
            `,
            )
            .replace(
              "#include <begin_vertex>",
              `#include <begin_vertex>
              vRobotPosition = position;
            `,
            );
          shader.fragmentShader = shader.fragmentShader
            .replace(
              "#include <common>",
              `#include <common>
            varying vec3 vRobotPosition;
            float robotBox(vec2 p,vec2 center,vec2 halfSize,float radius){
              vec2 q=abs(p-center)-(halfSize-vec2(radius));
              float distance=length(max(q,0.0))+min(max(q.x,q.y),0.0)-radius;
              return 1.0-smoothstep(-0.002,0.002,distance);
            }
            float robotBand(float value,float low,float high){return smoothstep(low-0.002,low+0.002,value)*(1.0-smoothstep(high-0.002,high+0.002,value));}
          `,
            )
            .replace(
              "#include <color_fragment>",
              `#include <color_fragment>
            float rx=vRobotPosition.x, ry=vRobotPosition.y, rz=vRobotPosition.z;
            float robotMask=robotBox(vec2(rx,ry),vec2(-0.016,0.045),vec2(0.495,0.31),0.09)*smoothstep(0.20,0.21,rz);
            robotMask=max(robotMask,robotBox(vec2(rx,ry),vec2(-0.012,0.667),vec2(0.155,0.06),0.025)*smoothstep(0.065,0.075,rz));
            robotMask=max(robotMask,(1.0-smoothstep(0.135,0.145,abs(rx)))*robotBand(ry,0.435,0.535));
            robotMask=max(robotMask,robotBand(rx,-0.69,-0.49)*smoothstep(0.35,0.36,ry)*(1.0-smoothstep(0.055,0.065,rz)));
            robotMask=max(robotMask,robotBand(abs(rx),0.57,0.74)*robotBand(ry,-0.02,0.32)*(1.0-smoothstep(0.075,0.085,rz)));
            robotMask=max(robotMask,smoothstep(0.60,0.62,abs(rx))*max(robotBand(ry,-0.36,-0.29),robotBand(ry,-0.59,-0.53)));
            robotMask=max(robotMask,robotBand(abs(rx),0.555,0.795)*robotBand(ry,-0.15,0.16));
            robotMask=max(robotMask,smoothstep(0.44,0.50,abs(rx))*(1.0-smoothstep(-0.48,-0.46,ry))*smoothstep(0.22,0.30,rz));
            robotMask=max(robotMask,(1.0-smoothstep(-0.37,-0.34,ry))*smoothstep(0.38,0.43,rz));
            robotMask=max(robotMask,1.0-smoothstep(-0.735,-0.725,ry));
            robotMask=max(robotMask,(1.0-smoothstep(-0.565,-0.555,ry))*smoothstep(0.635,0.645,rz)*(1.0-smoothstep(0.815,0.825,abs(rx))));
            robotMask=max(robotMask,(1.0-smoothstep(0.495,0.505,abs(rx)))*robotBand(ry,-0.41,-0.32));
            diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.012,0.014,0.02),robotMask);
          `,
            )
            .replace(
              "#include <metalnessmap_fragment>",
              "#include <metalnessmap_fragment>\nmetalnessFactor=mix(metalnessFactor,0.38,robotMask);",
            )
            .replace(
              "#include <roughnessmap_fragment>",
              "#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,0.46,robotMask);",
            );
        };
        const faceCanvas = document.createElement("canvas");
        faceCanvas.width = 768; faceCanvas.height = 480;
        const ctx = faceCanvas.getContext("2d")!;
        const faceTexture = new THREE.CanvasTexture(faceCanvas);
        faceTexture.colorSpace = THREE.SRGBColorSpace;
        const screen = new THREE.MeshBasicMaterial({ map: faceTexture, toneMapped: false });
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        // The scan in progress, if any (see startScan). Milliseconds per stage.
        const GLIDE = 600, TRAVEL = 800, SWEEP = 1300, HOLD = 300;
        type Scan = { start: number; resolve: () => void; dir: 1 | -1; label: string; target?: Element; overlay?: ScanOverlay; flyer?: HTMLDivElement; home?: DOMRect; returning?: boolean };
        let scan: Scan | null = null;
        const look = { x: 0, target: 0 };
        const onPointer = (event: PointerEvent) => {
          const rect = element.getBoundingClientRect();
          look.target = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1));
        };
        const onLeave = () => { look.target = 0; };
        element.addEventListener("pointermove", onPointer);
        element.addEventListener("pointerleave", onLeave);
        const digits = "0123456789ABCDEF<>/=+:";
        const columns = 40, rows = 20;
        // Each column's falling stream has its own speed and phase.
        const streams = Array.from({ length: columns }, (_, i) => ({ speed: 0.6 + ((i * 37) % 11) / 9, phase: (i * 53) % rows }));
        // Research lines shown while SOZO is thinking, generated from a seed so
        // each line stays the same while it types out.
        const topics = ["lunar south pole ice", "Jezero delta", "LOLA slope 5 m", "PSR illumination", "Gale crater", "regolith thermal", "Shackleton rim", "Mars subsurface ice"];
        const datasets = ["LOLA", "LROC NAC", "Diviner", "HiRISE", "CTX", "MOLA", "ShadowCam"];
        const researchLine = (index: number) => {
          // 32-bit integer maths; plain multiplication loses the low bits.
          let seed = Math.imul(index + 1, 2654435761) >>> 0;
          const pick = (range: number) => {
            seed = (Math.imul(seed ^ (seed >>> 15), 2246822519) + 0x9e3779b9) >>> 0;
            return (seed >>> 8) % range;
          };
          const hex = () => pick(0xffff).toString(16).toUpperCase().padStart(4, "0");
          switch (pick(6)) {
            case 0: return `> QUERY crossref "${topics[pick(topics.length)]}"`;
            case 1: return `  RANK 0.${10 + pick(89)}  DOI 10.${1000 + pick(8999)}/${hex()}`;
            case 2: return `> SCAN ${datasets[pick(datasets.length)]} ${[5, 20, 60, 240][pick(4)]} m  ${40 + pick(60)}%`;
            case 3: return `  PARSE abstract ${1 + pick(8)}/8  OK`;
            case 4: return `> CROSSCHECK [${1 + pick(4)}] [${5 + pick(4)}]  ${hex()}`;
            default: return `  ${hex()} ${hex()} ${hex()} ${hex()}`;
          }
        };
        const drawResearch = (time: number) => {
          ctx.fillStyle = "rgba(1,4,12,0.78)";
          ctx.fillRect(0, 0, 768, 480);
          ctx.textAlign = "start";
          ctx.font = "15px monospace";
          ctx.fillStyle = "#5ea9e6";
          ctx.fillText("SOZO · RESEARCHING", 56, 52);
          ctx.fillStyle = "rgba(94,169,230,0.35)";
          ctx.fillRect(56, 64, 656, 2);
          const lineMs = reduced ? 1 : 420;
          const count = reduced ? 9 : Math.floor(time / lineMs);
          const typed = reduced ? 1 : (time % lineMs) / lineMs;
          ctx.font = "bold 21px monospace";
          for (let row = 0; row < 9; row++) {
            const index = count - 8 + row;
            if (index < 0) continue;
            let text = researchLine(index);
            const current = row === 8;
            if (current) text = text.slice(0, Math.max(1, Math.ceil(text.length * Math.min(1, typed * 1.6))));
            ctx.globalAlpha = current ? 1 : 0.35 + 0.08 * row;
            ctx.fillStyle = current ? "#cfe8ff" : text.startsWith(">") ? "#6cbcff" : "#3d8ee0";
            ctx.shadowColor = "#2f8bff";
            ctx.shadowBlur = current ? 12 : 0;
            ctx.fillText(text, 56, 104 + row * 36);
            if (current && Math.floor(time / 300) % 2 === 0) ctx.fillRect(56 + ctx.measureText(text).width + 6, 88 + row * 36, 12, 20);
          }
          ctx.globalAlpha = 1;
          ctx.shadowBlur = 0;
          ctx.fillStyle = "rgba(94,169,230,0.22)";
          ctx.fillRect(56, 432, 656, 6);
          ctx.fillStyle = "#4aa8ff";
          ctx.fillRect(56, 432, 656 * (reduced ? 0.6 : (time % 2600) / 2600), 6);
        };
        let faceFrame = -1;
        const drawFace = (time: number) => {
          const tick = reduced ? 0 : Math.floor(time / 70);
          const state = scan ? "scanning" : activity.current.speaking ? "speaking" : activity.current.signal;
          if (tick === faceFrame && state === "idle" && Math.abs(look.x - look.target) < 0.01) return;
          faceFrame = tick;
          look.x += (look.target - look.x) * 0.18;
          ctx.fillStyle = "#01040c";
          ctx.fillRect(0, 0, 768, 480);
          ctx.font = "bold 18px monospace";
          ctx.textAlign = "center";
          for (let col = 0; col < columns; col++) {
            const stream = streams[col];
            const head = (stream.phase + tick * stream.speed * 0.35) % (rows + 8);
            for (let row = 0; row < rows; row++) {
              const behind = head - row;
              if (behind < 0 || behind > 8) continue;
              ctx.globalAlpha = behind < 1 ? 0.75 : 0.42 * (1 - behind / 8);
              ctx.fillStyle = behind < 1 ? "#cfe8ff" : behind < 3 ? "#4aa8ff" : "#1d5fbf";
              ctx.fillText(digits[(col * 7 + row * 3 + tick) % digits.length], col * 19.2 + 10, row * 24 + 20);
            }
          }
          ctx.globalAlpha = 1;
          // Dim the digits where the eyes sit so the rings read clearly.
          const vignette = ctx.createRadialGradient(384, 228, 40, 384, 228, 330);
          vignette.addColorStop(0, "rgba(1,4,12,0.92)");
          vignette.addColorStop(1, "rgba(1,4,12,0.15)");
          ctx.fillStyle = vignette;
          ctx.fillRect(0, 0, 768, 480);
          if (state === "thinking") {
            drawResearch(time);
            faceTexture.needsUpdate = true;
            return;
          }
          const blink = !reduced && (tick % 54 === 0 || tick % 54 === 1);
          const pulse = state === "listening" ? 1 + 0.08 * Math.sin(time / 160) : 1;
          const drift = reduced ? 0 : 5 * Math.sin(time / 1900);
          const offset = (state === "scanning" ? (scan?.target ? scan.dir * 1.2 : 0) : look.x) * 22 + drift;
          for (const cx of [250, 518]) {
            const x = cx + offset, y = 220;
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(1, blink ? 0.12 : 1);
            const halo = ctx.createRadialGradient(0, 0, 30, 0, 0, 120);
            halo.addColorStop(0, "rgba(40,130,255,0.32)");
            halo.addColorStop(1, "rgba(40,130,255,0)");
            ctx.fillStyle = halo;
            ctx.beginPath();
            ctx.arc(0, 0, 120, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowColor = "#2f8bff";
            ctx.shadowBlur = 34;
            ctx.strokeStyle = "#5cb4ff";
            ctx.lineWidth = 15;
            ctx.beginPath();
            ctx.arc(0, 0, 62 * pulse, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 8;
            ctx.strokeStyle = "#d8eeff";
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(0, 0, 62 * pulse, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
          ctx.shadowBlur = 0;
          if (state === "speaking") {
            ctx.shadowColor = "#2f8bff";
            ctx.shadowBlur = 16;
            ctx.strokeStyle = "#6cbcff";
            ctx.lineWidth = 5;
            ctx.beginPath();
            for (let i = 0; i <= 60; i++) {
              const x = 264 + i * 4;
              const y = 340 + (10 + 14 * Math.sin(time / 120)) * Math.sin(i * 0.6 + time / 65) * Math.sin((i / 60) * Math.PI);
              if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.stroke();
            ctx.shadowBlur = 0;
          }
          ctx.font = "15px monospace";
          ctx.fillStyle = "#5ea9e6";
          ctx.fillText(state === "scanning" ? "SOZO · SCANNING" : state === "speaking" ? "SOZO · SPEAKING" : state === "listening" ? "SOZO · LISTENING" : "SOZO · READY", 384, 436);
          ctx.textAlign = "start";
          faceTexture.needsUpdate = true;
        };
        // Top sensor: dark glass with the scanner lens on its right.
        const sensorCanvas = document.createElement("canvas");
        sensorCanvas.width = 512; sensorCanvas.height = 192;
        const sensorCtx = sensorCanvas.getContext("2d")!;
        const glass = sensorCtx.createLinearGradient(0, 0, 0, 192);
        glass.addColorStop(0, "#0b1220");
        glass.addColorStop(1, "#02050b");
        sensorCtx.fillStyle = glass;
        sensorCtx.fillRect(0, 0, 512, 192);
        const lensGlow = sensorCtx.createRadialGradient(390, 96, 4, 390, 96, 70);
        lensGlow.addColorStop(0, "#ffffff");
        lensGlow.addColorStop(0.18, "#8fd0ff");
        lensGlow.addColorStop(0.45, "rgba(47,139,255,0.85)");
        lensGlow.addColorStop(1, "rgba(47,139,255,0)");
        sensorCtx.fillStyle = lensGlow;
        sensorCtx.fillRect(300, 10, 180, 172);
        sensorCtx.fillStyle = "rgba(94,169,230,0.55)";
        for (const x of [70, 100, 130]) sensorCtx.fillRect(x, 88, 18, 16);
        const sensorTexture = new THREE.CanvasTexture(sensorCanvas);
        sensorTexture.colorSpace = THREE.SRGBColorSpace;
        const sensorScreen = new THREE.MeshBasicMaterial({ map: sensorTexture, toneMapped: false });
        // Soft additive glow used by the lens and the side light strip.
        const glowCanvas = document.createElement("canvas");
        glowCanvas.width = glowCanvas.height = 128;
        const glowCtx = glowCanvas.getContext("2d")!;
        const glowGradient = glowCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
        glowGradient.addColorStop(0, "rgba(255,255,255,1)");
        glowGradient.addColorStop(0.25, "rgba(120,190,255,0.8)");
        glowGradient.addColorStop(1, "rgba(30,110,255,0)");
        glowCtx.fillStyle = glowGradient;
        glowCtx.fillRect(0, 0, 128, 128);
        const glowTexture = new THREE.CanvasTexture(glowCanvas);
        const lensSprite = new THREE.SpriteMaterial({ map: glowTexture, color: 0x6cbcff, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
        const ledMaterial = new THREE.MeshBasicMaterial({ color: 0x4aa8ff, toneMapped: false });
        // Holographic scanner: a straight, level grid beam from the lens with a
        // laser sheet sweeping top to bottom (uAxis 0), then side to side
        // (uAxis 1), onto a flat holographic screen at its far end. uScan runs
        // from -1 to 1 across the beam.
        const beamTall = Math.tan(0.27);
        const beamWide = Math.tan(0.4);
        const beamLength = 1.25;
        // Where the ray (1, y, z) meets the screen, square to the beam.
        const reach = (y: number, z: number, out = new THREE.Vector3()) => out.set(1, y, z).multiplyScalar(beamLength);
        const sheetA = new THREE.Vector3(), sheetB = new THREE.Vector3();
        // Moves a laser sheet's far edge to the current scan line.
        const placeSheet = (mesh: import("three").Mesh, a: import("three").Vector3, b: import("three").Vector3) => {
          const position = mesh.geometry.getAttribute("position") as import("three").BufferAttribute;
          position.setXYZ(1, a.x, a.y, a.z);
          position.setXYZ(2, b.x, b.y, b.z);
          position.needsUpdate = true;
        };
        const beamMaterial = new THREE.ShaderMaterial({
          uniforms: { uScan: { value: 0 }, uAxis: { value: 0 }, uIntensity: { value: 1 }, uColor: { value: new THREE.Color(0x3d9bff) } },
          vertexShader: "varying vec2 vUv; varying vec3 vLocal; void main(){ vUv = uv; vLocal = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
          fragmentShader: `uniform float uScan; uniform float uAxis; uniform float uIntensity; uniform vec3 uColor; varying vec2 vUv; varying vec3 vLocal;
            void main(){
              float along = vUv.y;
              float across = (vUv.x - 0.5) / max(along, 0.001) + 0.5;
              float height = mix(vLocal.y / max(vLocal.x * ${beamTall.toFixed(4)}, 0.0001), -vLocal.z / max(vLocal.x * ${beamWide.toFixed(4)}, 0.0001), uAxis);
              float gridU = 1.0 - smoothstep(0.0, 0.04, abs(fract(across * 8.0 + 0.5) - 0.5));
              float gridV = 1.0 - smoothstep(0.0, 0.07, abs(fract(along * 11.0 + 0.5) - 0.5));
              float edge = 1.0 - smoothstep(0.0, 0.035, min(across, 1.0 - across));
              float scan = exp(-pow((height - uScan) * 7.0, 2.0));
              float swept = smoothstep(uScan - 0.02, uScan + 0.6, height) * 0.35;
              float fade = smoothstep(0.0, 0.05, along) * pow(1.0 - along, 1.6);
              float alpha = (0.07 + 0.26 * max(gridU, gridV) + 0.45 * edge + 0.9 * scan + swept * 0.3) * fade * uIntensity;
              gl_FragColor = vec4(uColor * (0.7 + 0.8 * edge + 1.2 * scan), alpha);
            }`,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          toneMapped: false,
        });
        const sheetMaterial = new THREE.ShaderMaterial({
          uniforms: { uIntensity: { value: 1 } },
          vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
          fragmentShader: `uniform float uIntensity; varying vec2 vUv;
            void main(){
              float along = vUv.y;
              float across = (vUv.x - 0.5) / max(along, 0.001) + 0.5;
              float edge = smoothstep(0.0, 0.08, across) * smoothstep(0.0, 0.08, 1.0 - across);
              float fade = smoothstep(0.0, 0.04, along) * pow(1.0 - along, 1.5);
              float far = smoothstep(0.55, 0.98, along) * (1.0 - smoothstep(0.98, 1.0, along));
              gl_FragColor = vec4(vec3(0.45, 0.78, 1.0), (0.22 + 0.5 * far) * edge * fade * uIntensity);
            }`,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          toneMapped: false,
        });
        // The far screen: +1 is the top (uAxis 0) or screen right (uAxis 1).
        const holoMaterial = new THREE.ShaderMaterial({
          uniforms: { uScan: { value: 0 }, uAxis: { value: 0 }, uIntensity: { value: 0 } },
          vertexShader: "varying vec3 vLocal; void main(){ vLocal = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
          fragmentShader: `uniform float uScan; uniform float uAxis; uniform float uIntensity; varying vec3 vLocal;
            void main(){
              vec2 p = vec2(-vLocal.z / (vLocal.x * ${beamWide.toFixed(4)}), vLocal.y / (vLocal.x * ${beamTall.toFixed(4)}));
              float h = mix(p.y, p.x, uAxis);
              vec2 cell = abs(fract(p * vec2(4.0, 2.5)) - 0.5);
              float lines = smoothstep(0.46, 0.5, max(cell.x, cell.y));
              float border = smoothstep(0.94, 0.99, max(abs(p.x), abs(p.y)));
              float line = exp(-pow((h - uScan) * 30.0, 2.0));
              float swept = (uAxis < 0.5 ? step(uScan, h) : step(h, uScan)) * 0.1;
              float alpha = min(0.95, (0.05 + 0.2 * lines + 0.6 * border + 1.1 * line + swept) * uIntensity);
              gl_FragColor = vec4(mix(vec3(0.16, 0.52, 1.0), vec3(0.62, 0.9, 1.0), line), alpha);
            }`,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
          // Normal blending keeps the blue visible over the white shell it
          // sits in front of; additive light would wash out to white there.
          blending: THREE.NormalBlending,
          toneMapped: false,
        });
        const materials: import("three").Material[] = [
          silver,
          screen,
          sensorScreen,
          lensSprite,
          ledMaterial,
          beamMaterial,
          sheetMaterial,
          holoMaterial,
        ];
        const originals = new Set<import("three").Material>();
        let root: import("three").Group | null = null;
        let viewDistance = 4.9;
        const resize = () => {
          const rect = element.getBoundingClientRect();
          renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height));
          camera.aspect = Math.max(1, rect.width) / Math.max(1, rect.height);
          // Fit the wide hands inside a narrow phone viewport without exposing
          // user zoom controls or cropping the supplied model.
          viewDistance = Math.max(
            5.4,
            (1.5 /
              (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) *
                camera.aspect)) *
              1.16 +
              0.15,
          );
          const wideStage = camera.aspect > 1.05;
          camera.filmOffset = wideStage ? 2.6 : 0;
          if (wideStage) viewDistance *= 1.06;
          camera.position
            .sub(controls.target)
            .setLength(viewDistance)
            .add(controls.target);
          camera.updateProjectionMatrix();
        };
        const observer = new ResizeObserver(resize);
        observer.observe(element);
        resize();
        reset.current = () => {
          controls.reset();
          camera.position.set(0, 0.08, viewDistance);
          controls.target.set(0, 0.08, 0);
          if (root) root.rotation.y = 0;
        };
        const onKey = (event: KeyboardEvent) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            if (root)
              root.rotation.y += event.key === "ArrowRight" ? 0.12 : -0.12;
          }
        };
        element.addEventListener("keydown", onKey);
        let previous = 0;
        let lastInteraction = -10000;
        const markInteraction = () => { lastInteraction = performance.now(); };
        controls.addEventListener("start", markInteraction);
        let idle: import("three").Group | null = null;
        let beam: import("three").Group | null = null;
        let sheet: import("three").Mesh | null = null;
        let sheetSide: import("three").Mesh | null = null;
        let lensMarker: import("three").Object3D | null = null;
        let presence = 0;
        const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
        const lensWorld = new THREE.Vector3();
        // The sensor lens in viewport pixels, wherever the canvas is.
        const lensPoint = () => {
          if (!lensMarker) return null;
          lensMarker.getWorldPosition(lensWorld).project(camera);
          const r = renderer.domElement.getBoundingClientRect();
          return { x: r.left + ((lensWorld.x + 1) / 2) * r.width, y: r.top + ((1 - lensWorld.y) / 2) * r.height };
        };
        const finishScan = () => {
          if (!scan) return;
          const done = scan;
          scan = null;
          if (done.flyer) { element.appendChild(renderer.domElement); done.flyer.remove(); }
          done.overlay?.remove();
          done.resolve();
        };
        // Scans run only when asked. Robot scans glide aside and sweep the
        // screen; page scans fly beside the target, sweep it, and fly home.
        const startScan = (target: Element | null | undefined, label: string, resolve: () => void) => {
          finishScan();
          if (!target) { scan = { start: performance.now(), resolve, dir: 1, label }; return; }
          const launch = () => {
            if (disposed || !target.isConnected) return resolve();
            const home = element.getBoundingClientRect();
            const k = Math.min(1, 240 / Math.max(home.width, home.height, 1));
            const w = home.width * k, h = home.height * k, t = visibleRect(target);
            const fits = (x: number) => x >= 8 && x + w <= innerWidth - 8;
            const leftX = t.left - w * 0.8, rightX = t.right - w * 0.2;
            const centre = home.left + home.width / 2;
            const preferLeft = Math.abs(centre - leftX - w / 2) <= Math.abs(centre - rightX - w / 2);
            let x = preferLeft ? (fits(leftX) ? leftX : rightX) : fits(rightX) ? rightX : leftX;
            x = Math.max(8, Math.min(innerWidth - w - 8, x));
            const y = Math.max(8, Math.min(innerHeight - h - 8, t.top - h * 0.25));
            const flyer = document.createElement("div");
            Object.assign(flyer.style, { position: "fixed", left: `${home.left}px`, top: `${home.top}px`, width: `${home.width}px`, height: `${home.height}px`, zIndex: "2147483645", pointerEvents: "none", transformOrigin: "0 0", transition: `transform ${TRAVEL}ms cubic-bezier(.65,0,.35,1)` });
            document.body.appendChild(flyer);
            flyer.appendChild(renderer.domElement);
            if (!reduced) requestAnimationFrame(() => requestAnimationFrame(() => { flyer.style.transform = `translate(${x - home.left}px, ${y - home.top}px) scale(${k})`; }));
            scan = { start: performance.now(), resolve, dir: t.left + t.width / 2 >= x + w / 2 ? 1 : -1, label, target, overlay: createScanOverlay(), flyer, home };
          };
          const r = target.getBoundingClientRect();
          if (r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth) return launch();
          target.scrollIntoView({ block: "center", inline: "nearest", behavior: reduced ? "auto" : "smooth" });
          setTimeout(launch, reduced ? 0 : 550);
        };
        let led: import("three").Mesh | null = null;
        const render = (time: number) => {
          if (disposed) return;
          frame = requestAnimationFrame(render);
          if (document.hidden || (!inView && !scan) || time - previous < 33) return;
          previous = time;
          const state = activity.current.speaking ? "speaking" : activity.current.signal;
          // Scan timeline: lead-in (glide or flight), top to bottom, side to
          // side, a short hold, then back home.
          let phase: ScanPhase | null = null, progress = 0, travel = 0;
          if (scan) {
            const t = time - scan.start, lead = scan.target ? TRAVEL : GLIDE, swept = lead + 2 * SWEEP;
            if (reduced) { if (t < 1600) phase = "done"; else finishScan(); }
            else if (t < lead) { phase = "travel"; travel = ease(t / lead); }
            else if (t < lead + SWEEP) { phase = "vertical"; progress = ease((t - lead) / SWEEP); travel = 1; }
            else if (t < swept) { phase = "horizontal"; progress = ease((t - lead - SWEEP) / SWEEP); travel = 1; }
            else if (t < swept + HOLD + lead) {
              phase = "done";
              progress = 1;
              scan.resolve();
              const back = Math.max(0, t - swept - HOLD) / lead;
              travel = 1 - ease(Math.min(1, back));
              if (back > 0 && !scan.returning && scan.flyer && scan.home) {
                scan.returning = true;
                const home = element.getBoundingClientRect();
                scan.flyer.style.transform = `translate(${home.left - scan.home.left}px, ${home.top - scan.home.top}px) scale(1)`;
              }
            } else finishScan();
          }
          const active = scan;
          if (active?.overlay && active.target && phase) active.overlay.update({ rect: visibleRect(active.target), lens: lensPoint(), phase, progress, label: active.label });
          drawFace(time);
          if (idle && !reduced) {
            idle.position.y = 0.035 * Math.sin(time / 1100);
            // Level and still while scanning, so the beam stays straight.
            idle.rotation.z += ((phase ? 0 : 0.015 * Math.sin(time / 1500)) - idle.rotation.z) * 0.2;
            // Square to the viewer for a straight scan, or facing a page
            // target; otherwise a slow look-around while nobody turns it.
            const resting = time - lastInteraction > 4000;
            const facing = phase ? (active?.target ? 0.42 * active.dir : 0) : resting ? 0.16 * Math.sin(time / 3200) : 0;
            idle.rotation.y += (facing - idle.rotation.y) * (phase ? 0.12 : 0.04);
          }
          if (root && !reduced) {
            // Flights lean into the direction of travel.
            const flying = active?.target && (phase === "travel" || active.returning);
            const lean = flying ? (active.returning ? active.dir : -active.dir) * 0.2 * Math.sin(Math.PI * travel) : 0;
            root.rotation.z += (lean - root.rotation.z) * 0.25;
          }
          if (beam && sheet && sheetSide) {
            const local = Boolean(active && !active.target);
            const sweeping = local && (phase === "vertical" || phase === "horizontal");
            const target = local && (sweeping || reduced || phase === "travel") ? 1 : 0;
            presence += (target - presence) * (target > presence ? 0.22 : 0.1);
            beam.visible = presence > 0.01;
            lensSprite.opacity = 0.35 + 0.65 * Math.max(presence, active?.target && phase ? 1 : 0);
            const axis = phase === "horizontal" ? 1 : 0;
            // Top (+1) to bottom (-1), then screen left (-1) to right (+1).
            const position = sweeping ? (axis === 0 ? 1 - 2 * progress : -1 + 2 * progress) : axis === 0 ? 1 : -1;
            const intensity = 1.15 * presence;
            for (const material of [beamMaterial, holoMaterial]) {
              material.uniforms.uScan.value = position;
              material.uniforms.uAxis.value = axis;
              material.uniforms.uIntensity.value = intensity;
            }
            sheetMaterial.uniforms.uIntensity.value = sweeping ? intensity * Math.min(1, Math.min(progress, 1 - progress) * 10) : 0;
            sheet.visible = sweeping && axis === 0;
            sheetSide.visible = sweeping && axis === 1;
            if (sweeping && axis === 0) placeSheet(sheet, reach(position * beamTall, beamWide, sheetA), reach(position * beamTall, -beamWide, sheetB));
            if (sweeping && axis === 1) placeSheet(sheetSide, reach(beamTall, position * beamWide, sheetA), reach(-beamTall, position * beamWide, sheetB));
          }
          if (led) ledMaterial.color.setHSL(0.585, 1, (state === "speaking" ? 0.55 : 0.5) + (reduced ? 0 : 0.08 * Math.sin(time / (state === "speaking" ? 140 : 700))));
          controls.update();
          renderer.render(scene, camera);
        };
        frame = requestAnimationFrame(render);
        cleanup = () => {
          scanner.current = null;
          finishScan();
          cancelAnimationFrame(frame);
          observer.disconnect();
          element.removeEventListener("keydown", onKey);
          element.removeEventListener("pointermove", onPointer);
          element.removeEventListener("pointerleave", onLeave);
          controls.removeEventListener("start", markInteraction);
          controls.dispose();
          root?.traverse((object) => {
            if ((object as import("three").Mesh).isMesh)
              (object as import("three").Mesh).geometry.dispose();
          });
          materials.forEach((material) => material.dispose());
          originals.forEach((material) => material.dispose());
          faceTexture.dispose();
          sensorTexture.dispose();
          glowTexture.dispose();
          environment.dispose();
          renderer.dispose();
          renderer.domElement.remove();
          reset.current = null;
        };
        const gltf = await new GLTFLoader().loadAsync(
          assetBase ? `${assetBase}/api/companion/model` : "/models/sozo-companion.glb",
        );
        if (disposed) {
          gltf.scene.traverse((object) => {
            const mesh = object as import("three").Mesh;
            if (mesh.isMesh) {
              mesh.geometry.dispose();
              const mats = Array.isArray(mesh.material)
                ? mesh.material
                : [mesh.material];
              mats.forEach((material) => material.dispose());
            }
          });
          return;
        }
        const bounds = new THREE.Box3().setFromObject(gltf.scene);
        const center = bounds.getCenter(new THREE.Vector3());
        const size = bounds.getSize(new THREE.Vector3());
        // The supplied robot meshes, before any panels or effects are added.
        const body: import("three").Mesh[] = [];
        gltf.scene.traverse((object) => {
          const mesh = object as import("three").Mesh;
          if (!mesh.isMesh) return;
          const mats = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];
          mats.forEach((material) => originals.add(material));
          mesh.geometry.computeVertexNormals();
          mesh.material = silver;
          body.push(mesh);
        });
        const displayPanel = (
          width: number,
          height: number,
          r: number,
          x: number,
          y: number,
          z: number,
          material: import("three").Material = screen,
        ) => {
          const shape = new THREE.Shape();
          const w = width / 2,
            h = height / 2;
          shape.moveTo(-w + r, -h);
          shape.lineTo(w - r, -h);
          shape.quadraticCurveTo(w, -h, w, -h + r);
          shape.lineTo(w, h - r);
          shape.quadraticCurveTo(w, h, w - r, h);
          shape.lineTo(-w + r, h);
          shape.quadraticCurveTo(-w, h, -w, h - r);
          shape.lineTo(-w, -h + r);
          shape.quadraticCurveTo(-w, -h, -w + r, -h);
          const geometry = new THREE.ShapeGeometry(shape, 24);
          const positions = geometry.getAttribute("position"), uv = geometry.getAttribute("uv");
          for (let i=0;i<positions.count;i++) uv.setXY(i,(positions.getX(i)+w)/width,(positions.getY(i)+h)/height);
          const panel = new THREE.Mesh(geometry, material);
          panel.position.set(x, y, z);
          gltf.scene.add(panel);
        };
        displayPanel(0.96, 0.595, 0.085, -0.016, 0.045, 0.264);
        displayPanel(0.295, 0.108, 0.02, -0.012, 0.667, 0.118, sensorScreen);

        // Lens on the right of the top sensor (panel u = 0.76), and its beam.
        const lens = new THREE.Vector3(-0.012 + 0.295 * 0.26, 0.667, 0.125);
        const lensFlare = new THREE.Sprite(lensSprite);
        lensFlare.position.copy(lens);
        lensFlare.scale.setScalar(0.2);
        gltf.scene.add(lensFlare);
        lensMarker = lensFlare;
        const corners = [reach(beamTall, beamWide), reach(beamTall, -beamWide), reach(-beamTall, -beamWide), reach(-beamTall, beamWide)];
        const positions: number[] = [], uvs: number[] = [];
        for (let i = 0; i < 4; i++) {
          const a = corners[i], b = corners[(i + 1) % 4];
          positions.push(0, 0, 0, a.x, a.y, a.z, b.x, b.y, b.z);
          uvs.push(0.5, 0, 0, 1, 1, 1);
        }
        const beamGeometry = new THREE.BufferGeometry();
        beamGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        beamGeometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
        const beamMesh = new THREE.Mesh(beamGeometry, beamMaterial);
        beamMesh.renderOrder = 2;
        const sheetGeometry = new THREE.BufferGeometry();
        sheetGeometry.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, ...reach(0, beamWide).toArray(), ...reach(0, -beamWide).toArray()], 3));
        sheetGeometry.setAttribute("uv", new THREE.Float32BufferAttribute([0.5, 0, 0, 1, 1, 1], 2));
        sheet = new THREE.Mesh(sheetGeometry, sheetMaterial);
        sheet.renderOrder = 3;
        sheet.frustumCulled = false;
        // A vertical sheet for side-to-side sweeps.
        const sideGeometry = new THREE.BufferGeometry();
        sideGeometry.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, ...reach(beamTall, 0).toArray(), ...reach(-beamTall, 0).toArray()], 3));
        sideGeometry.setAttribute("uv", new THREE.Float32BufferAttribute([0.5, 0, 0, 1, 1, 1], 2));
        sheetSide = new THREE.Mesh(sideGeometry, sheetMaterial);
        sheetSide.renderOrder = 3;
        sheetSide.frustumCulled = false;
        sheetSide.visible = false;
        const holoGeometry = new THREE.BufferGeometry();
        holoGeometry.setAttribute("position", new THREE.Float32BufferAttribute([corners[0], corners[3], corners[2], corners[1]].flatMap((corner) => corner.toArray()), 3));
        holoGeometry.setIndex([0, 1, 2, 0, 2, 3]);
        const holo = new THREE.Mesh(holoGeometry, holoMaterial);
        holo.renderOrder = 1;
        // Straight ahead out of the sensor, towards the viewer, dipped a
        // little so the screen sits in front of the face. Local +x is the
        // beam; the Euler order tilts it down first, then turns it forward.
        const aim = new THREE.Group();
        aim.rotation.set(0, -Math.PI / 2, -0.4);
        aim.add(beamMesh, sheet, sheetSide, holo);
        beam = new THREE.Group();
        beam.position.copy(lens);
        beam.add(aim);
        beam.visible = false;
        gltf.scene.add(beam);

        // Blue light strip on the front-left bezel, placed on the actual surface.
        const raycaster = new THREE.Raycaster(new THREE.Vector3(-0.535, 0.05, 2), new THREE.Vector3(0, 0, -1));
        const [hit] = raycaster.intersectObjects(body, false);
        if (hit) {
          const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.024, 0.2), ledMaterial);
          const normal = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0, 0, 1);
          strip.position.copy(hit.point).addScaledVector(normal, 0.004);
          strip.lookAt(strip.position.clone().add(normal));
          gltf.scene.add(strip);
          const stripGlow = new THREE.Sprite(lensSprite);
          stripGlow.position.copy(strip.position).addScaledVector(normal, 0.01);
          stripGlow.scale.set(0.09, 0.3, 1);
          gltf.scene.add(stripGlow);
          led = strip;
        }

        gltf.scene.position.sub(center);
        idle = new THREE.Group();
        idle.add(gltf.scene);
        root = new THREE.Group();
        root.add(idle);
        root.scale.setScalar(2.65 / Math.max(size.x, size.y, size.z));
        scene.add(root);
        scanner.current = (target, label = "view") => new Promise<void>((resolve) => startScan(target, label, resolve));
        setReady(true);
      } catch {
        cleanup();
        if (!disposed) setFailed(true);
      }
    };
    setReady(false);
    setFailed(false);
    const intersection = new IntersectionObserver(
      (entries) => {
        inView = entries.some((entry) => entry.isIntersecting);
        if (inView) void initialize();
      },
      { rootMargin: "150px" },
    );
    if (host.current) intersection.observe(host.current);
    return () => {
      disposed = true;
      intersection.disconnect();
      cleanup();
    };
  }, [attempt, assetBase]);
  useEffect(() => () => { audio.current?.pause(); }, []);
  return (
    <div className={`robot-viewer ${ready ? "ready" : ""}`}>
      <div className="robot-halo" aria-hidden="true" />
      <img
        className="robot-reference"
        src={`${assetBase}/models/sozo-companion-reference.webp`}
        alt="SOZO companion design reference"
        aria-hidden={ready}
      />
      <div
        ref={host}
        className="robot-canvas"
        tabIndex={0}
        role="img"
        aria-label="Interactive SOZO companion in white and graphite with blue ring eyes and a holographic scanner. Drag horizontally or use left and right arrow keys to turn it."
      />
      <div className="robot-stage-caption">
        <span>SOZO / COMPANION 01</span>
        <span>WHITE × GRAPHITE · BLUE SIGNAL</span>
      </div>
      <div className="robot-interaction">
        <span>
          <MoveHorizontal size={15} />
          Drag to discover
        </span>
        {ready && greeting && <button onClick={greet} aria-label="Say hello"><Volume2 size={14}/> Say hello</button>}
        {ready && (
          <button onClick={() => (onScan ? onScan() : void runScan())} disabled={scanning} aria-label={onScan ? "Scan this page" : "Scan"}>
            <ScanLine size={14} />
            {scanning ? "Scanning…" : "Scan"}
          </button>
        )}
        {failed ? (
          <button onClick={() => setAttempt((value) => value + 1)}>
            Retry 3D view
          </button>
        ) : ready ? (
          <button onClick={() => reset.current?.()}>
            <RotateCcw size={13} />
            Front view
          </button>
        ) : (
          <span role="status">Loading companion…</span>
        )}
      </div>
      {audioError && <p className="robot-error" role="status">{audioError}</p>}
      {failed && (
        <p className="robot-error" role="status">
          The 3D view could not load. Design reference shown.
        </p>
      )}
    </div>
  );
}
