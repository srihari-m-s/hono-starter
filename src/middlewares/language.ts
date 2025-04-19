import { type DetectorOptions, languageDetector } from "hono/language";
import i18next from "i18next";

import en from "../locale/en.json";
import type { Context, Next } from "hono";

await i18next.init({
  resources: {
    en: { translation: en },
  },
  fallbackLng: "en",
  supportedLngs: ["en"],
  interpolation: {
    escapeValue: false, // Don't escape HTML by default
  },
  returnNull: false,
  returnEmptyString: false,
  debug: false,
});

export const DEFAULT_OPTIONS: DetectorOptions = {
  order: ["querystring", "cookie", "header"],
  lookupQueryString: "lang",
  lookupCookie: "app_language",
  lookupFromHeaderKey: "accept-language",
  lookupFromPathIndex: 0,
  caches: ["cookie"],
  ignoreCase: true,
  fallbackLanguage: "en",
  supportedLanguages: ["en"],
  cookieOptions: {
    sameSite: "Strict",
    secure: true,
    maxAge: 365 * 24 * 60 * 60,
    httpOnly: true,
  },
  debug: false,
};

const detectLanguage = languageDetector(DEFAULT_OPTIONS);

const attachI18n = async (c: Context, next: Next) => {
  const lang = c.get("lang") || DEFAULT_OPTIONS.fallbackLanguage;
  const t = i18next.getFixedT(lang);
  c.set("t", t);
  await next();
};

export const languageMiddleware = [detectLanguage, attachI18n];
