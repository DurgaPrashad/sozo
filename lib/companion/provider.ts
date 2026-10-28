import { inconsistentEqualComparison } from "../science/claim-checks";
import { SYSTEM_PROMPT, evidenceMessage, type CompanionContext } from "./context";

export class ProviderError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export async function sarvamRequest(key: string | undefined, path: string, body: unknown, multipart = false) {
  if (!key) throw new ProviderError(503, "provider_unconfigured", "SOZO voice and conversation are not configured on this server.");
  let response: Response;
  try {
    response = await fetch(`https://api.sarvam.ai${path}`, {
      method: "POST", headers: { "api-subscription-key": key, ...(multipart ? {} : { "Content-Type": "application/json" }) },
      body: multipart ? body as FormData : JSON.stringify(body), signal: AbortSignal.timeout(45000), redirect: "manual",
    });
  } catch { throw new ProviderError(502, "provider_unreachable", "The speech provider could not be reached. Please retry."); }
  if (!response.ok) {
    await response.body?.cancel();
    const message = response.status === 401 || response.status === 403 ? "The speech provider rejected this server's credentials or model access." : response.status === 402 ? "The speech provider requires available credits." : response.status === 429 ? "The speech provider is busy or its quota has been reached. Please retry later." : "The speech provider could not complete this request.";
    throw new ProviderError(response.status === 429 ? 429 : 502, `provider_${response.status}`, message);
  }
  const raw = await boundedResponse(response, 12 * 1024 * 1024);
  try { return JSON.parse(raw); } catch { throw new ProviderError(502, "provider_invalid", "The speech provider returned an unreadable response."); }
}
async function boundedResponse(response: Response, maximum: number) {
  const reader = response.body?.getReader(); if (!reader) return "";
  const decoder = new TextDecoder(); let size = 0, text = "";
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > maximum) throw new ProviderError(502, "provider_oversize", "The provider response was too large."); text += decoder.decode(value, { stream: true }); } return text + decoder.decode(); }
  finally { await reader.cancel(); }
}
export async function generateReply(key: string | undefined, input: { message: string; history: { role: "user" | "assistant"; content: string }[]; context?: CompanionContext }, citations: Array<{ title: string; url: string; abstract: string; doi?: string }>) {
  const vision = Boolean(input.context?.screenshot);
  const model = vision ? "gemma4" : "sarvam-105b-conversations";
  const content = vision ? [{ type: "text", text: input.message }, { type: "image_url", image_url: { url: input.context!.screenshot } }] : input.message;
  const result = await sarvamRequest(key, vision ? "/v2/chat/completions" : "/v1/chat/completions", {
    model, messages: [{ role: "system", content: SYSTEM_PROMPT }, ...input.history, { role: "user", content: evidenceMessage(input.context, citations) }, { role: "user", content }],
    max_tokens: 1000, temperature: 0.2, ...(vision ? {} : { reasoning_effort: null }), stream: false,
  });
  const reply = result?.choices?.[0]?.message?.content;
  if (typeof reply !== "string" || !reply.trim()) throw new ProviderError(502, "provider_empty", "The provider returned no reply. Please retry.");
  if (inconsistentEqualComparison(reply)) throw new ProviderError(502, "numerical_comparison_invalid", "The generated reply contained an inconsistent numerical comparison. Please retry or inspect the source records.");
  return { reply: reply.slice(0, 12000), model, usage: result.usage ? { totalTokens: Number(result.usage.total_tokens) || null } : null };
}

export async function synthesizeSpeech(key: string | undefined, text: string, language: string) {
  const result = await sarvamRequest(key, "/text-to-speech", { text, language_code: language, model: "bulbul:v4-flash", speech_sample_rate: 24000, output_audio_codec: "mp3", pace: 1 });
  const audio = result?.audios?.[0];
  if (typeof audio !== "string" || !/^[A-Za-z0-9+/]+=*$/.test(audio)) throw new ProviderError(502, "provider_audio_invalid", "No playable speech was returned.");
  return { audio, mimeType: "audio/mpeg", model: "bulbul:v4-flash" };
}

export async function transcribeSpeech(key: string | undefined, file: File) {
  const form = new FormData(); form.set("file", file, file.name || "recording.webm"); form.set("model", "saaras:v4"); form.set("language_code", "unknown"); form.set("mode", "transcribe");
  const result = await sarvamRequest(key, "/speech-to-text", form, true);
  if (typeof result?.transcript !== "string") throw new ProviderError(502, "provider_transcript_invalid", "No transcript was returned.");
  return { transcript: result.transcript.slice(0, 6000), languageCode: result.language_code || null, model: "saaras:v4" };
}
