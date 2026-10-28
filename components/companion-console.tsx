"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Mic, MicOff, Send, Square, MonitorUp, Volume2, VolumeX, X, Loader2 } from "lucide-react";
import RobotCompanion from "./robot-companion";
import ScientificText from "./scientific-text";
type ServiceData = {limitations?:string[];analysis?:{distanceKm?:number};error?: string | {message?:string}; configured?:boolean;visionConfigured?:boolean; audio?:string;audios?:string[];mimeType?:string;reply?:string;citations?:Citation[];transcript?:string;text?:string};
type Citation = { title?: string; url?: string };
export type CompanionConsoleProps = { apiBase?: string; getToken?: () => Promise<string>; sharedContext?: Record<string, unknown>; embedded?: boolean };
export default function CompanionConsole({ apiBase = "", getToken, sharedContext, embedded = false }: CompanionConsoleProps) {
  const [draft,setDraft]=useState("");
  const [messages,setMessages]=useState<{role:"user"|"assistant";content:string;citations?:Citation[];limitations?:string[];analysis?:{distanceKm?:number}}[]>([]);
  const [busy,setBusy]=useState(false),[recording,setRecording]=useState(false),[speaking,setSpeaking]=useState(false),[voice,setVoice]=useState(true),[error,setError]=useState("");
  const [body,setBody]=useState("moon"),[notes,setNotes]=useState(""),[screenshot,setScreenshot]=useState("");
  const [vision,setVision]=useState(false);
  const abort=useRef<AbortController|null>(null),player=useRef<HTMLAudioElement|null>(null),recorder=useRef<MediaRecorder|null>(null),stream=useRef<MediaStream|null>(null),audioUrl=useRef("");
  const request=async(path:string,init:RequestInit={})=>{
    const token=await getToken?.();
    const headers=new Headers(init.headers); if(token)headers.set("Authorization",`Bearer ${token}`);
    const response=await fetch(`${apiBase}/api/companion/${path}`,{...init,headers,credentials:getToken?"omit":"same-origin"});
    if(!response.ok){let detail="Request failed.";try{const data=await response.json() as ServiceData;detail=typeof data.error==="string"?data.error:data.error?.message||detail;}catch{}throw new Error(response.status===401?"Sign in to talk with SOZO, or refresh your integration session.":detail);}
    return response;
  };
  useEffect(()=>{fetch(`${apiBase}/api/companion/status`).then(r=>r.json() as Promise<ServiceData>).then(data=>setVision(Boolean(data.visionConfigured))).catch(()=>{});return()=>{abort.current?.abort();player.current?.pause();stream.current?.getTracks().forEach(t=>t.stop());if(audioUrl.current)URL.revokeObjectURL(audioUrl.current);};},[apiBase]);
  useEffect(()=>{if(sharedContext?.body==="moon"||sharedContext?.body==="mars")setBody(sharedContext.body);},[sharedContext?.body]);
  const stopAudio=()=>{player.current?.pause();setSpeaking(false);};
  const speak=async(text:string)=>{
    stopAudio();
    const response=await request("text-to-speech",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:text.slice(0,1800)}),signal:abort.current?.signal});
    let blob:Blob;
    if(response.headers.get("content-type")?.includes("json")) {const data=await response.json() as ServiceData;const value=data.audio||data.audios?.[0];if(!value)throw new Error("Voice returned no audio.");const bytes=Uint8Array.from(atob(value),c=>c.charCodeAt(0));blob=new Blob([bytes],{type:data.mimeType||"audio/wav"});}else blob=await response.blob();
    if(audioUrl.current)URL.revokeObjectURL(audioUrl.current);audioUrl.current=URL.createObjectURL(blob);
    const audio=new Audio(audioUrl.current);player.current=audio;audio.onended=()=>setSpeaking(false);audio.onerror=()=>{setSpeaking(false);setError("Audio playback failed. The reply remains available as text.");};await audio.play();setSpeaking(true);
  };
  const submit=async(event?:FormEvent)=>{
    event?.preventDefault();if(!draft.trim()||busy)return;
    const content=draft.trim();setDraft("");setError("");setBusy(true);stopAudio();abort.current=new AbortController();
    const history=messages.slice(-8).map(({role,content})=>({role,content}));
    setMessages(prev=>[...prev,{role:"user",content}]);
    try{const response=await request("chat",{method:"POST",headers:{"Content-Type":"application/json"},signal:abort.current.signal,body:JSON.stringify({message:content,history,retrieve:/moon|lunar|mars|martian|rover|terrain|space|mission|geolog|ice|shadow|crater|instrument|paper|evidence|route|map|study|scientific|citation/i.test(content+history.slice(-2).map(x=>x.content).join(" ")),context:{...sharedContext,body,notes:[sharedContext?.notes,notes].filter(Boolean).join("\n"),...(screenshot?{screenshot}: {})}})});const data=await response.json() as ServiceData;setMessages(prev=>[...prev,{role:"assistant",content:data.reply||"No reply was returned.",citations:data.citations,limitations:data.limitations,analysis:data.analysis}]);setScreenshot("");if(voice)try{await speak(data.reply||"No reply was returned.");}catch(e){if((e as Error).name!=="AbortError")setError(`Reply ready. ${(e as Error).message}`);}}
    catch(e){if((e as Error).name!=="AbortError"){setError((e as Error).message);setDraft(content);}}
    finally{setBusy(false);}
  };
  const record=async()=>{
    if(recording){recorder.current?.stop();setRecording(false);return;}
    setError("");try{
      if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw new Error("Microphone recording is unavailable in this browser. Type your question instead.");
      const media=await navigator.mediaDevices.getUserMedia({audio:true});stream.current=media;const chunks:Blob[]=[];const rec=new MediaRecorder(media);recorder.current=rec;rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      rec.onstop=async()=>{media.getTracks().forEach(t=>t.stop());setRecording(false);if(!chunks.length)return;setBusy(true);try{const form=new FormData();form.set("file",new Blob(chunks,{type:rec.mimeType}),rec.mimeType.includes("mp4")?"question.mp4":"question.webm");const res=await request("speech-to-text",{method:"POST",body:form});const data=await res.json() as ServiceData;setDraft(data.transcript||data.text||"");}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
      rec.start();setRecording(true);setTimeout(()=>{if(rec.state==="recording")rec.stop();},30000);
    }catch(e){setError((e as Error).message);}
  };
  const shareScreen=async()=>{
    setError("");let capture:MediaStream|undefined;
    try{if(!navigator.mediaDevices?.getDisplayMedia)throw new Error("Screen sharing is unavailable here. Add map context as text instead.");capture=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});const video=document.createElement("video");video.srcObject=capture;video.muted=true;await video.play();await new Promise<void>(resolve=>{if(video.readyState>=2)resolve();else video.onloadeddata=()=>resolve();});const canvas=document.createElement("canvas");const scale=Math.min(1,1280/video.videoWidth);canvas.width=video.videoWidth*scale;canvas.height=video.videoHeight*scale;canvas.getContext("2d")!.drawImage(video,0,0,canvas.width,canvas.height);setScreenshot(canvas.toDataURL("image/jpeg",.62));video.srcObject=null;}catch(e){if((e as Error).name!=="NotAllowedError")setError((e as Error).message);}finally{capture?.getTracks().forEach(t=>t.stop());}
  };
  return <section className={`companion-console ${embedded?"embedded":""}`} aria-label="Talk with SOZO">
    <div className="companion-avatar"><RobotCompanion assetBase={apiBase} speaking={speaking} signal={recording?"listening":busy?"thinking":speaking?"speaking":"idle"} greeting={false}/><div className="companion-live-label"><i/>{recording?"Microphone on":speaking?"Speaking":busy?"Working on your question":"Ready when you are"}</div></div>
    <div className="companion-conversation">
      <header><div><span className="premium-eyebrow">SOZO SCIENTIST</span><h2>Let’s work it out.</h2></div><button className="console-icon" onClick={()=>{setVoice(!voice);stopAudio();}} aria-label={voice?"Mute spoken replies":"Enable spoken replies"} aria-pressed={voice}>{voice?<Volume2 size={18}/>:<VolumeX size={18}/>}</button></header>
      <div className="companion-messages" aria-live="polite" aria-busy={busy}>
        {!messages.length&&<div className="companion-welcome"><p>Ask about a world. Compare the evidence. Explore a route.</p><div className="console-prompts">{["What evidence supports lunar south-pole ice?","What hazards matter for a rover at Jezero?"].map(text=><button key={text} onClick={()=>setDraft(text)}>{text}</button>)}</div></div>}
        {messages.map((message,i)=><article className={`companion-message ${message.role}`} key={i}><strong>{message.role==="user"?"You":"SOZO"}</strong><ScientificText text={message.content} sources={message.citations?.filter((c): c is {url:string;title:string} => Boolean(c.url&&c.title))}/>{message.citations?.map((c,j)=>c.url&&/^https:\/\//.test(c.url)?<a href={c.url} target="_blank" rel="noreferrer" key={j}>[{j+1}] {c.title||`Source ${j+1}`} ↗</a>:null)}{message.analysis?.distanceKm!==undefined&&<small>Computed polyline length: {message.analysis.distanceKm.toFixed(3)} km · spherical approximation</small>}{message.limitations?.some(x=>/unsupported citation|unavailable/.test(x))&&<p className="console-error">{message.limitations.filter(x=>/unsupported citation|unavailable/.test(x)).join(" ")}</p>}{message.role==="assistant"&&<button className="text-button" disabled={busy} onClick={()=>{abort.current=new AbortController();void speak(message.content).catch(e=>setError(e.message));}}>Read aloud</button>}</article>)}
        {busy&&<p role="status" className="companion-working"><Loader2 size={15} className="spin"/> Waiting for the service…</p>}
      </div>
      <details className="companion-context"><summary>Map & exploration context {sharedContext&&Object.keys(sharedContext).length?"· connected":""}</summary><label>World<select value={body} onChange={e=>setBody(e.target.value)}><option value="moon">Moon</option><option value="mars">Mars</option></select></label><label>Observations, route data or map labels<textarea value={notes} onChange={e=>setNotes(e.target.value)} maxLength={6000} placeholder="Add the data, units and source you want SOZO to consider."/></label><p>Shared context is sent with your next question. Terrain and routes need source data; imagery alone cannot establish a safe route.</p>{vision&&<button type="button" onClick={()=>void shareScreen()}><MonitorUp size={15}/> Choose a screen snapshot</button>}{screenshot&&<div className="shared-screen-preview"><img src={screenshot} alt="Screen snapshot selected for the next question"/><button aria-label="Remove screen snapshot" onClick={()=>setScreenshot("")}><X size={16}/></button><small>This snapshot will be sent to Sarvam with your next question. Screen sharing has stopped.</small></div>}</details>
      {error&&<p className="console-error" role="alert">{error}</p>}
      <form className="companion-composer" onSubmit={submit}><textarea aria-label="Message SOZO" value={draft} onChange={e=>setDraft(e.target.value)} maxLength={2000} placeholder="Ask SOZO…" onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void submit();}}}/><div><button type="button" className={`console-icon ${recording?"recording":""}`} disabled={busy} onClick={()=>void record()} aria-label={recording?"Stop recording and transcribe":"Record a question"}>{recording?<MicOff size={18}/>:<Mic size={18}/>}</button>{busy||speaking?<button className="console-icon" type="button" aria-label="Stop response and audio" onClick={()=>{abort.current?.abort();stopAudio();setBusy(false);}}><Square size={17}/></button>:null}<button type="submit" className="console-send" disabled={busy||!draft.trim()} aria-label="Send message"><Send size={17}/></button></div></form>
      <small className="companion-disclosure">Sarvam voice & AI · Source links support verification. Prototype assistance; validate plans against original mission data.</small>
    </div>
  </section>;
}
