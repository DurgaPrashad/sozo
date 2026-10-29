// Classifies a database failure into a safe category and hint. Raw driver
// messages (which can include hosts and user names) are never returned.
export type DatabaseCheck = {
  state:
    | "ok"
    | "not_configured"
    | "invalid_url"
    | "host_not_found"
    | "network_unreachable"
    | "unreachable"
    | "password_rejected"
    | "pooler_user_not_found"
    | "database_missing"
    | "query_failed";
  hint?: string;
  code?: string;
};

const POOLER_HINT =
  "Use Supabase → Connect → Transaction pooler URI (port 6543) as DATABASE_URL, then redeploy.";

export function classifyDatabaseError(error: unknown): DatabaseCheck {
  const value = (error ?? {}) as { code?: unknown; message?: unknown; cause?: unknown };
  const cause = (value.cause ?? {}) as { code?: unknown; message?: unknown };
  const code = String(value.code ?? cause.code ?? "");
  const message = `${value.message ?? ""} ${cause.message ?? ""}`;
  const safeCode = /^[A-Z0-9_]{2,40}$/i.test(code) ? code : undefined;
  if (["ENOTFOUND", "EAI_AGAIN"].includes(code))
    return { state: "host_not_found", code, hint: `The database host does not resolve. ${POOLER_HINT}` };
  if (["ENETUNREACH", "EHOSTUNREACH", "EADDRNOTAVAIL"].includes(code))
    return {
      state: "network_unreachable",
      code,
      hint: `Vercel cannot reach this host; the direct db.<ref>.supabase.co host is IPv6-only. ${POOLER_HINT}`,
    };
  if (code === "28P01" || /password authentication failed/i.test(message))
    return {
      state: "password_rejected",
      code: "28P01",
      hint: "The database password was rejected. Use the current password and URL-encode special characters (@ → %40, # → %23, / → %2F).",
    };
  if (/tenant or user not found/i.test(message))
    return {
      state: "pooler_user_not_found",
      hint: "For the Supabase pooler the user name must be postgres.<project-ref>, exactly as in the Transaction pooler URI.",
    };
  if (code === "3D000") return { state: "database_missing", code, hint: "The database name in the URL does not exist; use /postgres." };
  if (["ECONNREFUSED", "ETIMEDOUT", "CONNECT_TIMEOUT", "ECONNRESET"].includes(code) || /timed? ?out/i.test(message))
    return { state: "unreachable", code: safeCode, hint: `The database did not answer. ${POOLER_HINT}` };
  return { state: "query_failed", code: safeCode };
}

export async function checkDatabase(db: D1Database | undefined): Promise<DatabaseCheck> {
  if (!db) return { state: "not_configured" };
  try {
    await Promise.race([
      db.prepare("SELECT 1 AS ok").first(),
      new Promise((_, reject) =>
        setTimeout(() => reject(Object.assign(new Error("timed out"), { code: "ETIMEDOUT" })), 9000),
      ),
    ]);
    return { state: "ok" };
  } catch (error) {
    return classifyDatabaseError(error);
  }
}
