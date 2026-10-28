import type { Client, InStatement, InValue, ResultSet } from "@libsql/client/web";

// A D1-compatible facade over libSQL (Turso), so the same SQL and the
// drizzle-orm/d1 driver run on hosts without a Cloudflare D1 binding.
type Row = Record<string, unknown>;

function rows(result: ResultSet): Row[] {
  return result.rows.map((row) =>
    Object.fromEntries(result.columns.map((column, index) => [column, row[index]])),
  );
}

function meta(result: ResultSet, started: number) {
  return {
    duration: Date.now() - started,
    changes: result.rowsAffected,
    last_row_id: Number(result.lastInsertRowid ?? 0),
    changed_db: result.rowsAffected > 0,
    size_after: 0,
    rows_read: result.rows.length,
    rows_written: result.rowsAffected,
  };
}

function toResult(result: ResultSet, started: number) {
  return { success: true as const, results: rows(result), meta: meta(result, started) };
}

class LibsqlStatement {
  constructor(
    private client: Client,
    readonly sql: string,
    readonly args: InValue[] = [],
  ) {}

  bind(...args: unknown[]) {
    return new LibsqlStatement(this.client, this.sql, args as InValue[]);
  }

  statement(): InStatement {
    return { sql: this.sql, args: this.args };
  }

  async all() {
    const started = Date.now();
    return toResult(await this.client.execute(this.statement()), started);
  }

  async run() {
    return this.all();
  }

  async first(column?: string) {
    const [row] = rows(await this.client.execute(this.statement()));
    if (!row) return null;
    return column ? (row[column] ?? null) : row;
  }

  async raw(options?: { columnNames?: boolean }) {
    const result = await this.client.execute(this.statement());
    const values = result.rows.map((row) => Array.from(row));
    return options?.columnNames ? [result.columns, ...values] : values;
  }
}

export function libsqlD1(client: Client): D1Database {
  const database = {
    prepare: (sql: string) => new LibsqlStatement(client, sql),
    async batch(statements: LibsqlStatement[]) {
      const started = Date.now();
      const results = await client.batch(
        statements.map((statement) => statement.statement()),
        "write",
      );
      return results.map((result) => toResult(result, started));
    },
    async exec(sql: string) {
      const started = Date.now();
      await client.executeMultiple(sql);
      return { count: sql.split(";").filter((part) => part.trim()).length, duration: Date.now() - started };
    },
  };
  return database as unknown as D1Database;
}
