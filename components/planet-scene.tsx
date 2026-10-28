"use client";
import { useEffect, useRef, useState } from "react";
import { RotateCcw, Pause, Play, Move } from "lucide-react";
import type { PlanetaryBody } from "../lib/planetary/manifest";
export default function PlanetScene({
  body = "mars",
  duo = false,
  interactive = false,
  wireframe = false,
}: {
  body?: PlanetaryBody;
  duo?: boolean;
  interactive?: boolean;
  wireframe?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const state = useRef<{
    reset: () => void;
    rotate: (n: number) => void;
  } | null>(null);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const pauseRef = useRef(false);
  pauseRef.current = paused;
  useEffect(() => {
    let disposed = false;
    let frame = 0;
    let destroy = () => {};
    let started = false;
    setReady(false);
    const start = async () => {
      if (started || disposed || !host.current) return;
      started = true;
      try {
        const THREE = await import("three");
        const { OrbitControls } = await import(
          "three/addons/controls/OrbitControls.js"
        );
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
        renderer.toneMappingExposure = 1.2;
        renderer.domElement.setAttribute("aria-hidden", "true");
        element.appendChild(renderer.domElement);
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
        camera.position.set(0, 0, duo ? 9.5 : 7);
        const controls = new OrbitControls(camera, renderer.domElement);
        renderer.domElement.style.touchAction = "pan-y";
        controls.enablePan = false;
        controls.enableZoom = false;
        controls.minPolarAngle = Math.PI / 2;
        controls.maxPolarAngle = Math.PI / 2;
        controls.touches.TWO = null;
        controls.enabled = interactive;
        controls.minDistance = camera.position.length();
        controls.maxDistance = camera.position.length();
        controls.enableDamping = true;
        scene.add(new THREE.AmbientLight(0x9da9c2, 0.55));
        const sun = new THREE.DirectionalLight(0xfff0db, 4);
        sun.position.set(-5, 3, 2);
        scene.add(sun);
        const rim = new THREE.DirectionalLight(0x5c8aff, 1.7);
        rim.position.set(4, 0, -3);
        scene.add(rim);
        const textures: import("three").Texture[] = [];
        const meshes: import("three").Mesh[] = [];
        const loader = new THREE.TextureLoader();
        function planet(
          kind: PlanetaryBody,
          radius: number,
          x: number,
          y: number,
          z = 0,
        ) {
          const map = loader.load(`/planetary/${kind}-color.jpg`, () => {
            if (!disposed) setReady(true);
          });
          map.colorSpace = THREE.SRGBColorSpace;
          map.anisotropy = Math.min(
            4,
            renderer.capabilities.getMaxAnisotropy(),
          );
          textures.push(map);
          const material = new THREE.MeshStandardMaterial({
            map,
            roughness: 1,
            metalness: 0,
            wireframe,
            color: kind === "mars" ? 0xf4c9ae : 0xe7e9ec,
          });
          if (kind === "moon") {
            const bump = loader.load("/planetary/moon-height.jpg");
            textures.push(bump);
            material.bumpMap = bump;
            material.bumpScale = 0.025;
          }
          const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(radius, 96, 64),
            material,
          );
          mesh.position.set(x, y, z);
          mesh.rotation.set(0.08, kind === "mars" ? 2.8 : Math.PI, 0.08);
          scene.add(mesh);
          meshes.push(mesh);
          return mesh;
        }
        if (duo) {
          // Keep the spheres physically separate: the Moon is farther from the camera.
          planet("moon", 1.08, -1.35, 0.62, -0.9);
          planet("mars", 1.65, 1.0, -0.22, 0.6);
        } else planet(body, 1.65, 0, 0);
        const starCoordinates = [];
        for (let i = 0; i < 380; i++) {
          const a = Math.sin(i * 127.1) * 43758.5453;
          const b = Math.sin(i * 311.7) * 15731.743;
          starCoordinates.push(
            (a - Math.floor(a) - 0.5) * 35,
            (b - Math.floor(b) - 0.5) * 22,
            -8 - (i % 10),
          );
        }
        const starsGeometry = new THREE.BufferGeometry();
        starsGeometry.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(starCoordinates, 3),
        );
        const stars = new THREE.Points(
          starsGeometry,
          new THREE.PointsMaterial({
            color: 0xa4b1c9,
            size: 0.019,
            transparent: true,
            opacity: 0.65,
          }),
        );
        scene.add(stars);
        const resize = () => {
          const bounds = element.getBoundingClientRect();
          renderer.setSize(
            Math.max(bounds.width, 1),
            Math.max(bounds.height, 1),
          );
          camera.aspect =
            Math.max(bounds.width, 1) / Math.max(bounds.height, 1);
          camera.updateProjectionMatrix();
        };
        const observer = new ResizeObserver(resize);
        observer.observe(element);
        resize();
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
        let previous = 0;
        const animate = (time: number) => {
          if (disposed) return;
          frame = requestAnimationFrame(animate);
          if (time - previous < 33 || document.hidden) return;
          previous = time;
          if (!pauseRef.current && !reduced.matches)
            meshes.forEach((m) => (m.rotation.y += 0.00065));
          controls.update();
          renderer.render(scene, camera);
        };
        frame = requestAnimationFrame(animate);
        state.current = {
          reset: () => {
            controls.reset();
            camera.position.set(0, 0, duo ? 9.5 : 7);
          },
          rotate: (n) => meshes.forEach((m) => (m.rotation.y += n)),
        };
        destroy = () => {
          cancelAnimationFrame(frame);
          observer.disconnect();
          controls.dispose();
          textures.forEach((t) => t.dispose());
          meshes.forEach((m) => {
            m.geometry.dispose();
            (m.material as import("three").Material).dispose();
          });
          starsGeometry.dispose();
          (stars.material as import("three").Material).dispose();
          renderer.dispose();
          renderer.domElement.remove();
          state.current = null;
        };
      } catch {
        setReady(false);
      }
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          start();
        }
      },
      { rootMargin: "150px" },
    );
    if (host.current) observer.observe(host.current);
    return () => {
      disposed = true;
      observer.disconnect();
      destroy();
    };
  }, [body, duo, interactive, wireframe]);
  return (
    <div
      className={`planet-scene ${duo ? "duo" : ""} ${interactive ? "interactive" : ""} ${ready ? "ready" : ""}`}
    >
      <div className="planet-fallback" aria-hidden="true">
        <div className={`fallback-globe ${duo ? "mars" : body}`} />
        {duo && <div className="fallback-globe moon" />}
      </div>
      <div
        ref={host}
        className="webgl-host"
        tabIndex={interactive ? 0 : undefined}
        aria-label={
          interactive
            ? `Interactive ${body} globe. Drag left or right, or use left and right arrow keys. Vertical rotation and zoom are locked.`
            : undefined
        }
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
            e.preventDefault();
            state.current?.rotate(e.key === "ArrowRight" ? 0.15 : -0.15);
          }
        }}
      />
      {interactive && (
        <div className="globe-controls">
          <span>
            <Move size={13} />
            Drag left or right
          </span>
          <button
            aria-label="Reset globe view"
            onClick={() => state.current?.reset()}
          >
            <RotateCcw size={14} />
          </button>
          <button
            aria-label={
              paused ? "Resume globe rotation" : "Pause globe rotation"
            }
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? <Play size={13} /> : <Pause size={13} />}
          </button>
        </div>
      )}
    </div>
  );
}
