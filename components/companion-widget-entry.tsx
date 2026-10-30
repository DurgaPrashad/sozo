import React from "react";
import { createRoot, type Root } from "react-dom/client";
import CompanionConsole, { type ConsoleCommands } from "./companion-console";
import type { ScanTarget } from "./page-scan";
import styles from "../app/companion.css?inline";
import robotStyles from "./robot-widget.css?inline";
class SozoCompanion extends HTMLElement {
  private root?: Root;
  private context: Record<string,unknown>={};
  private token="";
  private expires=0;
  private controller?:AbortController;
  private apiBase="";
  private targets=new Map<string,ScanTarget>();
  private commands:{current:ConsoleCommands|null}={current:null};
  connectedCallback(){
    if(this.root)return;
    const shadow=this.shadowRoot||this.attachShadow({mode:"open"});
    const style=document.createElement("style");style.textContent=styles.replace(/@font-face\{[^}]*\}/g, "")+robotStyles;shadow.appendChild(style);
    const node=document.createElement("div");shadow.appendChild(node);this.root=createRoot(node);
    const raw=this.getAttribute("api-base")||new URL((document.currentScript as HTMLScriptElement|null)?.src||location.href).origin;
    try{const url=new URL(raw,location.href);if(url.protocol!=="https:"&&!(url.protocol==="http:"&&["localhost","127.0.0.1"].includes(url.hostname)))throw Error();this.apiBase=url.origin;this.render();}catch{node.textContent="SOZO needs a valid HTTPS API base URL (or localhost for development).";}
  }
  disconnectedCallback(){this.root?.unmount();this.root=undefined;this.token="";this.controller?.abort();this.shadowRoot?.replaceChildren();}
  setContext(value:Record<string,unknown>){this.context=value;this.render();}
  clearContext(){this.context={};this.render();}
  // Name a page area so "scan the route" flies SOZO there; "default" is used when no area is named.
  registerTarget(name:string,element:Element,describe?:ScanTarget["describe"]){
    if(!/^[\w -]{1,40}$/.test(name)||!(element instanceof Element))throw Error("registerTarget needs a short name (letters, digits, spaces) and an element.");
    this.targets.set(name.toLowerCase(),{element,label:name,describe});
  }
  unregisterTarget(name:string){this.targets.delete(name.toLowerCase());}
  // Flies SOZO to a registered name or an element, scans it, and asks about it.
  scan(target?:string|Element,question?:string){
    if(!this.commands.current)return Promise.reject(Error("SOZO is not ready yet."));
    return this.commands.current.scan(target,question);
  }
  private getToken=async()=>{
    if(this.token&&this.expires>Date.now()+30000)return this.token;
    const key=this.getAttribute("publishable-key"),path=this.getAttribute("session-endpoint");
    this.controller=new AbortController();
    let response:Response;
    if(key){
      // Static sites: the public key works only from the origins listed for it.
      if(!/^sozo_pk_[a-f0-9]{32}$/.test(key))throw Error("The publishable-key attribute is not a SOZO publishable key.");
      response=await fetch(`${this.apiBase}/api/companion/sessions`,{method:"POST",credentials:"omit",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:"{}",signal:this.controller.signal});
      if(!response.ok){let message="SOZO could not start a session for this website.";try{message=((await response.json()) as {error?:{message?:string}}).error?.message||message;}catch{/* keep the generic message */}throw Error(message);}
    }else{
      if(!path)throw Error("Add a publishable-key, or a host-backend session-endpoint, to connect this companion.");
      const url=new URL(path,location.href);if(url.origin!==location.origin)throw Error("The session endpoint must be on your own platform's origin.");
      response=await fetch(url,{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:"{}",signal:this.controller.signal});
      if(!response.ok)throw Error("Your platform could not issue a SOZO companion session. Check the host backend configuration.");
    }
    const data=await response.json() as {token?:string;expiresAt:string};if(typeof data.token!=="string"||!data.token.startsWith("sozo_widget_"))throw Error("The host returned an invalid companion session.");
    this.expires=new Date(data.expiresAt).getTime();if(!Number.isFinite(this.expires)||this.expires<=Date.now())throw Error("The host returned an expired session.");this.token=data.token;return this.token;
  };
  private render(){this.root?.render(<CompanionConsole embedded apiBase={this.apiBase} getToken={this.getToken} sharedContext={this.context} scanTargets={this.targets} commands={this.commands}/>);}
}
if(!customElements.get("sozo-companion"))customElements.define("sozo-companion",SozoCompanion);
