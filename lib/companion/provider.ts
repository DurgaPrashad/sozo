import { ASTRO_TOOL, COMPUTATIONAL, runAstroCalculation, type Calculation } from "../science/astro";
import { inconsistentEqualComparison } from "../science/claim-checks";
import { SYSTEM_PROMPT, evidenceMessage, styleInstruction, type AnswerStyle, type CompanionContext } from "./context";

// Model providers for conversation, voice, transcription and vision.
// Sarvam is the primary provider. Meta Llama (or any OpenAI-compatible host
// serving Llama) is optional: it answers when Sarvam fails, or first when
// SOZO_CHAT_PROVIDER=meta.

export type Operation = "chat" | "speech" | "transcription" | "vision";
const SUBJECT: Record<Operation, string> = {
  chat: "SOZO's conversation model",
  speech: "SOZO's voice",
  transcription: "SOZO's speech recognition",
  vision: "SOZO's image model",
};

export class ProviderError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public retryable = false,
    public retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

type Env = Record<string, string | undefined>;

// API keys pasted into hosting dashboards often carry hidden characters,
// quotes or a NAME= / Bearer prefix. Any of them makes fetch() reject the
// header instantly, which used to surface as "could not be reached".
export function cleanSecret(raw?: string) {
  const notes: string[] = [];
  if (!raw?.trim() || /[<>]/.test(raw)) return { value: undefined, notes, invalid: false };
  let value = raw;
  if (/[\u200B-\u200D\u2060\uFEFF\u00A0]/.test(value)) {
    value = value.replace(/[\u200B-\u200D\u2060\uFEFF\u00A0]/g, "");
    notes.push("removed hidden characters");
  }
  value = value.trim();
  const prefix = value.match(/^[A-Z][A-Z0-9_]*\s*=\s*/);
  if (prefix) { value = value.slice(prefix[0].length); notes.push("removed a NAME= prefix"); }
  if (/^Bearer\s+/i.test(value)) { value = value.replace(/^Bearer\s+/i, ""); notes.push("removed a Bearer prefix"); }
  const quoted = value.match(/^(["'`\u201C\u2018])([\s\S]*)(["'`\u201D\u2019])$/);
  if (quoted) { value = quoted[2].trim(); notes.push("removed surrounding quotes"); }
  return { value: value || undefined, notes, invalid: /[^\x21-\x7E]/.test(value) };
}
const configured = (value?: string) => {
  const secret = cleanSecret(value);
  return secret.invalid ? undefined : secret.value;
};

// Safe description of a key for the health check: never the value itself.
export type KeyDescription = { set: boolean; usable?: boolean; length?: number; expectedPrefix?: boolean; cleaned?: string[]; problem?: string };
export function describeKey(raw?: string, expectedPrefix?: string): KeyDescription {
  const secret = cleanSecret(raw);
  if (!raw?.trim()) return { set: false };
  return {
    set: true,
    usable: Boolean(secret.value) && !secret.invalid,
    length: secret.value?.length ?? 0,
    ...(expectedPrefix ? { expectedPrefix: secret.value?.startsWith(expectedPrefix) ?? false } : {}),
    ...(secret.notes.length ? { cleaned: secret.notes } : {}),
    ...(secret.invalid ? { problem: "contains spaces, line breaks or non-ASCII characters inside the key" } : {}),
  };
}

// AbortSignal.any is missing on some runtimes; combine signals by hand there.
function anySignal(signals: AbortSignal[]) {
  if (typeof AbortSignal.any === "function") return AbortSignal.any(signals);
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) { controller.abort(signal.reason); break; }
    signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}

export type ChatProvider = {
  id: "sarvam" | "meta";
  label: string;
  model: string;
  endpoint: string;
  headers: Record<string, string>;
};

export function chatProviders(env: Env = process.env, sarvamKey = env.SARVAM_API_KEY): ChatProvider[] {
  const providers: ChatProvider[] = [];
  const sarvam = configured(sarvamKey);
  if (sarvam)
    providers.push({
      id: "sarvam",
      label: "Sarvam 105B",
      model: "sarvam-105b-conversations",
      endpoint: "https://api.sarvam.ai/v1/chat/completions",
      headers: { "api-subscription-key": sarvam },
    });
  const meta = configured(env.META_LLAMA_API_KEY) ?? configured(env.LLAMA_API_KEY);
  if (meta) {
    const base = (configured(env.META_LLAMA_BASE_URL) ?? "https://api.llama.com/compat/v1").replace(/\/+$/, "");
    const model = configured(env.META_LLAMA_MODEL) ?? "Llama-4-Maverick-17B-128E-Instruct-FP8";
    providers.push({
      id: "meta",
      label: `Meta ${model.replace(/-Instruct.*$/i, "").replace(/-/g, " ")}`,
      model,
      endpoint: `${base}/chat/completions`,
      headers: { Authorization: `Bearer ${meta}` },
    });
  }
  if (env.SOZO_CHAT_PROVIDER?.trim().toLowerCase() === "meta") providers.sort((a) => (a.id === "meta" ? -1 : 1));
  return providers;
}

function statusError(operation: Operation, status: number, retryAfter: string | null): ProviderError {
  const subject = SUBJECT[operation];
  if (status === 401 || status === 403)
    return new ProviderError(502, "provider_auth", `${subject} rejected this server's API key or model access.`);
  if (status === 402) return new ProviderError(503, "provider_credits", `${subject} needs more provider credits.`);
  if (status === 429) {
    const seconds = Math.min(300, Math.max(1, Number(retryAfter) || 10));
    return new ProviderError(429, "provider_rate_limited", `${subject} is busy or its quota is used up. Retry in ${seconds} s.`, true, seconds);
  }
  if (status >= 500) return new ProviderError(502, "provider_error", `${subject} had a temporary problem. Please retry.`, true, 3);
  return new ProviderError(502, "provider_rejected", `${subject} could not process this request.`);
}

// One fetch for every provider call: separates timeouts from network
// failures and maps HTTP errors to stable, documented codes.
export async function providerFetch(
  operation: Operation,
  url: string,
  init: RequestInit,
  { timeoutMs, signal }: { timeoutMs: number; signal?: AbortSignal },
): Promise<Response> {
  const timeout = AbortSignal.timeout(Math.max(1000, timeoutMs));
  let response: Response;
  try {
    response = await fetch(url, { ...init, redirect: "manual", signal: signal ? anySignal([timeout, signal]) : timeout });
  } catch (error) {
    if (signal?.aborted) throw error;
    if (timeout.aborted || (error as Error)?.name === "TimeoutError")
      throw new ProviderError(504, "provider_timeout", `${SUBJECT[operation]} took too long to answer. Please retry.`, true, 5);
    const detail = `${(error as Error)?.message ?? ""} ${((error as { cause?: Error })?.cause?.message) ?? ""}`;
    if (/ByteString|invalid header|Headers\.(append|set)/i.test(detail))
      throw new ProviderError(502, "provider_key_invalid", `${SUBJECT[operation]}'s API key on this server contains invalid characters. Re-enter it without spaces, quotes or line breaks.`);
    throw new ProviderError(502, "provider_unreachable", `${SUBJECT[operation]} could not be reached. Please retry.`, true, 3);
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    throw statusError(operation, response.status, response.headers.get("retry-after"));
  }
  return response;
}

async function boundedText(response: Response, maximum: number, operation: Operation) {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let size = 0, text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) throw new ProviderError(502, "provider_bad_response", `${SUBJECT[operation]} returned an oversized response.`, true, 3);
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    await reader.cancel().catch(() => {});
  }
}

