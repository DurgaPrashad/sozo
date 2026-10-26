import { z } from "zod";
export type Capability = {
  id: string;
  name: string;
  description: string;
  method: "GET";
  path: string;
  parameters: {
    name: string;
    in: string;
    required: boolean;
    schema: Record<string, unknown>;
  }[];
  version: string;
  classification: "read";
};
export interface ScientificConnector {
  name: string;
  version: string;
  discover(): Promise<Capability[]>;
  health(): Promise<{ ok: boolean; checkedAt: string }>;
  execute(
    capabilityId: string,
    input: Record<string, unknown>,
  ): Promise<unknown>;
}
export const DEFAULT_ALLOWED_HOSTS = ["api.crossref.org", "www.ebi.ac.uk"];
export function allowedURL(
  value: string,
  allowedHosts: string[] = DEFAULT_ALLOWED_HOSTS,
): URL {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    url.hash ||
    !allowedHosts.includes(url.hostname.toLowerCase()) ||
    !url.hostname.includes(".") ||
    /(?:^|\.)(?:localhost|local|internal)$/.test(url.hostname) ||
    /^\d+\./.test(url.hostname) ||
    url.hostname.includes(":")
  )
    throw new Error("Use an HTTPS endpoint on an administrator-approved host.");
  return url;
}
const specSchema = z.object({
  openapi: z.string().regex(/^3\./),
  info: z.object({ title: z.string().max(200), version: z.string().max(50) }),
  paths: z.record(z.string(), z.record(z.string(), z.unknown())),
});
export function discoverOpenAPI(spec: unknown): Capability[] {
  const parsed = specSchema.parse(spec);
  const capabilities: Capability[] = [];
  for (const [path, item] of Object.entries(parsed.paths)) {
    if (!path.startsWith("/") || path.startsWith("//") || path.includes(".."))
      throw new Error("Invalid operation path.");
    if (!item.get) continue;
    const op = item.get as Record<string, any>;
    const allParameters = [
      ...(Array.isArray(item.parameters) ? item.parameters : []),
      ...(Array.isArray(op.parameters) ? op.parameters : []),
    ];
    if (
      allParameters.some(
        (p: any) =>
          p.$ref ||
          p.schema?.$ref ||
          p.schema?.pattern ||
          !["string", "integer", "number", "boolean"].includes(
            p.schema?.type,
          ) ||
          !["path", "query"].includes(p.in),
      ) ||
      op.security?.length ||
      (spec as any).security?.length
    )
      continue;
    const parameters = allParameters.map((p: any) => ({
      name: z.string().max(100).parse(p.name),
      in: String(p.in),
      required: Boolean(p.required),
      schema: p.schema ?? {},
    }));
    capabilities.push({
      id: String(op.operationId || `get_${path}`)
        .replace(/[^a-zA-Z0-9_.-]/g, "_")
        .slice(0, 150),
      name: String(op.summary || op.operationId || `GET ${path}`).slice(0, 200),
      description: String(op.description || "").slice(0, 1000),
      method: "GET",
      path,
      parameters,
      version: parsed.info.version,
      classification: "read",
    });
  }
  if (capabilities.length > 100)
    throw new Error("Specifications are limited to 100 read operations.");
  if (new Set(capabilities.map((c) => c.id)).size !== capabilities.length)
    throw new Error("Operation identifiers must be unique.");
  return capabilities;
}
export async function readRemoteJSON(url: URL): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    redirect: "manual",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new Error(`Endpoint returned HTTP ${response.status}.`);
  if (Number(response.headers.get("content-length") || 0) > 1_000_000)
    throw new Error("Response exceeds the 1 MB limit.");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Endpoint returned an empty response.");
  let length = 0;
  let body = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > 1_000_000)
        throw new Error("Response exceeds the 1 MB limit.");
      body += decoder.decode(chunk.value, { stream: true });
    }
  } finally {
    await reader.cancel();
  }
  return JSON.parse(body + decoder.decode());
}
export function buildOperationURL(
  base: string,
  capability: Capability,
  input: Record<string, unknown>,
  allowedHosts: string[],
) {
  const baseURL = allowedURL(base, allowedHosts);
  let path = capability.path;
  const query = new URLSearchParams();
  const known = new Set(capability.parameters.map((p) => p.name));
  for (const key of Object.keys(input))
    if (!known.has(key)) throw new Error(`Unknown parameter: ${key}`);
  for (const p of capability.parameters) {
    const value = input[p.name];
    if (p.required && (value === undefined || value === null || value === ""))
      throw new Error(`Missing parameter: ${p.name}`);
    if (value === undefined) continue;
    if (!["string", "number", "boolean"].includes(typeof value))
      throw new Error(`Unsupported parameter: ${p.name}`);
    const type = p.schema.type;
    if (
      (type === "integer" &&
        (typeof value !== "number" || !Number.isInteger(value))) ||
      (type === "number" &&
        (typeof value !== "number" || !Number.isFinite(value))) ||
      (type === "boolean" && typeof value !== "boolean") ||
      (type === "string" && typeof value !== "string")
    )
      throw new Error(`Invalid type for ${p.name}`);
    if (Array.isArray(p.schema.enum) && !p.schema.enum.includes(value))
      throw new Error(`Invalid option for ${p.name}`);
    if (
      typeof value === "number" &&
      ((typeof p.schema.minimum === "number" && value < p.schema.minimum) ||
        (typeof p.schema.maximum === "number" && value > p.schema.maximum))
    )
      throw new Error(`Parameter exceeds permitted bounds: ${p.name}`);
    if (
      typeof value === "string" &&
      ((typeof p.schema.minLength === "number" &&
        value.length < p.schema.minLength) ||
        (typeof p.schema.maxLength === "number" &&
          value.length > p.schema.maxLength))
    )
      throw new Error(`Parameter exceeds permitted bounds: ${p.name}`);
    if (String(value).length > 1000 || [".", ".."].includes(String(value)))
      throw new Error("Parameter exceeds permitted bounds.");
    if (p.in === "path")
      path = path.replace(`{${p.name}}`, encodeURIComponent(String(value)));
    else query.set(p.name, String(value));
  }
  if (/\{[^}]+\}/.test(path)) throw new Error("Unresolved path parameters.");
  const url = allowedURL(
    `${baseURL.origin}${baseURL.pathname.replace(/\/$/, "")}${path}?${query}`,
    allowedHosts,
  );
  if (url.origin !== baseURL.origin)
    throw new Error("Operation escaped the approved origin.");
  return url;
}
