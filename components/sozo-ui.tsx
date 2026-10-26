"use client";
import { useState, useEffect, useRef, type ReactNode } from "react";
import {
  X,
  ArrowUpRight,
  ChevronDown,
  Bookmark,
  Check,
  Loader2,
  Search,
} from "lucide-react";
import type { Source } from "../lib/science/types";
export function Status({ status }: { status: string }) {
  return (
    <span className={`status ${status}`}>
      {status === "running" ? (
        <Loader2 size={12} className="spin" />
      ) : (
        <span className="status-dot" />
      )}
      {(
        {
          completed: "Completed",
          running: "In progress",
          partial: "Partial results",
          failed: "Failed",
          cancelled: "Cancelled",
        } as Record<string, string>
      )[status] || status}
    </span>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="modal-title"
    >
      <div className="modal-head">
        <h2 id="modal-title">{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">
          <span />
          {eyebrow}
        </div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="page-heading-actions">{children}</div>
    </div>
  );
}
export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="search-field">
      <Search size={15} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      <kbd>⌘ K</kbd>
    </label>
  );
}
export function EmptyState({
  icon,
  title,
  description,
  action,
  onAction,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-art">
        <span />
        {icon}
        <i>✳</i>
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      <button className="primary-button" onClick={onAction}>
        {action}
        <ArrowUpRight size={15} />
      </button>
    </div>
  );
}
export function SourceCard({
  source: s,
  onSave,
  saved,
}: {
  source: Source;
  onSave: (s: Source) => void;
  saved: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <article className="source-card">
      <div className="source-top">
        <span className="source-number">{s.id}</span>
        <span>{s.provider}</span>
        <span className="tiny-dot" />
        <span>{s.type}</span>
        <span className="source-year">{s.year || "Date unavailable"}</span>
      </div>
      <a className="source-title" href={s.url} target="_blank" rel="noreferrer">
        {s.title}
        <ArrowUpRight size={17} />
      </a>
      <p className="source-authors">{s.authors}</p>
      {s.journal && <p className="source-journal">{s.journal}</p>}
      {s.abstract && (
        <p className={`source-abstract ${expanded ? "expanded" : ""}`}>
          {s.abstract}
        </p>
      )}
      <div className="source-bottom">
        {s.abstract ? (
          <button
            className="text-button"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Less detail" : "Read abstract"}
            <ChevronDown size={13} />
          </button>
        ) : (
          <span className="muted small">
            Metadata only · no abstract supplied
          </span>
        )}
        <button
          className={`text-button ${saved ? "saved" : ""}`}
          onClick={() => onSave(s)}
          disabled={saved}
        >
          {saved ? <Check size={14} /> : <Bookmark size={14} />}
          {saved ? "Saved" : "Save source"}
        </button>
      </div>
    </article>
  );
}
export function OrbitalArt() {
  return (
    <div className="orbital-art" aria-hidden="true">
      <svg viewBox="0 0 340 215">
        <defs>
          <radialGradient id="planet">
            <stop stopColor="#f5f6df" />
            <stop offset=".65" stopColor="#dfdfb9" />
            <stop offset="1" stopColor="#b9bc92" />
          </radialGradient>
          <pattern
            id="planet-lines"
            width="5"
            height="5"
            patternUnits="userSpaceOnUse"
          >
            <path d="M0 1H5" stroke="#899268" strokeWidth=".45" />
          </pattern>
          <clipPath id="planet-clip">
            <circle cx="179" cy="101" r="53" />
          </clipPath>
        </defs>
        <g fill="none" stroke="#d8dbcf" strokeWidth=".8">
          <ellipse
            cx="179"
            cy="101"
            rx="143"
            ry="62"
            transform="rotate(-23 179 101)"
          />
          <ellipse
            cx="179"
            cy="101"
            rx="122"
            ry="83"
            transform="rotate(-23 179 101)"
          />
          <ellipse
            cx="179"
            cy="101"
            rx="100"
            ry="101"
            transform="rotate(-23 179 101)"
          />
          <path d="M25 176L319 30M19 101H332" strokeDasharray="2 5" />
        </g>
        <circle cx="179" cy="101" r="53" fill="url(#planet)" />
        <g clipPath="url(#planet-clip)">
          <rect
            x="120"
            y="42"
            width="120"
            height="120"
            fill="url(#planet-lines)"
            transform="rotate(-23 179 101)"
          />
          <ellipse
            cx="148"
            cy="107"
            rx="58"
            ry="66"
            fill="none"
            stroke="#f9f9ee"
          />
        </g>
        <ellipse
          cx="179"
          cy="101"
          rx="143"
          ry="62"
          transform="rotate(-23 179 101)"
          fill="none"
          stroke="#8e9677"
          strokeWidth=".9"
          strokeDasharray="200 650"
        />
        <circle
          cx="296"
          cy="44"
          r="7"
          fill="#c3ed53"
          stroke="#f8f9f4"
          strokeWidth="4"
        />
        <circle cx="72" cy="157" r="4" fill="#666f53" />
        <path d="M275 151v16m-8-8h16M62 33v10m-5-5h10" stroke="#9aab70" />
        <text x="238" y="201" fontSize="7" letterSpacing="1.3" fill="#83877b">
          ALWAYS EXPLORING
        </text>
        <text x="11" y="24" fontSize="7" letterSpacing="1.3" fill="#83877b">
          POSSIBILITY / ∞
        </text>
      </svg>
    </div>
  );
}
