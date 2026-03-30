import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
  translations,
} from "../i18n/translations";

const LanguageContext = createContext({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
  t: (key) => key,
});

function normalizeLanguage(language) {
  const normalized = String(language || "").toLowerCase();
  return SUPPORTED_LANGUAGES.includes(normalized) ? normalized : DEFAULT_LANGUAGE;
}

function getNestedValue(source, path) {
  if (!source || typeof path !== "string") return undefined;
  return path.split(".").reduce((cursor, segment) => {
    if (cursor == null || typeof cursor !== "object") return undefined;
    return cursor[segment];
  }, source);
}

function readInitialLanguage() {
  if (typeof window === "undefined" || !window.localStorage) return DEFAULT_LANGUAGE;
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return normalizeLanguage(stored);
}

function interpolateMessage(message, params = {}) {
  return message.replace(/\{\{(\w+)\}\}/g, (_, token) => {
    const value = params[token];
    return value == null ? "" : String(value);
  });
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => readInitialLanguage());

  const setLanguage = useCallback((nextLanguage) => {
    setLanguageState(normalizeLanguage(nextLanguage));
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    }
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("lang", language);
    }
  }, [language]);

  const t = useCallback(
    (key, params = {}) => {
      const value =
        getNestedValue(translations[language], key) ??
        getNestedValue(translations[DEFAULT_LANGUAGE], key);
      if (typeof value !== "string") return key;
      return interpolateMessage(value, params);
    },
    [language]
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
    }),
    [language, setLanguage, t]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}

