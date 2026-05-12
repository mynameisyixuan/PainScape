// src/i18n/i18nContext.js
import React, { createContext, useContext, useMemo } from "react";
import translations from "./translations";

const I18nContext = createContext();

/**
 * 深度获取翻译文本
 * 支持嵌套路径，如 "result.partner.title"
 * 支持模版变量替换，如 "{{count}} 位"
 */
function t(obj, path, variables = {}) {
  if (!obj || !path) return path;

  const keys = path.split(".");
  let value = obj;

  for (const key of keys) {
    if (value === undefined || value === null) return path;
    value = value[key];
  }

  // 如果是数组，直接返回数组（不进行字符串替换）
  if (Array.isArray(value)) {
    return value;
  }

  // 如果不是字符串，也直接返回
  if (typeof value !== "string") return value;

  // 替换模版变量
  return value.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return variables[key] !== undefined ? variables[key] : `{{${key}}}`;
  });
}

export function I18nProvider({ lang, children }) {
  const value = useMemo(() => {
    const texts = translations[lang] || translations.zh;
    return {
      lang,
      t: (path, vars) => t(texts, path, vars),
      texts,
    };
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}

export { translations };