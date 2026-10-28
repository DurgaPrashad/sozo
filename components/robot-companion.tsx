"use client";
import { useEffect, useRef, useState } from "react";
import { RotateCcw, MoveHorizontal, Volume2 } from "lucide-react";
export type RobotCompanionProps = { assetBase?: string; speaking?: boolean; signal?: "idle" | "listening" | "thinking" | "speaking"; greeting?: boolean };
export default function RobotCompanion({ assetBase = "", speaking = false, signal = "idle", greeting = true }: RobotCompanionProps) {
  const activity = useRef({ speaking, signal });
  activity.current = { speaking, signal };
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
        renderer.toneMappingExposure = 0.95;
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
        scene.add(new THREE.HemisphereLight(0xf4f8ff, 0x1b2230, 1.4));
        const key = new THREE.DirectionalLight(0xfff8f0, 3);
        key.position.set(-3, 4, 5);
        scene.add(key);
        const rim = new THREE.DirectionalLight(0xbcdfff, 2);
        rim.position.set(3, 2, -2);
        scene.add(rim);
        const silver = new THREE.MeshPhysicalMaterial({
          color: 0xb8c1cc,
          metalness: 0.82,
          roughness: 0.32,
          clearcoat: 0.35,
          clearcoatRoughness: 0.24,
          envMapIntensity: 1.25,
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
            diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.003,0.005,0.009),robotMask);
          `,
            )
            .replace(
              "#include <metalnessmap_fragment>",
              "#include <metalnessmap_fragment>\nmetalnessFactor=mix(metalnessFactor,0.20,robotMask);",
            )
            .replace(
              "#include <roughnessmap_fragment>",
              "#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,0.52,robotMask);",
            );
        };
        const faceCanvas = document.createElement("canvas");
        faceCanvas.width = 768; faceCanvas.height = 480;
        const ctx = faceCanvas.getContext("2d")!;
        const faceTexture = new THREE.CanvasTexture(faceCanvas);
        faceTexture.colorSpace = THREE.SRGBColorSpace;
        const screen = new THREE.MeshBasicMaterial({ map: faceTexture, toneMapped: false });
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        let faceFrame = -1;
        const drawFace = (time: number) => {
          const tick = reduced ? 0 : Math.floor(time / 90);
          if (tick === faceFrame && !activity.current.speaking) return;
          faceFrame = tick;
          ctx.fillStyle = "#020c0a"; ctx.fillRect(0,0,768,480);
          ctx.font = "19px monospace";
          const chars = "01010101#$%&<>[]{}:;+=/";
          for (let row=0; row<21; row++) for (let col=0; col<43; col++) {
            const n = (col*29 + row*13 + tick*7 + Math.floor(tick/4)*col) % chars.length;
            const bright = (row + Math.floor(tick/2) + col%7)%21;
            ctx.fillStyle = bright < 2 ? "#a2ffcf" : bright < 6 ? "#38df8a" : "#0c633c";
            ctx.globalAlpha = .25 + ((row*7+col*3)%10)/20;
            ctx.fillText(chars[n], col*18, row*23+22);
          }
          ctx.globalAlpha=1;
          const shade=ctx.createLinearGradient(0,90,0,390); shade.addColorStop(0,"#02120b20");shade.addColorStop(.5,"#02120bdd");shade.addColorStop(1,"#02120b20");
          ctx.fillStyle=shade;ctx.fillRect(0,85,768,325);
          ctx.shadowColor="#60ffb4";ctx.shadowBlur=18;ctx.strokeStyle="#91ffd0";ctx.lineWidth=6;
          const blink=!reduced && tick%63===0;
          for(const x of [225,543]) {ctx.beginPath();ctx.moveTo(x-49,210);ctx.quadraticCurveTo(x,blink?210:150,x+49,210);ctx.stroke();}
          ctx.beginPath();
          for(let i=0;i<=66;i++){const x=255+i*4; const amp=activity.current.speaking ? (12+16*Math.sin(time/110))*Math.sin(i*.65+time/70) : 11*Math.sin(i/66*Math.PI); if(i===0)ctx.moveTo(x,292+amp);else ctx.lineTo(x,292+amp); }ctx.stroke();
          ctx.shadowBlur=0;ctx.font="16px monospace";ctx.textAlign="center";ctx.fillStyle="#86d8ae";
          ctx.fillText(activity.current.speaking?"SOZO / SPEAKING":activity.current.signal==="thinking"?"SOZO / ANALYSING":activity.current.signal==="listening"?"SOZO / LISTENING":"SOZO / READY",384,422);ctx.textAlign="start";
          faceTexture.needsUpdate=true;
        };
        drawFace(0);
        const materials: import("three").Material[] = [
          silver,
          screen,
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
        const render = (time: number) => {
          if (disposed) return;
          frame = requestAnimationFrame(render);
          if (document.hidden || !inView || time - previous < 33) return;
          previous = time;
          drawFace(time);
          controls.update();
          renderer.render(scene, camera);
        };
        frame = requestAnimationFrame(render);
        cleanup = () => {
          cancelAnimationFrame(frame);
          observer.disconnect();
          element.removeEventListener("keydown", onKey);
          controls.dispose();
          root?.traverse((object) => {
            if ((object as import("three").Mesh).isMesh)
              (object as import("three").Mesh).geometry.dispose();
          });
          materials.forEach((material) => material.dispose());
          originals.forEach((material) => material.dispose());
          faceTexture.dispose();
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
        gltf.scene.traverse((object) => {
          const mesh = object as import("three").Mesh;
          if (!mesh.isMesh) return;
          const mats = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];
          mats.forEach((material) => originals.add(material));
          mesh.geometry.computeVertexNormals();
          mesh.material = silver;
        });
        const displayPanel = (
          width: number,
          height: number,
          r: number,
          x: number,
          y: number,
          z: number,
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
          const panel = new THREE.Mesh(geometry, screen);
          panel.position.set(x, y, z);
          gltf.scene.add(panel);
        };
        displayPanel(0.96, 0.595, 0.085, -0.016, 0.045, 0.264);
        displayPanel(0.295, 0.108, 0.02, -0.012, 0.667, 0.118);
        gltf.scene.position.sub(center);
        root = new THREE.Group();
        root.add(gltf.scene);
        root.scale.setScalar(2.65 / Math.max(size.x, size.y, size.z));
        scene.add(root);
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
        aria-label="Interactive SOZO companion in silver and graphite. Drag horizontally or use left and right arrow keys to turn it."
      />
      <div className="robot-stage-caption">
        <span>SOZO / COMPANION 01</span>
        <span>SILVER × GRAPHITE</span>
      </div>
      <div className="robot-interaction">
        <span>
          <MoveHorizontal size={15} />
          Drag to discover
        </span>
        {ready && greeting && <button onClick={greet} aria-label="Say hello"><Volume2 size={14}/> Say hello</button>}
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