async function providerJSON(response: Response, operation: Operation, maximum = 12 * 1024 * 1024) {
  const raw = await boundedText(response, maximum, operation);
  try {
    return JSON.parse(raw);
  } catch {
    throw new ProviderError(502, "provider_bad_response", `${SUBJECT[operation]} returned an unreadable response.`, true, 3);
  }
}

export async function sarvamRequest(
  key: string | undefined,
  path: string,
  body: unknown,
  { operation, timeoutMs = 30000, signal, multipart = false }: { operation: Operation; timeoutMs?: number; signal?: AbortSignal; multipart?: boolean },
) {
  const secret = cleanSecret(key);
  if (secret.invalid) throw new ProviderError(502, "provider_key_invalid", `${SUBJECT[operation]}'s API key on this server contains invalid characters. Re-enter it without spaces, quotes or line breaks.`);
  if (!secret.value) throw new ProviderError(503, "provider_unconfigured", `${SUBJECT[operation]} is not configured on this server.`);
  const response = await providerFetch(operation, `https://api.sarvam.ai${path}`, {
    method: "POST",
    headers: { "api-subscription-key": secret.value, ...(multipart ? {} : { "Content-Type": "application/json" }) },
    body: multipart ? (body as FormData) : JSON.stringify(body),
  }, { timeoutMs, signal });
  return providerJSON(response, operation);
}

