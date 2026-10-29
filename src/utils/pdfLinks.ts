export const isLineBrowser = (userAgent: string) => /\bLine\//i.test(userAgent);

/** LINE's documented URL flag opens a normal browser instead of its webview. */
export function getExternalPdfUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.searchParams.set("openExternalBrowser", "1");
    return url.href;
  } catch {
    return null;
  }
}

export function getPdfDownloadUrl(value: string, filename: string): string {
  const url = new URL(value);
  if (url.protocol === "https:" || url.protocol === "http:")
    url.searchParams.set("download", filename);
  return url.href;
}
