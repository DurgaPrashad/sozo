"use client";
import { useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
} from "lucide-react";
import PlanetScene from "./planet-scene";
export default function WorkspaceLogin({
  chatGPT = false,
}: {
  chatGPT?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
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
        {chatGPT && (
          <>
            <div className="login-divider">
              <span />
              or
              <span />
            </div>
            <a
              className="space-button secondary"
              href="/signin-with-chatgpt?return_to=%2Fdashboard"
              target="_top"
            >
              Continue with ChatGPT
              <ArrowUpRight size={15} />
            </a>
          </>
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
