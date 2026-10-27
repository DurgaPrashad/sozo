"use client";
import { useEffect, useRef, useState } from "react";
import {
  Pause,
  Play,
  Volume2,
  VolumeX,
  ArrowDown,
  ArrowUpRight,
} from "lucide-react";
export const missionFilms = [
  {
    id: "orbital-assistance",
    name: "Orbital assistance",
    place: "EARTH ORBIT",
    description:
      "An imagined astronaut and robotic assistant working above Earth.",
  },
  {
    id: "lunar-fieldwork",
    name: "Lunar fieldwork",
    place: "THE MOON",
    description:
      "An imagined lunar outpost, astronaut, and robotic field assistant.",
  },
  {
    id: "martian-frontier",
    name: "Martian frontier",
    place: "MARS",
    description:
      "An imagined Martian outpost with astronauts and a robotic rover.",
  },
] as const;
export default function MissionFilm() {
  const video = useRef<HTMLVideoElement>(null);
  const stage = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0),
    [paused, setPaused] = useState(false),
    [muted, setMuted] = useState(true),
    [visible, setVisible] = useState(true),
    [progress, setProgress] = useState(0),
    [failed, setFailed] = useState(false);
  const film = missionFilms[active];
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) setPaused(true);
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.08 },
    );
    if (stage.current) observer.observe(stage.current);
    const onVisibility = () =>
      setVisible(
        !document.hidden &&
          !!stage.current &&
          stage.current.getBoundingClientRect().bottom > 0,
      );
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  useEffect(() => {
    setProgress(0);
    setFailed(false);
  }, [active]);
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    el.muted = muted;
    el.volume = 0.45;
    if (paused || !visible) {
      el.pause();
      return;
    }
    void el.play().catch(() => setPaused(true));
  }, [active, paused, visible, muted]);
  const choose = (index: number) => {
    if (index === active && video.current) video.current.currentTime = 0;
    setActive(index);
    setPaused(false);
  };
  return (
    <>
      <section
        className="mission-film"
        ref={stage}
        aria-label="SOZO mission film reel"
      >
        <video
          key={film.id}
          ref={video}
          className="mission-film-video"
          src={`/films/sozo-${film.id}.mp4`}
          poster={`/films/sozo-${film.id}.jpg`}
          autoPlay
          muted={muted}
          playsInline
          preload="auto"
          aria-label={film.description + " AI-generated concept film."}
          onEnded={() => {
            setActive((index) => (index + 1) % missionFilms.length);
          }}
          onTimeUpdate={(e) => {
            const el = e.currentTarget;
            if (el.duration) setProgress(el.currentTime / el.duration);
          }}
          onError={() => setFailed(true)}
        />
        <div className="mission-film-shade" aria-hidden="true" />
        <div className="film-wordmark">
          <h1>SOZO</h1>
        </div>
        <div className="film-bottom">
          <a
            href="#frontiers"
            className="film-explore"
            aria-label="Explore Moon and Mars"
          >
            <ArrowDown size={20} />
          </a>
          <span className="film-disclosure">
            AI-GENERATED CONCEPT FILM{failed ? " · PLAYBACK UNAVAILABLE" : ""}
          </span>
          <div className="film-controls">
            <button
              aria-label={paused ? "Play mission film" : "Pause mission film"}
              onClick={() => setPaused((value) => !value)}
            >
              {paused ? <Play size={17} /> : <Pause size={17} />}
            </button>
            <button
              aria-label={muted ? "Turn film sound on" : "Mute film sound"}
              aria-pressed={!muted}
              onClick={() => setMuted((value) => !value)}
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          </div>
        </div>
      </section>
      <div className="film-chapters" aria-label="Mission films">
        {missionFilms.map((item, index) => (
          <button
            key={item.id}
            onClick={() => choose(index)}
            className={index === active ? "active" : ""}
            aria-pressed={index === active}
          >
            <span className="chapter-index">0{index + 1}</span>
            <span>
              <small>{item.place}</small>
              <strong>{item.name}</strong>
            </span>
            <ArrowUpRight size={18} />
            <span
              className="chapter-progress"
              style={{
                transform: `scaleX(${index === active ? progress : 0})`,
              }}
            />
          </button>
        ))}
      </div>
    </>
  );
}
