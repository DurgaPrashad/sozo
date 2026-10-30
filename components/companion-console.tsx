"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Mic, MicOff, Send, Square, MonitorUp, Volume2, VolumeX, X, Loader2, RotateCcw, Bot } from "lucide-react";
import RobotCompanion from "./robot-companion";
import ScientificText from "./scientific-text";
import { COMPUTATIONAL } from "../lib/science/astro";

type Citation = { title?: string; url?: string };
type Analysis = { distanceKm?: number | null };
type ErrorBody = { code?: string; message?: string; retryable?: boolean; retryAfterSeconds?: number };
type ServiceData = {
  error?: string | ErrorBody;
  visionConfigured?: boolean;
  chatProviders?: { provider: string; model: string; role: string }[];
  metaLlama?: { configured: boolean; model: string | null };
  audio?: string; audios?: string[]; mimeType?: string;
  reply?: string; citations?: Citation[]; limitations?: string[]; analysis?: Analysis; calculations?: Calculation[];
  provider?: string; model?: string; timings?: { totalMs: number };
  transcript?: string; text?: string;
};
type Calculation = { operation: string; result?: Record<string, number | string>; error?: string };
type Message = { role: "user" | "assistant"; content: string; citations?: Citation[]; limitations?: string[]; analysis?: Analysis; answeredBy?: string; calculations?: Calculation[] };
type Style = "brief" | "standard" | "detailed";
type Stage = "idle" | "retrieving" | "reading" | "answering" | "streaming";

// "transfer_time_days" → "transfer time 258.9 days"
const UNITS: Record<string, string> = { km_s: "km/s", m_s2: "m/s²", m_s: "m/s", days: "days", h: "h", min: "min", s: "s", km: "km", kg: "kg", g: "g" };
const quantity = (key: string, value: number | string) => {
  const match = key.match(/_(km_s|m_s2|m_s|days|h|min|s|km|kg|g)$/);
  const name = (match ? key.slice(0, -match[0].length) : key).replace(/_/g, " ");
  return `${name} ${value}${match ? ` ${UNITS[match[1]]}` : ""}`;
};

class ServiceError extends Error {
  constructor(message: string, public retryable = false, public retryAfterSeconds?: number) { super(message); }
}
const stored = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const store = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* storage unavailable */ } };
// Literature search helps scientific questions; small talk skips it.
const scientific = /moon|lunar|mars|martian|rover|terrain|space|mission|geolog|ice|shadow|crater|instrument|paper|evidence|route|map|study|scientific|citation|rocket|orbit|orbital|delta-?v|propuls|thrust|spacecraft|satellite|astronaut|eva|iss|asteroid|comet|planet|radiation|robot|launch|trajector|habitat/i;

