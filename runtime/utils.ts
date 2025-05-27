const regexpHtmlSafe = /["'&<>]/;
const cssBareUnitProps = new Set([
  "animation-iteration-count",
  "aspect-ratio",
  "border-image-outset",
  "border-image-slice",
  "border-image-width",
  "box-flex-group",
  "box-flex",
  "box-ordinal-group",
  "column-count",
  "columns",
  "fill-opacity",
  "flex-grow",
  "flex-negative",
  "flex-order",
  "flex-positive",
  "flex-shrink",
  "flex",
  "flood-opacity",
  "font-weight",
  "grid-area",
  "grid-column-end",
  "grid-column-span",
  "grid-column-start",
  "grid-column",
  "grid-row-end",
  "grid-row-span",
  "grid-row-start",
  "grid-row",
  "line-clamp",
  "line-height",
  "opacity",
  "order",
  "orphans",
  "stop-opacity",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-miterlimit",
  "stroke-opacity",
  "stroke-width",
  "tab-size",
  "widows",
  "z-index",
  "zoom",
]);

export const isString = (v: unknown): v is string => typeof v === "string";
export const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
export const toHyphenCase = (k: string) => k.replace(/[a-z][A-Z]/g, (m) => m.charAt(0) + "-" + m.charAt(1).toLowerCase());

/** merge class names. */
export const cx = (className: unknown): string => {
  if (isString(className)) {
    return className;
  }
  if (isObject(className)) {
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

// @internal
const renderStyle = (style: unknown): string => {
  if (isObject(style)) {
    let css = "";
    for (const [k, v] of Array.isArray(style) ? style : Object.entries(style)) {
      if (isString(v) || typeof v === "number") {
        const cssKey = toHyphenCase(k);
        const cssValue = typeof v === "number" ? (cssBareUnitProps.has(cssKey) ? "" + v : v + "px") : "" + v;
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
