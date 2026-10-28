"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
} from "lucide-react";
import PlanetScene from "./planet-scene";
function FacebookMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07Z"
      />
    </svg>
  );
}
function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.86c2.26-2.08 3.58-5.15 3.58-8.65Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.86-3a7.2 7.2 0 0 1-10.71-3.78H1.36v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.36 14.31a7.2 7.2 0 0 1 0-4.62v-3.1H1.36a12 12 0 0 0 0 10.82l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.6 4.58 1.8l3.43-3.43A11.97 11.97 0 0 0 1.36 6.59l4 3.1A7.15 7.15 0 0 1 12 4.75Z" />
    </svg>
  );
}

type GoogleIdentity = {
  accounts: {
    id: {
      initialize(options: Record<string, unknown>): void;
      renderButton(element: HTMLElement, options: Record<string, unknown>): void;
    };
  };
};

// Google's button on SOZO's domain, so the sign-in popup shows this site
// rather than the Supabase project address. Falls back to the redirect flow
// when Google's script cannot load.
function GoogleSignIn({
  clientId,
  fallbackHref,
  onError,
}: {
  clientId: string;
  fallbackHref?: string;
  onError: (message: string) => void;
}) {
  const slot = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const nonce = [...crypto.getRandomValues(new Uint8Array(32))]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    const signIn = async ({ credential }: { credential?: string }) => {
      try {
        const returnTo = new URLSearchParams(window.location.search).get("returnTo") || "/dashboard";
        const response = await fetch("/api/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credential, nonce, returnTo }),
        });
        const data = (await response.json()) as { error?: { message: string }; redirect?: string };
        if (!response.ok) throw new Error(data.error?.message || "Google sign-in failed.");
        window.location.assign(data.redirect || "/dashboard");
      } catch (error) {
        onError((error as Error).message);
      }
    };
    const render = async () => {
      const google = (window as unknown as { google?: GoogleIdentity }).google;
      if (cancelled || !google || !slot.current) return;
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(nonce));
      google.accounts.id.initialize({
        client_id: clientId,
        callback: signIn,
        nonce: [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join(""),
        ux_mode: "popup",
        itp_support: true,
      });
      google.accounts.id.renderButton(slot.current, {
        theme: "filled_black",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        width: Math.min(400, slot.current.offsetWidth || 320),
      });
    };
    const existing = document.querySelector<HTMLScriptElement>("script[data-google-identity]");
    if ((window as unknown as { google?: GoogleIdentity }).google) void render();
    else {
      const script = existing ?? document.createElement("script");
      script.addEventListener("load", () => void render());
      script.addEventListener("error", () => setFailed(true));
      if (!existing) {
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.dataset.googleIdentity = "";
        document.head.appendChild(script);
      }
    }
    return () => {
      cancelled = true;
    };
  }, [clientId, onError]);
  if (failed && fallbackHref)
    return (
      <a className="space-button secondary login-google" href={fallbackHref}>
        <GoogleMark />
        Continue with Google
      </a>
    );
  return <div ref={slot} className="login-google-slot" />;
}

export default function WorkspaceLogin({
  chatGPT = false,
  googleHref,
  googleClientId,
  facebookHref,
  initialError,
}: {
  chatGPT?: boolean;
  googleHref?: string;
  googleClientId?: string;
  facebookHref?: string;
  initialError?: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState(initialError ?? "");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const returnTo =
        new URLSearchParams(window.location.search).get("returnTo") ||
        "/dashboard";
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnTo }),
      });
      const d = (await r.json()) as {
        error?: { message: string };
        redirect?: string;
      };
      if (!r.ok) throw new Error(d.error?.message || "Sign-in failed.");
      window.location.assign(d.redirect || "/dashboard");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <main className="space-login">
      <a className="space-brand" href="/" aria-label="SOZO home">
        <img src="/sozo-mark.svg" alt="" />
        <span>
          sozo<span className="brand-dot">.</span>
        </span>
      </a>
      <div className="login-visual">
        <PlanetScene duo />
        <div className="login-visual-copy">
          <span className="space-eyebrow">
            YOUR NEXT DISCOVERY IS OUT THERE
          </span>
          <h2>
            Some questions
            <br />
            take us further.
          </h2>
          <p>The Moon. Mars. And the evidence in between.</p>
        </div>
      </div>
      <section className="login-form-panel">
        <a className="back-link" href="/">
          <ArrowLeft size={14} />
          Back to the frontier
        </a>
        <div className="login-form-heading">
          <span className="space-eyebrow">
            <span />
            MISSION CONTROL
          </span>
          <h1>Welcome aboard.</h1>
          <p>A workspace for your next great question.</p>
        </div>
        <form onSubmit={submit}>
          <label htmlFor="login-email">Email address</label>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            placeholder="you@organization.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label htmlFor="login-password">Password</label>
          <div className="password-input">
            <input
              id="login-password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              aria-label={show ? "Hide password" : "Show password"}
              onClick={() => setShow(!show)}
            >
              {show ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="space-button primary"
            disabled={busy}
          >
            {busy ? (
              <>
                <Loader2 size={16} className="spin" />
                Signing in…
              </>
            ) : (
              <>
                Enter your workspace
                <ArrowUpRight size={17} />
              </>
            )}
          </button>
        </form>
        {(chatGPT || googleHref || googleClientId || facebookHref) && (
          <div className="login-divider">
            <span />
            or
            <span />
          </div>
        )}
        {googleClientId ? (
          <GoogleSignIn clientId={googleClientId} fallbackHref={googleHref} onError={setError} />
        ) : (
          googleHref && (
            <a className="space-button secondary login-google" href={googleHref}>
              <GoogleMark />
              Continue with Google
            </a>
          )
        )}
        {facebookHref && (
          <a className="space-button secondary login-facebook" href={facebookHref}>
            <FacebookMark />
            Continue with Facebook
          </a>
        )}
        {chatGPT && (
          <a
            className="space-button secondary"
            href="/signin-with-chatgpt?return_to=%2Fdashboard"
            target="_top"
          >
            Continue with ChatGPT
            <ArrowUpRight size={15} />
          </a>
        )}
        <p className="login-private">
          <LockKeyhole size={12} />
          Your research. Your private workspace.
        </p>
        <span className="login-footer">
          SCIENTIFIC OBSERVATION ZONE OPERATOR
        </span>
      </section>
    </main>
  );
}