export type CompanionConsoleProps = { apiBase?: string; getToken?: () => Promise<string>; sharedContext?: Record<string, unknown>; embedded?: boolean };
export default function CompanionConsole({ apiBase = "", getToken, sharedContext, embedded = false }: CompanionConsoleProps) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [stage, setStage] = useState<Stage>("idle");
  const [sources, setSources] = useState(0);
  const [recording, setRecording] = useState(false), [speaking, setSpeaking] = useState(false), [voice, setVoice] = useState(true);
  // This panel renders only in the browser, so saved preferences load up front.
  const [robotVoice, setRobotVoice] = useState(() => stored("sozo-robot-voice") === "on");
  const [style, setStyle] = useState<Style>(() => (stored("sozo-answer-style") as Style) || "standard");
  const [error, setError] = useState<{ message: string; retry?: string } | null>(null);
  const [body, setBody] = useState("moon"), [notes, setNotes] = useState(""), [screenshot, setScreenshot] = useState("");
  const [vision, setVision] = useState(false);
  const [models, setModels] = useState<{ primary: string | null; meta: { configured: boolean; model: string | null } }>({ primary: null, meta: { configured: false, model: null } });
  const busy = stage !== "idle";
  const abort = useRef<AbortController | null>(null), player = useRef<{ stop: () => void } | null>(null), recorder = useRef<MediaRecorder | null>(null), stream = useRef<MediaStream | null>(null), audioUrl = useRef("");

  const request = async (path: string, init: RequestInit = {}) => {
    const token = await getToken?.();
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(`${apiBase}/api/companion/${path}`, { ...init, headers, credentials: getToken ? "omit" : "same-origin" });
    if (!response.ok) {
      let detail: ErrorBody = { message: "Request failed." };
      try { const data = await response.json() as ServiceData; detail = typeof data.error === "string" ? { message: data.error } : data.error ?? detail; } catch { /* keep the generic message */ }
      if (response.status === 401) throw new ServiceError("Sign in to talk with SOZO, or refresh your integration session.");
      throw new ServiceError(detail.message || "Request failed.", Boolean(detail.retryable), detail.retryAfterSeconds);
    }
    return response;
  };

  useEffect(() => {
    fetch(`${apiBase}/api/companion/status`).then((r) => r.json() as Promise<ServiceData>).then((data) => {
      setVision(Boolean(data.visionConfigured));
      setModels({ primary: data.chatProviders?.[0]?.provider ?? null, meta: data.metaLlama ?? { configured: false, model: null } });
    }).catch(() => {});
    return () => {
      abort.current?.abort(); player.current?.stop(); stream.current?.getTracks().forEach((t) => t.stop());
      if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    };
  }, [apiBase]);
  useEffect(() => { if (sharedContext?.body === "moon" || sharedContext?.body === "mars") setBody(sharedContext.body); }, [sharedContext?.body]);

  const stopAudio = () => { player.current?.stop(); player.current = null; setSpeaking(false); };

  // Optional robot voice made in the browser: a 40 Hz ring modulator, a short
  // metallic comb and a small-speaker band, mixed with the clear voice.
  const playRobot = async (blob: Blob) => {
    const context = new AudioContext();
    const buffer = await context.decodeAudioData(await blob.arrayBuffer());
    const source = context.createBufferSource(); source.buffer = buffer;
    const band = context.createBiquadFilter(); band.type = "bandpass"; band.frequency.value = 1400; band.Q.value = 0.6;
    const dry = context.createGain(); dry.gain.value = 0.55;
    const ring = context.createGain(); ring.gain.value = 0;
    const carrier = context.createOscillator(); carrier.frequency.value = 40; carrier.connect(ring.gain);
    const comb = context.createDelay(0.05); comb.delayTime.value = 0.008;
    const feedback = context.createGain(); feedback.gain.value = 0.35;
    const wet = context.createGain(); wet.gain.value = 0.5;
    source.connect(dry).connect(band);
    source.connect(ring).connect(comb).connect(wet).connect(band);
    comb.connect(feedback).connect(comb);
    band.connect(context.destination);
    carrier.start(); source.start();
    source.onended = () => { carrier.stop(); void context.close(); setSpeaking(false); };
    player.current = { stop: () => { try { source.stop(); } catch { /* already stopped */ } } };
    setSpeaking(true);
  };
  const speak = async (text: string) => {
    stopAudio();
    const response = await request("text-to-speech", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: text.slice(0, 1800) }), signal: abort.current?.signal });
    const data = await response.json() as ServiceData;
    const value = data.audio || data.audios?.[0];
    if (!value) throw new ServiceError("SOZO's voice returned no audio.");
    const blob = new Blob([Uint8Array.from(atob(value), (c) => c.charCodeAt(0))], { type: data.mimeType || "audio/mpeg" });
    if (robotVoice) return playRobot(blob);
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    audioUrl.current = URL.createObjectURL(blob);
    const audio = new Audio(audioUrl.current);
    player.current = { stop: () => audio.pause() };
    audio.onended = () => setSpeaking(false);
    audio.onerror = () => { setSpeaking(false); setError({ message: "Audio playback failed. The reply remains available as text." }); };
    await audio.play();
    setSpeaking(true);
  };

  const updateAnswer = (change: (message: Message) => Message) =>
    setMessages((prev) => {
      const last = prev.at(-1);
      return last?.role === "assistant" ? [...prev.slice(0, -1), change(last)] : [...prev, change({ role: "assistant", content: "" })];
    });

  const ask = async (content: string) => {
    setError(null); setStage("retrieving"); setSources(0); stopAudio();
    abort.current = new AbortController();
    const history = messages.slice(-8).map(({ role, content: text }) => ({ role, content: text }));
    setMessages((prev) => [...prev, { role: "user", content }]);
    // Calculations are their own evidence; literature would only add noise.
    const retrieve = !COMPUTATIONAL.test(content) && scientific.test(content + history.slice(-2).map((x) => x.content).join(" "));
    let answer = "";
    try {
      const response = await request("chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        signal: abort.current.signal,
        body: JSON.stringify({ message: content, history, retrieve, style, context: { ...sharedContext, body, notes: [sharedContext?.notes, notes].filter(Boolean).join("\n"), ...(screenshot ? { screenshot } : {}) } }),
      });
      if (!response.headers.get("content-type")?.includes("event-stream")) {
        const data = await response.json() as ServiceData;
        answer = data.reply || "No reply was returned.";
        setMessages((prev) => [...prev, { role: "assistant", content: answer, citations: data.citations, limitations: data.limitations, analysis: data.analysis, answeredBy: data.provider, calculations: data.calculations }]);
      } else {
        if (!retrieve) setStage("answering");
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "", citations: Citation[] = [];
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let split: number;
          while ((split = buffer.indexOf("\n\n")) >= 0) {
            const block = buffer.slice(0, split); buffer = buffer.slice(split + 2);
            const event = block.match(/^event: (.+)$/m)?.[1];
            const raw = block.match(/^data: (.*)$/m)?.[1];
            if (!event || raw === undefined) continue;
            const data = JSON.parse(raw);
            if (event === "status") { setStage(data.stage); if (typeof data.literature === "number") setSources(data.literature); }
            else if (event === "citations") citations = data;
            else if (event === "calculations") updateAnswer((m) => ({ ...m, calculations: data }));
            else if (event === "delta") { answer += data.text; setStage("streaming"); updateAnswer((m) => ({ ...m, content: m.content + data.text, citations })); }
            else if (event === "analysis") updateAnswer((m) => ({ ...m, analysis: data ?? undefined }));
            else if (event === "limitations") updateAnswer((m) => ({ ...m, limitations: data }));
            else if (event === "done") updateAnswer((m) => ({ ...m, answeredBy: data.provider ? `${data.provider} · ${(data.timings.totalMs / 1000).toFixed(1)} s` : undefined }));
            else if (event === "error") throw new ServiceError(data.error?.message || "SOZO could not answer.", Boolean(data.error?.retryable), data.error?.retryAfterSeconds);
          }
        }
      }
      setScreenshot("");
      setStage("idle");
      if (voice && answer) {
        try { await speak(answer); } catch (e) { if ((e as Error).name !== "AbortError") setError({ message: `Reply ready. ${(e as Error).message}` }); }
      }
    } catch (e) {
      setStage("idle");
      if ((e as Error).name === "AbortError") return;
      const failure = e as ServiceError;
      setError({
        message: `${failure.message}${failure.retryAfterSeconds ? ` (retry in about ${failure.retryAfterSeconds} s)` : ""}`,
        ...(failure.retryable ? { retry: content } : {}),
      });
      if (!answer) { setMessages((prev) => prev.slice(0, -1)); setDraft(content); }
    }
  };
  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!draft.trim() || busy) return;
    const content = draft.trim();
    setDraft("");
    await ask(content);
  };

  const record = async () => {
    if (recording) { recorder.current?.stop(); setRecording(false); return; }
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error("Microphone recording is unavailable in this browser. Type your question instead.");
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      const chunks: Blob[] = [];
      const rec = new MediaRecorder(media);
      recorder.current = rec;
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = async () => {
        media.getTracks().forEach((t) => t.stop());
        setRecording(false);
        if (!chunks.length) return;
        setStage("answering");
        try {
          const form = new FormData();
          form.set("file", new Blob(chunks, { type: rec.mimeType }), rec.mimeType.includes("mp4") ? "question.mp4" : "question.webm");
          const res = await request("speech-to-text", { method: "POST", body: form });
          const data = await res.json() as ServiceData;
          setDraft(data.transcript || data.text || "");
        } catch (e) { setError({ message: (e as Error).message }); }
        finally { setStage("idle"); }
      };
      rec.start();
      setRecording(true);
      setTimeout(() => { if (rec.state === "recording") rec.stop(); }, 30000);
    } catch (e) { setError({ message: (e as Error).message }); }
  };
  const shareScreen = async () => {
    setError(null);
    let capture: MediaStream | undefined;
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) throw new Error("Screen sharing is unavailable here. Add map context as text instead.");
      capture = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const video = document.createElement("video");
      video.srcObject = capture; video.muted = true;
      await video.play();
      await new Promise<void>((resolve) => { if (video.readyState >= 2) resolve(); else video.onloadeddata = () => resolve(); });
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 1280 / video.videoWidth);
      canvas.width = video.videoWidth * scale; canvas.height = video.videoHeight * scale;
      canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
      setScreenshot(canvas.toDataURL("image/jpeg", 0.62));
      video.srcObject = null;
    } catch (e) { if ((e as Error).name !== "NotAllowedError") setError({ message: (e as Error).message }); }
    finally { capture?.getTracks().forEach((t) => t.stop()); }
  };

  const working = stage === "retrieving" ? "Searching Crossref and Europe PMC…" : stage === "reading" ? `Reading ${sources} source${sources === 1 ? "" : "s"}…` : stage === "answering" ? "Working out the answer…" : "";
  const signal = recording ? "listening" : stage === "streaming" ? "speaking" : busy ? "thinking" : speaking ? "speaking" : "idle";
  return <section className={`companion-console ${embedded ? "embedded" : ""}`} aria-label="Talk with SOZO">
    <div className="companion-avatar">
      <RobotCompanion assetBase={apiBase} speaking={speaking || stage === "streaming"} signal={signal} greeting={false} />
      <div className="companion-live-label"><i />{recording ? "Microphone on" : speaking ? "Speaking" : stage === "streaming" ? "Answering" : busy ? "Researching your question" : "Ready when you are"}</div>
    </div>
    <div className="companion-conversation">
      <header>
        <div>
          <span className="premium-eyebrow">SOZO SCIENTIST</span>
          <h2>Let’s work it out.</h2>
          <p className="companion-models">
            {models.primary ? <span>{models.primary}</span> : <span>Model not configured</span>}
            <span className={models.meta.configured ? "meta ready" : "meta"}>Meta Llama {models.meta.configured ? "· ready" : "· not connected"}</span>
          </p>
        </div>
        <div className="companion-header-actions">
          <button className="console-icon" onClick={() => { const next = !robotVoice; setRobotVoice(next); store("sozo-robot-voice", next ? "on" : "off"); }} aria-label={robotVoice ? "Use the natural voice" : "Use a robot voice"} aria-pressed={robotVoice} title="Robot voice"><Bot size={18} /></button>
          <button className="console-icon" onClick={() => { setVoice(!voice); stopAudio(); }} aria-label={voice ? "Mute spoken replies" : "Enable spoken replies"} aria-pressed={voice}>{voice ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
        </div>
      </header>
      <div className="companion-messages" aria-live="polite" aria-busy={busy}>
        {!messages.length && <div className="companion-welcome"><p>Ask about a world, a rocket or an orbit. SOZO shows the evidence and the working.</p><div className="console-prompts">{["What evidence supports lunar south-pole ice?", "Delta-v for a Hohmann transfer from LEO to GEO?", "What hazards matter for a rover at Jezero?"].map((text) => <button key={text} onClick={() => setDraft(text)}>{text}</button>)}</div></div>}
        {messages.map((message, i) => <article className={`companion-message ${message.role}`} key={i}>
          <strong>{message.role === "user" ? "You" : "SOZO"}</strong>
          <ScientificText text={message.content} sources={message.citations?.filter((c): c is { url: string; title: string } => Boolean(c.url && c.title))} />
          {message.citations?.map((c, j) => c.url && /^https:\/\//.test(c.url) ? <a href={c.url} target="_blank" rel="noreferrer" key={j}>[{j + 1}] {c.title || `Source ${j + 1}`} ↗</a> : null)}
          {typeof message.analysis?.distanceKm === "number" && <small>Computed polyline length: {message.analysis.distanceKm.toFixed(3)} km · spherical approximation</small>}
          {message.limitations?.some((x) => /unsupported citation|unavailable|took longer|did not answer|inconsistent/.test(x)) && <p className="console-error">{message.limitations.filter((x) => /unsupported citation|unavailable|took longer|did not answer|inconsistent/.test(x)).join(" ")}</p>}
          {message.calculations?.some((c) => c.result) && <div className="companion-calculations" aria-label="Exact calculations">
            <span>Calculated by SOZO · two-body model</span>
            {message.calculations.filter((c) => c.result).map((c, j) => <code key={j}>{c.operation.replace(/_/g, " ")}: {Object.entries(c.result!).filter(([, v]) => typeof v === "number").map(([k, v]) => quantity(k, v)).join(" · ")}</code>)}
          </div>}
          {message.answeredBy && <small className="companion-answered">Answered by {message.answeredBy}</small>}
          {message.role === "assistant" && message.content && <button className="text-button" disabled={busy} onClick={() => { abort.current = new AbortController(); void speak(message.content).catch((e) => setError({ message: e.message })); }}>Read aloud</button>}
        </article>)}
        {busy && stage !== "streaming" && <p role="status" className="companion-working"><Loader2 size={15} className="spin" /> {working}</p>}
      </div>
      <details className="companion-context"><summary>Map & exploration context {sharedContext && Object.keys(sharedContext).length ? "· connected" : ""}</summary><label>World<select value={body} onChange={(e) => setBody(e.target.value)}><option value="moon">Moon</option><option value="mars">Mars</option></select></label><label>Observations, route data or map labels<textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={6000} placeholder="Add the data, units and source you want SOZO to consider." /></label><p>Shared context is sent with your next question. Terrain and routes need source data; imagery alone cannot establish a safe route.</p>{vision && <button type="button" onClick={() => void shareScreen()}><MonitorUp size={15} /> Choose a screen snapshot</button>}{screenshot && <div className="shared-screen-preview"><img src={screenshot} alt="Screen snapshot selected for the next question" /><button aria-label="Remove screen snapshot" onClick={() => setScreenshot("")}><X size={16} /></button><small>This snapshot will be sent to Sarvam with your next question. Screen sharing has stopped.</small></div>}</details>
      {error && <p className="console-error" role="alert">{error.message}{error.retry && <button type="button" className="text-button companion-retry" disabled={busy} onClick={() => void ask(error.retry!)}><RotateCcw size={13} /> Retry</button>}</p>}
      <form className="companion-composer" onSubmit={submit}>
        <textarea aria-label="Message SOZO" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={2000} placeholder="Ask SOZO…" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submit(); } }} />
        <div>
          <select className="companion-style" aria-label="Answer length" value={style} onChange={(e) => { const next = e.target.value as Style; setStyle(next); store("sozo-answer-style", next); }}>
            <option value="brief">Brief</option><option value="standard">Standard</option><option value="detailed">Detailed</option>
          </select>
          <button type="button" className={`console-icon ${recording ? "recording" : ""}`} disabled={busy} onClick={() => void record()} aria-label={recording ? "Stop recording and transcribe" : "Record a question"}>{recording ? <MicOff size={18} /> : <Mic size={18} />}</button>
          {busy || speaking ? <button className="console-icon" type="button" aria-label="Stop response and audio" onClick={() => { abort.current?.abort(); stopAudio(); setStage("idle"); }}><Square size={17} /></button> : null}
          <button type="submit" className="console-send" disabled={busy || !draft.trim()} aria-label="Send message"><Send size={17} /></button>
        </div>
      </form>
      <small className="companion-disclosure">Sarvam AI and voice{models.meta.configured ? " · Meta Llama" : ""} · Source links support verification. Prototype assistance; validate plans against original mission data.</small>
    </div>
  </section>;
}
