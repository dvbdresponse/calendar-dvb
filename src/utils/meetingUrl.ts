/** Accept web meeting URLs, including mixed-case schemes and pasted domain names. */
export function getMeetingUrl(value?: string): string {
  const text = value?.trim();
  if (!text || /[\s<>"\u0000-\u001f\u007f]/u.test(text)) return "";
  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(text) && !/^[a-z\d.-]+:\d+(?:[/?#]|$)/i.test(text);
  const candidate = text.startsWith("//") ? `https:${text}` : hasScheme ? text : `https://${text}`;
  try {
    const url = new URL(candidate);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return "";
    if (!hasScheme && !url.hostname.includes(".") && url.hostname !== "localhost" && !url.hostname.startsWith("[")) return "";
    return url.href;
  } catch {
    return "";
  }
}
