declare global {
  var $cx: (className: unknown) => string;
  var $applyStyle: (el: Element, style: unknown) => void;
}

export const regexpIsNonDimensional =
  /^(-|f[lo].*[^se]$|g.{5,}[^ps]$|z|o[pr]|(W.{5})?[lL]i.*(t|mp)$|an|(bo|s).{4}Im|sca|m.{6}[ds]|ta|c.*[st]$|wido|ini)/; // copied from https://github.com/preactjs/preact/blob/main/compat/src/util.js
export const regexpHtmlSafe = /["'&<>]/;
export const cssIds = new Set<number>();

export const isString = (v: unknown): v is string => typeof v === "string";
export const isFunction = (v: unknown): v is Function => typeof v === "function";
export const isObject = (v: unknown): v is object => typeof v === "object" && v !== null;
export const isPlainObject = (v: unknown): v is Record<string, unknown> => !!v && (v.constructor === Object || v.constructor === undefined);
export const toHyphenCase = (k: string) => k.replace(/[a-z][A-Z]/g, (m) => m.charAt(0) + "-" + m.charAt(1).toLowerCase());

export class IdGen<T> extends Map<T, number> {
  #seq = 0;
  gen(v: T) {
    return this.get(v) ?? this.set(v, this.#seq++).get(v)!;
  }
  getById(id: number): T | void {
    for (const [v, i] of this.entries()) {
      if (i === id) {
        return v;
      }
    }
  }
}

/** calculates the hash code (32-bit) of a string. */
export const hashCode = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
  }
  return hash;
};

/** merge class names. */
export const cx = (className: unknown): string => {
  if (typeof className === "string") {
    return className;
  }
  if (typeof className === "object" && className !== null) {
    return (
      Array.isArray(className)
        ? className.map(cx).filter(Boolean)
        : Object.entries(className).filter(([, v]) => !!v).map(([k]) => k)
    ).join(" ");
  }
  return "";
};

/** applies the style to the page. */
export const applyStyle = (el: Element, style: Record<string, unknown>): void => {
  const { inline, css } = styleToCSS(style);
  if (css) {
    const prefix = "data-css-";
    const id = hashCode((inline ?? "") + css.join(""));
    const attrName = prefix + id.toString(36);
    const selector = "[" + attrName + "]";
    if (!cssIds.has(id)) {
      cssIds.add(id);
      document.head.appendChild(document.createElement("style")).textContent = (inline ? selector + "{" + inline + "}" : "")
        + css.map(v => v === null ? selector : v).join("");
    }
    el.getAttributeNames().forEach(name => name.startsWith(prefix) && el.removeAttribute(name));
    el.setAttribute(attrName, "");
  } else if (inline) {
    el.setAttribute("style", inline);
  }
};

/** converts style object to css string. */
export const styleToCSS = (style: Record<string, unknown>): { inline?: string; css?: Array<string | null> } => {
  let inline: Record<string, unknown> | undefined;
  let css: Array<string | null> = [];
  let ret: ReturnType<typeof styleToCSS> = new NullPrototypeObject();
  for (const [k, v] of Object.entries(style)) {
    switch (k.charCodeAt(0)) {
      case /* ':' */ 58:
        if (isPlainObject(v)) {
          css.push(k.startsWith("::view-") ? "" : null, k + renderStyle(v));
        }
        break;
      case /* '@' */ 64:
        if (isPlainObject(v)) {
          if (k.startsWith("@keyframes ")) {
            css.push(k + "{" + Object.entries(v).map(([p, s]) => isPlainObject(s) ? p + renderStyle(s) : "").join("") + "}");
          } else if (k.startsWith("@view-")) {
            css.push(k + renderStyle(v));
          } else {
            css.push(k + "{", null, renderStyle(v) + "}");
          }
        }
        break;
      case /* '&' */ 38:
        if (isPlainObject(v)) {
          css.push(null, k.slice(1) + renderStyle(v));
        }
        break;
      default:
        inline ??= {};
        inline[k] = v;
    }
  }
  if (inline) {
    ret.inline = renderStyle(inline).slice(1, -1);
  }
  if (css.length > 0) {
    ret.css = css;
  }
  return ret;
};

export const renderStyle = (style: Record<string, unknown>): string => {
  let css = "";
  for (const [k, v] of Object.entries(style)) {
    const vt = typeof v;
    if (vt === "string" || vt === "number") {
      const cssKey = toHyphenCase(k);
      const cssValue = vt === "number" ? (regexpIsNonDimensional.test(k) ? "" + v : v + "px") : "" + v;
      css += (css ? ";" : "") + cssKey + ":" + (cssKey === "content" ? JSON.stringify(cssValue) : cssValue);
    }
  }
  return "{" + css + "}";
};

// Fastest way for creating null-prototype objects in JavaScript
// copyied from https://github.com/h3js/rou3/blob/main/src/_utils.ts
// by @pi0
export const NullPrototypeObject = /* @__PURE__ */ (() => {
  function ONP() {}
  ONP.prototype = Object.create(null);
  return ONP;
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

/**
 * Escapes special characters and HTML entities in a given html string.
 * Use `document.createElement("div").textContent = text` instead of `escapeHTML` in browser.
 */
export const domEscapeHTML = (text: string): string => {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
};
