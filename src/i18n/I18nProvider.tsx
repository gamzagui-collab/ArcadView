import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import {
  translate,
  type Locale,
  type TranslationKey,
} from "./translations";
import { resolveLocale } from "./locale";

const STORAGE_KEY = "izcad.locale";

type I18nValue = {
  locale: Locale;
  setLocale(locale: Locale): void;
  t(key: TranslationKey): string;
};

const I18nContext = createContext<I18nValue | null>(null);

function getInitialLocale(): Locale {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    // The interface remains usable when device storage is unavailable.
  }
  return resolveLocale(navigator.language, stored);
}

export function I18nProvider({ children }: PropsWithChildren) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  const setLocale = useCallback((nextLocale: Locale) => {
    try {
      localStorage.setItem(STORAGE_KEY, nextLocale);
    } catch {
      // Keep the language for this session even if it cannot be persisted.
    }
    setLocaleState(nextLocale);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      setLocale,
      t: (key) => translate(locale, key),
    }),
    [locale, setLocale],
  );

  return (
    <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
  );
}

export function useI18n(): I18nValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider.");
  }
  return context;
}

