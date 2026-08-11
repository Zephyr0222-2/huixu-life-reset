import { englishTranslations } from "./i18n.generated";

export type Locale = "zh-CN" | "en";

export const languageStorageKey = "huixu-language";

const reverseTranslations = Object.fromEntries(Object.entries(englishTranslations).map(([chinese, english]) => [english, chinese]));
const englishSpacingOverrides: Readonly<Record<string, string>> = {
  "完成条件：": "Completion criteria: ",
  "适合：": "Best for: ",
  "规则：": "How it works: ",
  "打开生活盲盒\u00a0 ›": "Open Life Spark\u00a0 ›",
  "天记录保存在本机": " days of records stored locally",
  "当前未开启": "Currently off",
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type TemplateTranslation = { pattern: RegExp; target: string };

function buildTemplates(dictionary: Readonly<Record<string, string>>) {
  return Object.entries(dictionary)
    .filter(([source]) => /\{value\d+\}/.test(source))
    .map(([source, target]) => {
      const parts = source.split(/(\{value\d+\})/g);
      let captures = 0;
      const pattern = parts.map((part) => {
        if (/^\{value\d+\}$/.test(part)) {
          captures += 1;
          return "([\\s\\S]*?)";
        }
        return escapeRegExp(part);
      }).join("");
      return { pattern: new RegExp(`^${pattern}$`), target } satisfies TemplateTranslation;
    })
    .sort((a, b) => b.pattern.source.length - a.pattern.source.length);
}

const englishTemplates = buildTemplates(englishTranslations);
const chineseTemplates = buildTemplates(reverseTranslations);
const textSources = new WeakMap<Node, { source: string; rendered: string }>();
const attributeSources = new WeakMap<Element, Map<string, { source: string; rendered: string }>>();

function translateCore(value: string, locale: Locale, depth = 0) {
  if (locale === "en") {
    const monthDay = value.match(/^(\d{1,2})月(\d{1,2})日$/);
    if (monthDay) return `${monthDay[1]}/${monthDay[2]}`;
    const yearMonth = value.match(/^(\d{4})年(\d{1,2})月$/);
    if (yearMonth) return new Intl.DateTimeFormat("en", { year: "numeric", month: "long" }).format(new Date(Number(yearMonth[1]), Number(yearMonth[2]) - 1, 1));
  }
  const exact = locale === "en" ? englishSpacingOverrides[value] ?? englishTranslations[value] : reverseTranslations[value];
  if (exact !== undefined) return exact;
  if (depth >= 3) return value;
  const templates = locale === "en" ? englishTemplates : chineseTemplates;
  for (const template of templates) {
    const match = template.pattern.exec(value);
    if (match) {
      let translated = template.target;
      for (let index = 1; index < match.length; index += 1) {
        const captured = match[index];
        translated = translated.replaceAll(`{value${index}}`, captured === value ? captured : translateCore(captured, locale, depth + 1));
      }
      return translated;
    }
  }
  return value;
}

export function translateText(value: string, locale: Locale) {
  if (!value) return value;
  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  const core = value.slice(leading.length, value.length - trailing.length || undefined);
  return `${leading}${translateCore(core, locale)}${trailing}`;
}

export function initialLocale() : Locale {
  if (typeof window === "undefined") return "zh-CN";
  const saved = localStorage.getItem(languageStorageKey);
  if (saved === "en" || saved === "zh-CN") return saved;
  if (window.location.pathname === "/en" || window.location.pathname.startsWith("/en/")) return "en";
  if (localStorage.getItem("huixu-v1-state")) return "zh-CN";
  return navigator.language.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}

export function persistLocale(locale: Locale) {
  localStorage.setItem(languageStorageKey, locale);
}

export function translateDocument(root: ParentNode, locale: Locale) {
  const documentRoot = root instanceof Document ? root.documentElement : root;
  const walker = document.createTreeWalker(documentRoot, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const parent = node.parentElement;
    if (parent && !parent.closest("[data-no-translate]") && !["SCRIPT", "STYLE", "NOSCRIPT"].includes(parent.tagName)) {
      const current = node.nodeValue ?? "";
      const cached = textSources.get(node);
      const source = cached && current === cached.rendered ? cached.source : locale === "zh-CN" ? translateText(current, locale) : current;
      const translated = locale === "en" ? translateText(source, locale) : source;
      textSources.set(node, { source, rendered: translated });
      if (translated !== current) node.nodeValue = translated;
    }
    node = walker.nextNode();
  }
  documentRoot.querySelectorAll<HTMLElement>("[placeholder], [aria-label], [title], [alt]").forEach((element) => {
    if (element.closest("[data-no-translate]")) return;
    ["placeholder", "aria-label", "title", "alt"].forEach((attribute) => {
      const current = element.getAttribute(attribute);
      if (!current) return;
      const cache = attributeSources.get(element) ?? new Map<string, { source: string; rendered: string }>();
      const cached = cache.get(attribute);
      const source = cached && current === cached.rendered ? cached.source : locale === "zh-CN" ? translateText(current, locale) : current;
      const translated = locale === "en" ? translateText(source, locale) : source;
      cache.set(attribute, { source, rendered: translated });
      attributeSources.set(element, cache);
      if (translated !== current) element.setAttribute(attribute, translated);
    });
  });
}
