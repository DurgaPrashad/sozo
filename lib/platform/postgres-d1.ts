// A D1-compatible facade over PostgreSQL (Supabase), so the same SQLite-dialect
// SQL from drizzle-orm/d1 and the raw statements in lib/ run unchanged.
//
// SOZO's tables live in their own `sozo` schema, which Supabase does not expose
// through its public Data API. Supabase's transaction pooler cannot keep a
// session search_path, so table names are schema-qualified here instead.
export const POSTGRES_SCHEMA = "sozo";

// drizzle-orm quotes its table names; the raw statements in lib/ do not.
const QUOTED_TABLES = new Set([
  "projects", "research_runs", "notebook", "integrations", "api_keys",
  "audit_events", "workspace_sessions", "login_limits",
]);
const BARE_TABLES = new Set(["sozo_widget_sessions", "sozo_companion_limits", "sozo_publishable_keys", "sozo_article_cache"]);

export type PostgresResult = { columns: string[]; rows: unknown[][]; count: number };
export type PostgresRunner = {
  query(text: string, params: unknown[]): Promise<PostgresResult>;
  transaction<T>(work: (query: PostgresRunner["query"]) => Promise<T>): Promise<T>;
};

// `?` placeholders become `$n`, known tables gain the schema, and quoted
// strings and identifiers are copied untouched.
export function toPostgres(statement: string) {
  // PostgreSQL wants bare column names as an ON CONFLICT target.
  const sql = statement.replace(/on conflict \(([^)]*)\)/gi, (clause, columns: string) =>
    clause.replace(columns, columns.replace(/"[A-Za-z0-9_]+"\./g, "")),
  );
  let out = "", index = 0, i = 0;
  const schema = `"${POSTGRES_SCHEMA}".`;
  while (i < sql.length) {
    const char = sql[i];
    if (char === "'") {
      const end = sql.indexOf("'", i + 1);
      const stop = end === -1 ? sql.length : end + 1;
      out += sql.slice(i, stop);
      i = stop;
    } else if (char === '"') {
      const end = sql.indexOf('"', i + 1);
      const stop = end === -1 ? sql.length : end + 1;
      const name = sql.slice(i + 1, stop - 1);
      out += QUOTED_TABLES.has(name) && !out.endsWith(schema) ? schema + sql.slice(i, stop) : sql.slice(i, stop);
      i = stop;
    } else if (char === "?") {
      out += `$${++index}`;
      i++;
    } else if (/[A-Za-z_]/.test(char)) {
      let stop = i + 1;
      while (stop < sql.length && /[A-Za-z0-9_]/.test(sql[stop])) stop++;
      const word = sql.slice(i, stop);
      const qualified = out.endsWith(".") || sql[stop] === ".";
      out += BARE_TABLES.has(word) && !qualified ? `${POSTGRES_SCHEMA}.${word}` : word;
      i = stop;
    } else {
      out += char;
      i++;
    }
  }
  return out;
}

const parameters = (args: unknown[]) =>
  args.map((value) => (value === undefined ? null : typeof value === "boolean" ? Number(value) : value));

function objects(result: PostgresResult) {
  return result.rows.map((row) => Object.fromEntries(result.columns.map((column, i) => [column, row[i]])));
}

function toResult(result: PostgresResult, started: number) {
  return {
    success: true as const,
    results: objects(result),
    meta: {
      duration: Date.now() - started,
      changes: result.count,
      last_row_id: 0,
      changed_db: result.count > 0,
      size_after: 0,
      rows_read: result.rows.length,
      rows_written: result.count,
    },
  };
}

class PostgresStatement {
  constructor(
    private runner: PostgresRunner,
    readonly sql: string,
    readonly args: unknown[] = [],
  ) {}

  bind(...args: unknown[]) {
    return new PostgresStatement(this.runner, this.sql, args);
  }

  execute(query = this.runner.query) {
    return query(toPostgres(this.sql), parameters(this.args));
  }

  async all() {
    const started = Date.now();
    return toResult(await this.execute(), started);
  }

  async run() {
    return this.all();
  }

  async first(column?: string) {
    const [row] = objects(await this.execute());
    if (!row) return null;
    return column ? (row[column] ?? null) : row;
  }

  async raw(options?: { columnNames?: boolean }) {
    const result = await this.execute();
    return options?.columnNames ? [result.columns, ...result.rows] : result.rows;
  }
}

export function postgresD1(runner: PostgresRunner): D1Database {
  const database = {
    prepare: (sql: string) => new PostgresStatement(runner, sql),
    async batch(statements: PostgresStatement[]) {
      const started = Date.now();
      return runner.transaction(async (query) => {
        const results = [];
        for (const statement of statements) results.push(toResult(await statement.execute(query), started));
        return results;
      });
    },
    async exec(sql: string) {
      const started = Date.now();
      const statements = sql.split(";").map((part) => part.trim()).filter(Boolean);
      await runner.transaction(async (query) => {
        for (const statement of statements) await query(toPostgres(statement), []);
      });
      return { count: statements.length, duration: Date.now() - started };
    },
  };
  return database as unknown as D1Database;
}
