export function sanitizeAiDiagnosticMessage(message: string) {
  return message
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/\b(?:Bearer|Authorization|apikey|api_key|x-api-key)\b\s*[:=]?\s*[^\s,;]+/gi, "[redacted]")
    .replace(/[A-Za-z0-9_-]{28,}/g, "[redacted]");
}
