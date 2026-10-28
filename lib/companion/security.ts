import { createSessionToken, hashSecret } from "../auth/crypto";

export type WidgetSession = { id: string; ownerId: string; allowedOrigin: string; expiresAt: string };
export interface CompanionStore {
  issue(ownerId: string, allowedOrigin: string): Promise<WidgetSession & { token: string }>;
  resolve(token: string): Promise<WidgetSession | null>;
  rateLimit(ownerId: string, bucket: string, maximum: number, windowMs: number): Promise<boolean>;
  revoke(ownerId: string, id: string): Promise<void>;
}
export function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/") return null;
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) return null;
    return url.origin;
  } catch { return null; }
}
export function permitsWidget(session: WidgetSession | null, origin: string | null, now = Date.now()) {
  return Boolean(session && origin && origin === session.allowedOrigin && Date.parse(session.expiresAt) > now);
}
export class D1CompanionStore implements CompanionStore {
  private prepared: Promise<void> | null = null;
  constructor(private db: D1Database) {}
  async prepare() {
    if (!this.prepared) this.prepared = (async () => {
      await this.db.prepare("CREATE TABLE IF NOT EXISTS sozo_widget_sessions (id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, owner_id TEXT NOT NULL, allowed_origin TEXT NOT NULL, expires_at TEXT NOT NULL)").run();
      await this.db.prepare("CREATE INDEX IF NOT EXISTS sozo_widget_expiry ON sozo_widget_sessions(expires_at)").run();
      await this.db.prepare("CREATE TABLE IF NOT EXISTS sozo_companion_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at TEXT NOT NULL)").run();
    })().catch(error => { this.prepared = null; throw error; });
    return this.prepared;
  }
  async issue(ownerId: string, allowedOrigin: string) {
    await this.prepare();
    const token = `sozo_widget_${createSessionToken()}`;
    const session = { id: crypto.randomUUID(), ownerId, allowedOrigin, expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() };
    await this.db.prepare("INSERT INTO sozo_widget_sessions (id, token_hash, owner_id, allowed_origin, expires_at) VALUES (?, ?, ?, ?, ?)").bind(session.id, await hashSecret(token), ownerId, allowedOrigin, session.expiresAt).run();
    return { ...session, token };
  }
  async resolve(token: string) {
    await this.prepare();
    const row = await this.db.prepare("SELECT id, owner_id, allowed_origin, expires_at FROM sozo_widget_sessions WHERE token_hash = ? AND expires_at > ?").bind(await hashSecret(token), new Date().toISOString()).first<{ id: string; owner_id: string; allowed_origin: string; expires_at: string }>();
    return row ? { id: row.id, ownerId: row.owner_id, allowedOrigin: row.allowed_origin, expiresAt: row.expires_at } : null;
  }
  async revoke(ownerId: string, id: string) { await this.prepare(); await this.db.prepare("DELETE FROM sozo_widget_sessions WHERE owner_id = ? AND id = ?").bind(ownerId, id).run(); }
  async rateLimit(ownerId: string, kind: string, maximum: number, windowMs: number) {
    await this.prepare();
    const bucket = Math.floor(Date.now() / windowMs), expires = new Date((bucket + 1) * windowMs).toISOString();
    const key = await hashSecret(`${ownerId}|${kind}|${bucket}`);
    const row = await this.db.prepare("INSERT INTO sozo_companion_limits (key, count, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count").bind(key, expires).first<{ count: number }>();
    // Bounded, owner-wide usage counters, with opportunistic expiry cleanup.
    await this.db.batch([this.db.prepare("DELETE FROM sozo_companion_limits WHERE expires_at < ?").bind(new Date().toISOString()), this.db.prepare("DELETE FROM sozo_widget_sessions WHERE expires_at < ?").bind(new Date().toISOString())]);
    return Boolean(row && row.count <= maximum);
  }
}
