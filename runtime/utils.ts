declare global {
  var $cx: (className: unknown) => string;
  var $applyStyle: (el: Element, style: unknown) => void;
}

const regexpCssBareUnitProps = /acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i; // copied https://github.com/preactjs/preact
const regexpHtmlSafe = /["'&<>]/;

export const isString = (v: unknown): v is string => typeof v === "string";
export const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
export const toHyphenCase = (k: string) => k.replace(/[a-z][A-Z]/g, (m) => m.charAt(0) + "-" + m.charAt(1).toLowerCase());

/** merge class names. */
export const cx = (className: unknown): string => {
  if (typeof className === "string") {
    return className;
  }
  if (typeof className === "object" && className !== null) {
    if (Array.isArray(className)) {
      return className.map(cx).filter(Boolean).join(" ");
    }
    return Object.entries(className).filter(([, v]) => !!v).map(([k]) => k).join(" ");
  }
  return "";
};

/** converts style object to css string. */
export const styleToCSS = (style: Record<string, unknown>): { inline?: string; css?: Array<string | null> } => {
  const inline: [string, string | number][] = [];
  const css: Array<string | null> = [];
  const ret: ReturnType<typeof styleToCSS> = new NullProtoObj();
  for (const [k, v] of Object.entries(style)) {
    switch (k.charCodeAt(0)) {
      case /* ':' */ 58:
        css.push(null, k + "{" + renderStyle(v) + "}");
        break;
      case /* '@' */ 64:
        css.push(k + "{", null, "{" + renderStyle(v) + "}}");
        break;
      case /* '&' */ 38:
        css.push(null, k.slice(1) + "{" + renderStyle(v) + "}");
        break;
      default:
        inline.push([k, v as string | number]);
    }
  }
  if (inline.length > 0) {
    ret.inline = renderStyle(inline);
  }
  if (css.length > 0) {
    ret.css = css;
  }
  return ret;
};

export const applyStyle = (el: Element, style: Record<string, unknown>): void => {
  const { inline, css } = styleToCSS(style);
  if (css) {
    const propPrefix = "data-css-";
    const selector = "[" + propPrefix + (Date.now() + Math.random()).toString(36).replace(".", "") + "]";
    document.head.appendChild(document.createElement("style")).textContent = (inline ? selector + "{" + inline + "}" : "")
      + css.map(v => v === null ? selector : v).join("");
    el.getAttributeNames().forEach((name) => name.startsWith(propPrefix) && el.removeAttribute(name));
    el.setAttribute(selector.slice(1, -1), "");
  } else if (inline) {
    el.setAttribute("style", inline);
  }
};

// @internal
const renderStyle = (style: unknown): string => {
  if (typeof style === "object" && style !== null) {
    let css = "";
    for (const [k, v] of Array.isArray(style) ? style : Object.entries(style)) {
      if (isString(v) || typeof v === "number") {
        const cssKey = toHyphenCase(k);
        const cssValue = typeof v === "number" ? (regexpCssBareUnitProps.test(k) ? "" + v : v + "px") : "" + v;
        css += (css ? ";" : "") + cssKey + ":" + (cssKey === "content" ? JSON.stringify(cssValue) : cssValue);
      }
    }
    return css;
  }
  return "";
};

// Fastest way for creating null-prototype objects in JavaScript
// copyied from https://github.com/h3js/rou3/blob/main/src/_utils.ts
// by @pi0
export const NullProtoObj = /* @__PURE__ */ (() => {
  function e() {}
  e.prototype = Object.freeze(Object.create(null));
  return e;
})() as unknown as { new(): Record<string, any> };

/**
 * Escapes special characters and HTML entities in a given html string.
 * Based on https://github.com/component/escape-html
 * Use `Bun.escapeHTML` preferentially if available.
 *
 * Copyright(c) 2012-2013 TJ Holowaychuk
 * Copyright(c) 2015 Andreas Lubbe
 * Copyright(c) 2015 Tiancheng "Timothy" Gu
 * MIT License
 */
export const escapeHTML = (str: string): string => {
  const match = regexpHtmlSafe.exec(str);
  if (!match) {
    return str;
  }

  // @ts-ignore use bun's built-in `escapeHTML` function if available
  if (typeof Bun === "object" && "escapeHTML" in Bun) return Bun.escapeHTML(str);

  let escape: string;
  let index: number;
  let lastIndex = 0;
  let html = "";

  for (index = match.index; index < str.length; index++) {
    switch (str.charCodeAt(index)) {
      case 34: // "
        escape = "&quot;";
        break;
      case 38: // &
        escape = "&amp;";
        break;
      case 39: // '
        escape = "&#x27;"; // modified from escape-html; used to be '&#39'
        break;
      case 60: // <
        escape = "&lt;";
        break;
      case 62: // >
        escape = "&gt;";
        break;
      default:
        continue;
    }

    if (lastIndex !== index) {
      html += str.slice(lastIndex, index);
    }

    lastIndex = index + 1;
    html += escape;
  }

  return lastIndex !== index ? html + str.slice(lastIndex, index) : html;
};
