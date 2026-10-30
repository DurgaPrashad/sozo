// The DOM-free parts of page scans (see components/page-scan.ts).

// "scan", "scan the route", "SOZO, please scan this map"...
export const SCAN_REQUEST = /^\s*(?:hey\s+)?(?:sozo[,:\s]+)?(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?scan\b/i;

// Strips things that look like contact details, card numbers or secrets.
export function redact(text: string) {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/Bearer\s+\S+/gi, "Bearer [secret]")
    .replace(/\b(?:sk|pk|rk|sozo|ghp|gho|xox[abp]|AKIA)[-_]?[A-Za-z0-9_-]{16,}/g, "[secret]")
    .replace(/\b(?:\d[ -]?){12,19}\b/g, "[number]");
}
