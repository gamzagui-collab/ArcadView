import type { Locale } from "./translations";

export function resolveLocale(language: string, stored: string | null = null): Locale {
  if (stored === "ko" || stored === "en" || stored === "tr") return stored;
  const primary = language.toLowerCase().split(/[-_]/)[0];
  return primary === "ko" ? "ko" : primary === "tr" ? "tr" : "en";
}
