#!/usr/bin/env node
import { pathToFileURL } from "node:url";
export function parse(argv) {
  const [group, command, ...rest] = argv;
  const options = {};
  let target;
  const allowed = new Set([
    "name",
    "type",
    "url",
    "approve",
    "question",
    "project",
    "sources",
    "mode",
    "capability",
    "input",
  ]);
  for (let i = 0; i < rest.length; i++) {
    if (rest[i].startsWith("--")) {
      const key = rest[i].slice(2);
      if (!allowed.has(key)) throw new Error(`Unknown option: --${key}`);
      if (!rest[i + 1] || rest[i + 1].startsWith("--"))
        throw new Error(`Missing value for --${key}`);
      options[key] = rest[++i];
    } else if (!target) target = rest[i];
    else throw new Error(`Unexpected argument: ${rest[i]}`);
  }
  return { group, command, target, options };
}
export async function runCLI(
  argv,
  {
    baseURL = process.env.SOZO_BASE_URL,
    token = process.env.SOZO_API_KEY,
    siteToken = process.env.SOZO_SITE_ACCESS_TOKEN,
    fetcher = fetch,
  } = {},
) {
  const { group, command, target, options: o } = parse(argv);
  if (!group || group === "--help" || group === "help")
    return {
      usage: [
        "sozo project list | create --name NAME",
        "sozo research run --question QUESTION [--project UUID] [--sources crossref,europepmc] [--mode broad|focused]",
        "sozo research status|report|cancel ID",
        "sozo connect list|inspect|capabilities|test|remove NAME_OR_ID",
        "sozo connect add --name NAME --type openapi --url HTTPS_URL [--approve id1,id2]",
        "sozo connect invoke NAME_OR_ID --capability ID --input JSON",
      ],
      environment: [
        "SOZO_BASE_URL",
        "SOZO_API_KEY",
        "SOZO_SITE_ACCESS_TOKEN (private Sites only)",
      ],
    };
  if (!baseURL || !token)
    throw new Error(
      "Set SOZO_BASE_URL and SOZO_API_KEY. Create a key in API & developers.",
    );
  const base = new URL(baseURL);
  if (
    base.protocol !== "https:" &&
    !(
      base.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)
    )
  )
    throw new Error("Use HTTPS, or HTTP on loopback for local development.");
  const request = async (path, method = "GET", body) => {
    const response = await fetcher(`${base.origin}/api/v1/${path}`, {
      method,
      redirect: "error",
      signal: AbortSignal.timeout(25000),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(siteToken
          ? { "OAI-Sites-Authorization": `Bearer ${siteToken}` }
          : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const type = response.headers.get("content-type") || "";
    if (!type.includes("json"))
      throw new Error(
        "The host requires sign-in. Configure SOZO_SITE_ACCESS_TOKEN for a private Site.",
      );
    const data = await response.json();
    if (!response.ok)
      throw new Error(
        data.error?.message || `API returned HTTP ${response.status}`,
      );
    return data;
  };
  if (group === "project") {
    if (command === "list") return request("projects");
    if (command === "create" && o.name)
      return request("projects", "POST", { name: o.name });
  }
  if (group === "research") {
    if (command === "run" && o.question)
      return request("research", "POST", {
        question: o.question,
        ...(o.project ? { projectId: o.project } : {}),
        sources: (o.sources || "crossref,europepmc").split(","),
        mode: o.mode || "broad",
      });
    if (target && ["status", "report", "cancel"].includes(command))
      return request(
        `research/${encodeURIComponent(target)}${command === "report" ? "/report" : command === "cancel" ? "/cancel" : ""}`,
        command === "cancel" ? "POST" : "GET",
        command === "cancel" ? {} : undefined,
      );
  }
  if (group === "connect") {
    if (command === "list") return request("connectors");
    if (command === "add" && o.name && o.url) {
      if (o.type !== "openapi")
        throw new Error("This release supports --type openapi only.");
      const discovery = await request("connectors/discover", "POST", {
        url: o.url,
      });
      if (!o.approve)
        return {
          ...discovery,
          next: "Review the read operations, then repeat with --approve id1,id2 to register only those capabilities.",
        };
      return request("connectors", "POST", {
        name: o.name,
        url: o.url,
        approved: o.approve.split(","),
      });
    }
    if (command === "test" && ["crossref", "europepmc"].includes(target))
      return request("connectors/test", "POST", { provider: target });
    if (target) {
      const list = await request("connectors");
      const connector = list.connectors.find(
        (c) => c.id === target || c.name === target,
      );
      if (!connector)
        throw new Error("Connector not found. Use sozo connect list.");
      const id = encodeURIComponent(connector.id);
      if (command === "inspect") return request(`connectors/${id}`);
      if (command === "capabilities")
        return { capabilities: connector.capabilities };
      if (command === "remove") return request(`connectors/${id}`, "DELETE");
      if (command === "test")
        return {
          registered: true,
          connector: connector.name,
          reachability:
            "Not tested: no harmless health capability is defined. Use invoke with an approved operation.",
        };
      if (command === "invoke" && o.capability)
        return request(`connectors/${id}/invoke`, "POST", {
          capability: o.capability,
          input: JSON.parse(o.input || "{}"),
        });
    }
  }
  throw new Error("Invalid command or missing options. Run sozo --help.");
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const result = await runCLI(process.argv.slice(2));
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } catch (e) {
    process.stderr.write(`sozo: ${e.message}\n`);
    process.exitCode = 1;
  }
}
