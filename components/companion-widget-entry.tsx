import React from "react";
import { createRoot, type Root } from "react-dom/client";
import CompanionConsole from "./companion-console";
import styles from "../app/companion.css?inline";
import robotStyles from "./robot-widget.css?inline";
class SozoCompanion extends HTMLElement {
  private root?: Root;
  private context: Record<string,unknown>={};
  private token="";
  private expires=0;
  private controller?:AbortController;
  private apiBase="";
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
  private getToken=async()=>{
    if(this.token&&this.expires>Date.now()+30000)return this.token;
    const path=this.getAttribute("session-endpoint");if(!path)throw Error("Configure a host-backend session endpoint to connect this companion.");
    const url=new URL(path,location.href);if(url.origin!==location.origin)throw Error("The session endpoint must be on your own platform's origin.");
    this.controller=new AbortController();
    const response=await fetch(url,{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:"{}",signal:this.controller.signal});
    if(!response.ok)throw Error("Your platform could not issue a SOZO companion session. Check the host backend configuration.");
    const data=await response.json() as {token?:string;expiresAt:string};if(typeof data.token!=="string"||!data.token.startsWith("sozo_widget_"))throw Error("The host returned an invalid companion session.");
    this.expires=new Date(data.expiresAt).getTime();if(!Number.isFinite(this.expires)||this.expires<=Date.now())throw Error("The host returned an expired session.");this.token=data.token;return this.token;
  };
  private render(){this.root?.render(<CompanionConsole embedded apiBase={this.apiBase} getToken={this.getToken} sharedContext={this.context}/>);}
}
if(!customElements.get("sozo-companion"))customElements.define("sozo-companion",SozoCompanion);