export type ChatInput = {
  message: string;
  history: { role: "user" | "assistant"; content: string }[];
  context?: CompanionContext;
  style?: AnswerStyle;
};
export type Citation = { title: string; url: string; abstract: string; doi?: string };
export type ChatResult = { reply: string; model: string; provider: string; usage: { totalTokens: number | null } | null; checks: string[]; calculations: Calculation[] };

export const MAX_TOKENS: Record<AnswerStyle, number> = { brief: 320, standard: 900, detailed: 1600 };

const CALCULATOR_INSTRUCTION =
  "CALCULATOR: call the astro_calculator tool for every quantity it can compute, then quote its results exactly; do not recompute or round them differently. Only say a value came from the calculator if a tool result contains it.";

function chatMessages(input: ChatInput, citations: Citation[], vision: boolean, calculator = false) {
  const style = input.style ?? "standard";
  const content = vision
    ? [{ type: "text", text: input.message }, { type: "image_url", image_url: { url: input.context!.screenshot } }]
    : input.message;
  return [
    { role: "system", content: `${SYSTEM_PROMPT}\n\n${styleInstruction(style)}${calculator ? `\n\n${CALCULATOR_INSTRUCTION}` : ""}` },
    ...input.history,
    { role: "user", content: evidenceMessage(input.context, citations) },
    { role: "user", content },
  ];
}

