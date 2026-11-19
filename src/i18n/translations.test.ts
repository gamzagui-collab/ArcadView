import { describe, expect, it } from "vitest";
import { translations, translate, type TranslationKey } from "./translations";
import { resolveLocale } from "./locale";

describe("Korean language pack", () => {
  it("translates every English key with no missing or empty Korean entries", () => {
    const keys = Object.keys(translations.en) as TranslationKey[];
    expect(Object.keys(translations.ko).sort()).toEqual([...keys].sort());
    for (const key of keys) expect(translate("ko", key).trim().length).toBeGreaterThan(0);
    expect(translate("ko", "myDrawings")).toBe("내 도면");
    expect(translate("ko", "measure")).toBe("측정");
  });

  it("detects Korean phones and preserves a saved language selection", () => {
    expect(resolveLocale("ko-KR")).toBe("ko");
    expect(resolveLocale("ko_KR")).toBe("ko");
    expect(resolveLocale("en-US", "ko")).toBe("ko");
    expect(resolveLocale("ko-KR", "en")).toBe("en");
    expect(resolveLocale("tr-TR")).toBe("tr");
    expect(resolveLocale("fr-FR", "invalid")).toBe("en");
  });
});
