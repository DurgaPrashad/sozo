"use client";
import { useState } from "react";
import { ArrowUpRight, ArrowLeft, Maximize2, Moon, Orbit, Wrench, Gauge } from "lucide-react";

const SIM = "https://sozo3d.momar.si/";
const features = [
  { Icon: Moon, title: "Drive on the Moon and Mars", text: "Take the rover across low-gravity and Martian terrain, with real physics running in your browser." },
  { Icon: Orbit, title: "Float it in orbit", text: "Leave the surface and watch the same vehicle behave in microgravity." },
  { Icon: Wrench, title: "Take it apart", text: "Open the rover down to its parts, wiring and pins to see how it is built." },
  { Icon: Gauge, title: "Real physics, no install", text: "Runs in a desktop browser with nothing to download. Best with a keyboard and a modern GPU." },
];
export default function Sim3D() {
  const [live, setLive] = useState(false);
  return (
    <div className="premium-site sim-page">
      <header className="sim-nav">
        <a href="/" className="sim-back"><ArrowLeft size={15} /> SOZO</a>
        <span className="premium-eyebrow">3DSIM</span>
        <a className="premium-button light" href={SIM} target="_blank" rel="noreferrer">Open full screen <ArrowUpRight size={15} /></a>
      </header>
      <main>
        <section className="sim-hero premium-section">
          <span className="premium-eyebrow">SOZO / 3D SIMULATION</span>
          <h2>A rover on real physics,<br /><span>in your browser.</span></h2>
          <p>Drive it on the Moon and Mars, float it in orbit, take it apart down to the pins. This is a design study: nothing has been built.</p>
          <div className="sim-actions">
            <a className="premium-button light" href={SIM} target="_blank" rel="noreferrer">Launch the simulator <ArrowUpRight size={16} /></a>
            <button className="premium-button sim-ghost" onClick={() => setLive(true)} disabled={live}>{live ? "Preview running" : "Preview below"} <Maximize2 size={15} /></button>
          </div>
        </section>
        <section className="sim-stage premium-section">
          <div className="sim-frame">
            {live ? (
              <iframe src={SIM} title="SOZO planetary rover simulator" allow="fullscreen; gamepad; accelerometer" loading="lazy" />
            ) : (
              <button className="sim-play" onClick={() => setLive(true)} aria-label="Start the 3D simulation preview">
                <span>▶</span>
                <strong>Start the live preview</strong>
                <small>Loads the simulator from sozo3d.momar.si</small>
              </button>
            )}
          </div>
          <p className="sim-note">Runs on sozo3d.momar.si. If the preview is small, use “Open full screen”.</p>
        </section>
        <section className="sim-features premium-section">
          {features.map(({ Icon, title, text }) => (
            <article key={title}><Icon size={22} strokeWidth={1.4} /><h3>{title}</h3><p>{text}</p></article>
          ))}
        </section>
      </main>
    </div>
  );
}