// Citation markers outside the retrieved range and inconsistent numerical
// comparisons are reported as limitations rather than hidden.
export function replyChecks(reply: string, citations: number) {
  const checks: string[] = [];
  const markers = [...reply.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
  if (markers.some((n) => n < 1 || n > citations))
    checks.push("The model included an unsupported citation marker; verify the source list before relying on its answer.");
  if (inconsistentEqualComparison(reply))
    checks.push("The reply contains an inconsistent numerical comparison; check the figures against the sources.");
  return checks;
}

// Providers require the tool list whenever tool calls or results appear in
// the conversation; "none" makes the model write the answer.
const toolsFor = (messages: unknown[]) =>
  messages.some((message) => (message as { role?: string }).role === "tool") ? { tools: [ASTRO_TOOL], tool_choice: "none" } : {};

async function completeOnce(provider: ChatProvider, messages: unknown[], maxTokens: number, timeoutMs: number, signal?: AbortSignal) {
  const response = await providerFetch("chat", provider.endpoint, {
    method: "POST",
    headers: { ...provider.headers, "Content-Type": "application/json" },
    body: JSON.stringify({ model: provider.model, messages, max_tokens: maxTokens, temperature: 0.2, stream: false, ...toolsFor(messages) }),
  }, { timeoutMs, signal });
  const result = await providerJSON(response, "chat");
  const reply = result?.choices?.[0]?.message?.content;
  if (typeof reply !== "string" || !reply.trim())
    throw new ProviderError(502, "provider_bad_response", `${SUBJECT.chat} returned no reply. Please retry.`, true, 2);
  return { reply: reply.slice(0, 12000), usage: result.usage ? { totalTokens: Number(result.usage.total_tokens) || null } : null };
}

type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

// One tool round: the model either answers directly or asks the calculator;
// SOZO runs the calculations and returns the extended conversation.
async function toolRound(provider: ChatProvider, messages: unknown[], maxTokens: number, timeoutMs: number, signal?: AbortSignal, retry = false): Promise<{ content: string | null; messages: unknown[]; calculations: Calculation[]; usage: ChatResult["usage"] }> {
  const response = await providerFetch("chat", provider.endpoint, {
    method: "POST",
    headers: { ...provider.headers, "Content-Type": "application/json" },
    // Numeric questions must go through the calculator: with "auto" the model
    // sometimes answers from memory and gets the arithmetic wrong. A second
    // round after a failed calculation may correct the call or answer.
    body: JSON.stringify({ model: provider.model, messages, tools: [ASTRO_TOOL], tool_choice: retry ? "auto" : "required", max_tokens: maxTokens, temperature: 0.1, stream: false }),
  }, { timeoutMs, signal });
  const result = await providerJSON(response, "chat");
  const message = result?.choices?.[0]?.message ?? {};
  const calls = (Array.isArray(message.tool_calls) ? message.tool_calls : []).slice(0, 4) as ToolCall[];
  if (!calls.length) {
    const content = typeof message.content === "string" ? message.content : "";
    if (!content.trim()) throw new ProviderError(502, "provider_bad_response", `${SUBJECT.chat} returned no reply. Please retry.`, true, 2);
    return { content: content.slice(0, 12000), messages, calculations: [] as Calculation[], usage: result.usage ? { totalTokens: Number(result.usage.total_tokens) || null } : null };
  }
  const calculations = calls.map((call) => {
    let input: Record<string, unknown> = {};
    try { input = JSON.parse(call.function?.arguments || "{}"); } catch { /* reported as an error below */ }
    return runAstroCalculation(input);
  });
  const extended = [
    ...messages,
    { role: "assistant", content: message.content ?? "", tool_calls: calls },
    ...calls.map((call, index) => ({ role: "tool", tool_call_id: call.id, content: JSON.stringify(calculations[index].result ?? { error: calculations[index].error }) })),
  ];
  if (!retry && calculations.some((calculation) => calculation.error)) {
    const next = await toolRound(provider, extended, maxTokens, timeoutMs, signal, true);
    return { ...next, calculations: [...calculations.filter((c) => c.result), ...next.calculations] };
  }
  return { content: null, messages: extended, calculations, usage: null };
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const label = (key: string) => key.replace(/_/g, " ").replace(/\b(km s|m s2|m s)\b/, (unit) => unit.replace(" ", "/"));
export function describeCalculations(calculations: Calculation[]) {
  return [
    "Results from SOZO's astrodynamics calculator (two-body model):",
    ...calculations.map((calculation) => calculation.result
      ? `- ${label(calculation.operation)}: ${Object.entries(calculation.result).map(([key, value]) => `${label(key)} ${value}`).join(", ")}`
      : `- ${label(calculation.operation)}: ${calculation.error}`),
  ].join("\n");
}

export type Budget = { remaining: () => number };
export const budgetFrom = (deadline: number): Budget => ({ remaining: () => deadline - Date.now() });

// Primary provider, one retry for transient failures when at least 15 s
// remain, then the other configured provider with fewer tokens.
export async function generateReply(
  providers: ChatProvider[] | string | undefined,
  input: ChatInput,
  citations: Citation[],
  { budget = budgetFrom(Date.now() + 45000), signal }: { budget?: Budget; signal?: AbortSignal } = {},
): Promise<ChatResult> {
  const list = typeof providers === "string" || providers === undefined ? chatProviders(process.env, providers) : providers;
  const vision = Boolean(input.context?.screenshot);
  const style = input.style ?? "standard";
  if (vision) return visionReply(list.find((p) => p.id === "sarvam"), input, citations, budget, signal);
  if (!list.length) throw new ProviderError(503, "provider_unconfigured", `${SUBJECT.chat} is not configured on this server.`);
  const calculator = COMPUTATIONAL.test(input.message);
  const messages = chatMessages(input, citations, false, calculator);
  let lastError: unknown;
  for (const [index, provider] of list.entries()) {
    const maxTokens = index === 0 ? MAX_TOKENS[style] : Math.min(MAX_TOKENS[style], 500);
    for (let attempt = 0; attempt < 2; attempt++) {
      const timeoutMs = Math.min(40000, budget.remaining() - 1500);
      if (timeoutMs < 4000) break;
      try {
        let conversation: unknown[] = messages, calculations: Calculation[] = [];
        if (calculator) {
          const round = await toolRound(provider, messages, maxTokens, timeoutMs, signal);
          if (round.content) return { reply: round.content, usage: round.usage, model: provider.model, provider: provider.label, checks: replyChecks(round.content, citations.length), calculations: [] };
          conversation = round.messages;
          calculations = round.calculations;
        }
        const { reply, usage } = await completeOnce(provider, conversation, maxTokens, Math.min(40000, budget.remaining() - 1500), signal);
        return { reply, usage, model: provider.model, provider: provider.label, checks: replyChecks(reply, citations.length), calculations };
      } catch (error) {
        lastError = error;
        if (!(error instanceof ProviderError) || !error.retryable) break;
        const transient = ["provider_unreachable", "provider_error", "provider_bad_response"].includes(error.code);
        if (attempt === 0 && transient && budget.remaining() >= 15000) {
          await pause(1000 + Math.random() * 1000);
          continue;
        }
        break;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new ProviderError(504, "provider_timeout", `${SUBJECT.chat} took too long to answer. Please retry.`, true, 5);
}

async function visionReply(provider: ChatProvider | undefined, input: ChatInput, citations: Citation[], budget: Budget, signal?: AbortSignal): Promise<ChatResult> {
  if (!provider) throw new ProviderError(503, "provider_unconfigured", `${SUBJECT.vision} is not configured on this server.`);
  const result = await sarvamRequest(provider.headers["api-subscription-key"], "/v2/chat/completions", {
    model: "gemma4",
    messages: chatMessages(input, citations, true),
    max_tokens: MAX_TOKENS[input.style ?? "standard"],
    temperature: 0.2,
    stream: false,
  }, { operation: "vision", timeoutMs: Math.min(40000, budget.remaining() - 1500), signal });
  const reply = result?.choices?.[0]?.message?.content;
  if (typeof reply !== "string" || !reply.trim()) throw new ProviderError(502, "provider_bad_response", `${SUBJECT.vision} returned no reply. Please retry.`, true, 2);
  return { reply: reply.slice(0, 12000), model: "gemma4", provider: "Sarvam vision", usage: result.usage ? { totalTokens: Number(result.usage.total_tokens) || null } : null, checks: replyChecks(reply, citations.length), calculations: [] };
}

// Streams text deltas from an OpenAI-compatible SSE response. Falls back to
// the next provider only before any text has been sent.
export async function* streamReply(
  list: ChatProvider[],
  input: ChatInput,
  citations: Citation[],
  { budget, signal }: { budget: Budget; signal?: AbortSignal },
): AsyncGenerator<{ delta: string } | { calculations: Calculation[] } | { done: ChatResult }> {
  if (input.context?.screenshot) {
    const result = await visionReply(list.find((p) => p.id === "sarvam"), input, citations, budget, signal);
    yield { delta: result.reply };
    yield { done: result };
    return;
  }
  if (!list.length) throw new ProviderError(503, "provider_unconfigured", `${SUBJECT.chat} is not configured on this server.`);
  const style = input.style ?? "standard";
  const calculator = COMPUTATIONAL.test(input.message);
  const messages = chatMessages(input, citations, false, calculator);
  let lastError: unknown;
  for (const [index, provider] of list.entries()) {
    const timeoutMs = Math.min(40000, budget.remaining() - 1500);
    if (timeoutMs < 4000) break;
    const maxTokens = index === 0 ? MAX_TOKENS[style] : Math.min(MAX_TOKENS[style], 500);
    let sent = "";
    let usage: ChatResult["usage"] = null;
    let calculations: Calculation[] = [];
    try {
      let conversation: unknown[] = messages;
      if (calculator) {
        const round = await toolRound(provider, messages, maxTokens, timeoutMs, signal);
        if (round.content) {
          sent = round.content;
          yield { delta: round.content };
          yield { done: { reply: round.content, model: provider.model, provider: provider.label, usage: round.usage, checks: replyChecks(round.content, citations.length), calculations: [] } };
          return;
        }
        conversation = round.messages;
        calculations = round.calculations;
        yield { calculations };
      }
      const response = await providerFetch("chat", provider.endpoint, {
        method: "POST",
        headers: { ...provider.headers, "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ model: provider.model, messages: conversation, max_tokens: maxTokens, temperature: 0.2, stream: true, ...toolsFor(conversation) }),
      }, { timeoutMs: Math.min(40000, budget.remaining() - 1500), signal });
      if (!response.headers.get("content-type")?.includes("event-stream")) {
        const result = await providerJSON(response, "chat");
        const reply = result?.choices?.[0]?.message?.content;
        if (typeof reply !== "string" || !reply.trim()) throw new ProviderError(502, "provider_bad_response", `${SUBJECT.chat} returned no reply. Please retry.`, true, 2);
        yield { delta: reply };
        yield { done: { reply, model: provider.model, provider: provider.label, usage: result.usage ? { totalTokens: Number(result.usage.total_tokens) || null } : null, checks: replyChecks(reply, citations.length), calculations } };
        return;
      }
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newline: number;
        while ((newline = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            const event = JSON.parse(data);
            const delta = event?.choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta) {
              sent += delta;
              if (sent.length > 12000) break;
              yield { delta };
            }
            if (event?.usage) usage = { totalTokens: Number(event.usage.total_tokens) || null };
          } catch {
            // Ignore keep-alive or partial lines.
          }
        }
      }
      if (!sent.trim() && calculations.length) {
        // The model occasionally streams nothing after a tool round: ask once
        // more without streaming, then fall back to the exact results.
        try {
          sent = (await completeOnce(provider, conversation, maxTokens, Math.min(20000, budget.remaining() - 1500), signal)).reply;
        } catch {
          sent = describeCalculations(calculations);
        }
        yield { delta: sent };
      }
      if (!sent.trim()) throw new ProviderError(502, "provider_bad_response", `${SUBJECT.chat} returned no reply. Please retry.`, true, 2);
      yield { done: { reply: sent, model: provider.model, provider: provider.label, usage, checks: replyChecks(sent, citations.length), calculations } };
      return;
    } catch (error) {
      lastError = error;
      // Once text has reached the client, another provider cannot restart it.
      if (sent || !(error instanceof ProviderError) || !error.retryable) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new ProviderError(504, "provider_timeout", `${SUBJECT.chat} took too long to answer. Please retry.`, true, 5);
}

export async function synthesizeSpeech(key: string | undefined, text: string, language: string, signal?: AbortSignal) {
  const result = await sarvamRequest(key, "/text-to-speech", { text, language_code: language, model: "bulbul:v4-flash", speech_sample_rate: 24000, output_audio_codec: "mp3", pace: 1 }, { operation: "speech", timeoutMs: 30000, signal });
  const audio = result?.audios?.[0];
  if (typeof audio !== "string" || !/^[A-Za-z0-9+/]+=*$/.test(audio)) throw new ProviderError(502, "provider_bad_response", `${SUBJECT.speech} returned no playable audio.`, true, 2);
  return { audio, mimeType: "audio/mpeg", model: "bulbul:v4-flash" };
}

export async function transcribeSpeech(key: string | undefined, file: File, signal?: AbortSignal) {
  const form = new FormData(); form.set("file", file, file.name || "recording.webm"); form.set("model", "saaras:v4"); form.set("language_code", "unknown"); form.set("mode", "transcribe");
  const result = await sarvamRequest(key, "/speech-to-text", form, { operation: "transcription", timeoutMs: 30000, signal, multipart: true });
  if (typeof result?.transcript !== "string") throw new ProviderError(502, "provider_bad_response", `${SUBJECT.transcription} returned no transcript.`, true, 2);
  return { transcript: result.transcript.slice(0, 6000), languageCode: result.language_code || null, model: "saaras:v4" };
}

// Half a second of 16 kHz silence: the cheapest real transcription probe.
function silentWav() {
  const samples = 8000, bytes = new Uint8Array(44 + samples * 2), view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, "RIFF"); view.setUint32(4, 36 + samples * 2, true); text(8, "WAVE"); text(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 16000, true);
  view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, "data"); view.setUint32(40, samples * 2, true);
  return bytes;
}

export type ServiceHealth = { status: "ok" | "degraded" | "down" | "unconfigured"; latencyMs?: number; code?: string; provider?: string };

async function probe(run: () => Promise<unknown>, slowMs: number): Promise<ServiceHealth> {
  const started = Date.now();
  try {
    await run();
    const latencyMs = Date.now() - started;
    return { status: latencyMs > slowMs ? "degraded" : "ok", latencyMs };
  } catch (error) {
    const code = error instanceof ProviderError ? error.code : "probe_failed";
    if (code === "provider_unconfigured") return { status: "unconfigured" };
    const retryable = error instanceof ProviderError && error.retryable;
    return { status: retryable ? "degraded" : "down", code, latencyMs: Date.now() - started };
  }
}

// Real, minimal provider calls: a one-token chat, a two-word voice clip and
// a silent transcription.
export async function providerHealth(env: Env = process.env) {
  // The raw value: sarvamRequest cleans it and reports an unusable key.
  const key = env.SARVAM_API_KEY;
  const providers = chatProviders(env);
  const chatChecks = await Promise.all(providers.map(async (provider) => ({
    ...(await probe(() => completeOnce(provider, [{ role: "user", content: "ping" }], 1, 10000), 6000)),
    provider: provider.label,
  })));
  const [speech, transcription] = await Promise.all([
    probe(() => synthesizeSpeech(key, "Ready.", "en-IN"), 6000),
    probe(() => {
      const wav = silentWav();
      return transcribeSpeech(key, new File([wav.buffer as ArrayBuffer], "probe.wav", { type: "audio/wav" }));
    }, 6000),
  ]);
  const fallback: ServiceHealth = cleanSecret(env.SARVAM_API_KEY).invalid ? { status: "down", code: "provider_key_invalid" } : { status: "unconfigured" };
  const chat: ServiceHealth = chatChecks.find((c) => c.status === "ok") ?? chatChecks.find((c) => c.status === "degraded") ?? chatChecks[0] ?? fallback;
  return {
    chat,
    chatProviders: chatChecks,
    speech,
    transcription,
    keys: { SARVAM_API_KEY: describeKey(env.SARVAM_API_KEY, "sk_"), META_LLAMA_API_KEY: describeKey(env.META_LLAMA_API_KEY ?? env.LLAMA_API_KEY) },
    checkedAt: new Date().toISOString(),
  };
}
