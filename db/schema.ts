import { sqliteTable, text, index, uniqueIndex } from "drizzle-orm/sqlite-core";
export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    color: text("color").notNull().default("lime"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("projects_owner").on(t.ownerId)],
);
export const runs = sqliteTable(
  "research_runs",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    projectId: text("project_id"),
    question: text("question").notNull(),
    domain: text("domain").notNull(),
    status: text("status").notNull(),
    mode: text("mode").notNull(),
    sources: text("sources", { mode: "json" }).notNull().$type<string[]>(),
    result: text("result", { mode: "json" }).$type<
      import("../lib/science/types").ResearchResult
    >(),
    progress: text("progress", { mode: "json" })
      .notNull()
      .$type<{ label: string; at: string }[]>(),
    error: text("error"),
    createdAt: text("created_at").notNull(),
    completedAt: text("completed_at"),
    idempotencyKey: text("idempotency_key"),
  },
  (t) => [
    index("runs_owner_created").on(t.ownerId, t.createdAt),
    uniqueIndex("runs_idempotency").on(t.ownerId, t.idempotencyKey),
  ],
);
export const notes = sqliteTable(
  "notebook",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    sourceUrl: text("source_url"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("notes_owner").on(t.ownerId)],
);
export const integrations = sqliteTable(
  "integrations",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    type: text("type").notNull(),
    url: text("url").notNull(),
    capabilities: text("capabilities", { mode: "json" })
      .notNull()
      .$type<import("../lib/science/connectors").Capability[]>(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("integrations_owner").on(t.ownerId)],
);
export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    hash: text("hash").notNull().unique(),
    prefix: text("prefix").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("keys_owner").on(t.ownerId)],
);
export const audit = sqliteTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    action: text("action").notNull(),
    resourceId: text("resource_id"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("audit_owner_created").on(t.ownerId, t.createdAt)],
);
