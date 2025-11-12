/**
 * Provides type definitions in JSX for htmx attributes.
 * @link https://github.com/Desdaemon/typed-htmx
 * @module
 */

/**
 * Either `"true"` or `"false"`.
 */
type BoolStr = "true" | "false";
type AnyStr = string & {};
type HxSwap =
  | "innerHTML"
  | "outerHTML"
  | "beforebegin"
  | "afterbegin"
  | "beforeend"
  | "afterend"
  | "delete"
  | "none"
  | "morph"
  | "morphdom"
  | "multi:";

/**
 * Either `this` which refers to the element itself, or a modifier followed by a CSS selector, e.g. `closest form`.
 */
type HxTarget = "this" | "closest " | "find " | "next" | "next " | "previous" | "previous ";

/**
 * A CSS selector, followed by one of these sync strategies, e.g. `form:abort`.
 */
type HxSync = ":drop" | ":abort" | ":replace" | ":queue" | ":queue first" | ":queue last" | ":queue all";

/**
 * Any of the standard DOM events, or htmx-specific events.
 */
type HxTriggers = keyof GlobalEventHandlersEventMap | HtmxUtils.HtmxEvents;

/** @ignore */
declare namespace HtmxUtils {
  type HxOnMap =
    & { [K in keyof GlobalEventHandlersEventMap as `hx-on-${K}`]?: string }
    & { [K in HxOnHtmxEvents as `hx-on--${K}`]?: string };

  type HxOnHtmxEvents =
    | JsxHtmxEvents
    | keyof { [K in keyof HxSubevents as `${K}-${HxSubevents[K]}`]: never };

  type JsxHtmxEvents =
    | "abort"
    | "after-on-load"
    | "after-process-node"
    | "after-request"
    | "after-settle"
    | "after-swap"
    | "before-cleanup-element"
    | "before-on-load"
    | "before-process-node"
    | "before-request"
    | "before-swap"
    | "before-send"
    | "config-request"
    | "confirm"
    | "history-cache-error"
    | "history-cache-miss"
    | "history-cache-miss-error"
    | "history-cache-miss-load"
    | "history-restore"
    | "before-history-save"
    | "load"
    | "no-sse-source-error"
    | "on-load-error"
    | "oob-after-swap"
    | "oob-before-swap"
    | "oob-error-no-target"
    | "prompt"
    | "pushed-into-history"
    | "response-error"
    | "send-error"
    | "sse-error"
    | "sse-open"
    | "swap-error"
    | "target-error"
    | "timeout";

  type HxSubevents = {
    validation: "validate" | "failed" | "halted";
    xhr: "abort" | "loadend" | "loadstart" | "progress";
  };

  type KebabToCamel<T extends string> = T extends `${infer Head}-${infer Rest}` ? `${Head}${KebabToCamel<Capitalize<Rest>>}`
    : T;

  type HtmxEvents =
    | `htmx:${KebabToCamel<JsxHtmxEvents>}`
    | keyof { [K in keyof HxSubevents as `htmx:${K}:${HxSubevents[K]}`]: never };
}

/**
 * An event followed by one of these modifiers, e.g. `click once`.
 */
type HxTriggerModifier =
  | " once"
  | " changed"
  | " delay:"
  | " throttle:"
  | " from:"
  | " target:"
  | " consume"
  | " queue:first"
  | " queue:last"
  | " queue:all"
  | " queue:none";

/**
 * An extensible directory of htmx extensions.
 *
 * ### Declaring a new extension
 *
 * ```tsx twoslash
 * // in foo.d.ts:
 *
 * declare global {
 *   namespace JSX {
 *     interface HtmxExtensions {
 *       myExtension: "my-extension";
 *     }
 *     interface HtmlTag {
 *       /** Describe your attribute *\/
 *       ["my-extension-attr"]?: "true" | "false";
 *       // Add any other attributes your extension uses here
 *     }
 *   }
 * }
 *
 * <div hx-ext="my-extension">
 *   <span my-extension-attr="true">Hello</span>
 * //      ^?
 * </div>
 * ```
 */
interface HtmxBuiltinExtensions {
  /**
   * Includes the commonly-used `X-Requested-With` header that identifies ajax requests in many backend frameworks.
   *
   * CDN: https://unpkg.com/htmx.org/dist/ext/ajax-header.js
   * @see https://htmx.org/extensions/ajax-header/
   */
  ajaxHeaders: "ajax-headers";
  /**
   * Uses the Alpine.js morph plugin to swap content.
   *
   * CDN: https://unpkg.com/htmx.org/dist/ext/alpine-morph.js
   * @see https://htmx.org/extensions/alpine-morph/
   */
  alpineMorph: "alpine-morph";
  /**
   * Ingest [server-sent events].
   *
   * CDN: https://unpkg.com/htmx.org/dist/ext/sse.js
   * @see https://htmx.org/extensions/server-sent-events/
   *
   * [server-sent Events]: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events
   */
  serverSentEvents: "sse";
  /**
   * WebSockets support.
   *
   * CDN: https://unpkg.com/htmx.org/dist/ext/ws.js
   * @see https://htmx.org/extensions/web-sockets/
   */
  ws: "ws";
  /**
   * Class utilities.
   *
   * CDN: https://unpkg.com/htmx.org/dist/ext/class-tools.js
   * @see https://htmx.org/extensions/class-tools/
   */
  classTools: "class-tools";
  /**
   * Transforms JSON/XML responses into HTML.
   *
   * CDN: https://unpkg.com/htmx.org/dist/ext/client-side-templates.js
   * @see https://htmx.org/extensions/client-side-templates/
   */
  clientSideTemplates: "client-side-templates";
  /**
   * Tool for debugging htmx requests.
   *
   * CDN: https://unpkg.com/htmx.org/dist/ext/debug.js
   * @see https://htmx.org/extensions/debug/
   */
  debug: "debug";
  /**
   * Disable elements during requests.
   *
   * CDN: https://unpkg.com/htmx.org/dist/ext/disable-element.js
   * @see https://htmx.org/extensions/disable-element/
   * @deprecated 1.9.6: Included into htmx core as `hx-disabled-elt`.
   */
  disableElement: "disable-element";
  /**
   * Includes the JSON of the event that triggered a request
   * to the `Triggering-Event` header.
   *
   * CDN: https://unpkg.com/htmx.org/dist/ext/event-header.js
   * @see https://htmx.org/extensions/event-header/
   */
  eventHeader: "event-header";
  /**
   * Support for adding tags to `<head>`.
   *
   * CDN: https://unpkg.com/htmx.org/dist/ext/head-support.js
   * @see https://htmx.org/extensions/head-support/
   */
  headSupport: "head-support";
  /**
   * Include additional data in requests.
   *
   * CDN: https://unpkg.com/htmx.org/dist/ext/include-vals.js
   */
  includeVals: "include-vals";
  /**
   * Support for [Idiomorph](https://github.com/bigskysoftware/idiomorph), an alternative swapping mechanism for htmx.
   *
   * CDN: https://unpkg.com/idiomorph/dist/idiomorph-ext.min.js
   * @see https://github.com/bigskysoftware/idiomorph#htmx
   */
  idiomorph: "morph";
  /**
   * Use JSON encoding in the body of requests, rather than the default `x-www-form-urlencoded`.
   *
   * CDN: https://unpkg.com/htmx.org/dist/ext/json-enc.js
   * @see https://htmx.org/extensions/json-enc/
   */
  jsonEncode: "json-enc";
  /**
   * Support for inflight loading states.
   *
   * CDN: https://unpkg.com/htmx.org/dist/ext/loading-states.js
   * @see https://htmx.org/extensions/loading-states/
   */
  loadingStates: "loading-states";
  /**
   * Support for [morphdom](https://github.com/patrick-steele-idem/morphdom),
   * an alternative swapping mechanism for htmx.
   *
   * CDN: https://unpkg.com/htmx.org/dist/ext/morphdom-swap.js
   * @see https://htmx.org/extensions/morphdom-swap/
   */
  morphdomSwap: "morphdom-swap";
  /**
   * Use `X-HTTP-Method-Override` for non-GET and -POST requests.
   * Useful for bypassing firewalls or proxies.
   *
   * CDN: https://unpkg.com/htmx.org/dist/ext/method-override.js
   * @see https://htmx.org/extensions/method-override/
   */
  methodOverride: "method-override";
  /**
   * Swap multiple elements marked with IDs, each optionally followed by a swap style.
   *
   * CDN: https://unpkg.com/htmx.org/dist/ext/multi-swap.js
   * @see https://htmx.org/extensions/multi-swap/
   */
  multiSwap: "multi-swap";
  /**
   * Express dependencies between requests.
   *
   * CDN: https://unpkg.com/htmx.org/dist/ext/path-deps.js
   * @see https://htmx.org/extensions/path-deps/
   */
  pathDeps: "path-deps";
  /**
   * Preload HTML fragments.
   *
   * CDN: https://unpkg.com/htmx.org/dist/ext/preload.js
   * @see https://htmx.org/extensions/preload/
   */
  preload: "preload";
  /**
   * Remove this element after a set duration.
   *
   * CDN: https://unpkg.com/htmx.org/dist/ext/remove-me.js
   * @see https://htmx.org/extensions/remove-me/
   */
  removeMe: "remove-me";
  /**
   * Specify different target elements for different HTTP response codes.
   *
   * CDN: https://unpkg.com/htmx.org/dist/ext/response-targets.js
   * @see https://htmx.org/extensions/response-targets/
   */
  responseTargets: "response-targets";
  /**
   * Triggers an event `restored` when a back button event is detected while using `hx-boost`.
   *
   * CDN: https://unpkg.com/htmx.org/dist/ext/restored.js
   * @see https://htmx.org/extensions/restored/
   */
  restored: "restored";
  /**
   * Use specific parameters as path variables.
   *
   * CDN: https://unpkg.com/htmx.org/dist/ext/path-params.js
   * @see https://htmx.org/extensions/path-params/
   */
  pathParams: "path-params";
}

/**
 * Definitions for htmx attributes up to 1.9.10.
 *
 * ###### Path variables
 * `hx-get`, `hx-post` and other request attributes can include path variables by
 * using the {@linkcode HtmxBuiltinExtensions.pathParams path-params} extension.
 * Once used as a path variable, it will not be included in the request body.
 * ```jsx twoslash
 * <button hx-post="/api/user/{id}" hx-vals="{'id': 1,'foo':true}" hx-ext="path-params">...</button>
 * // Only 'foo' will be included in the request body
 * ```
 */
interface HtmxAttributes extends HtmxUtils.HxOnMap {
  /** @ignore For React compatibility only. */
  // children?: {} | null;
  /** @ignore For React compatibility only. */
  // key?: {};
  /**
   * Issues a `GET` to the specified URL.
   * @see https://htmx.org/attributes/hx-get/
   * @category Core
   */
  ["hx-get"]?: string;
  /**
   * Issues a `POST` to the specified URL.
   * @see https://htmx.org/attributes/hx-post/
   * @category Core
   */
  ["hx-post"]?: string;
  /**
   * Issues a `PUT` to the specified URL.
   * @see https://htmx.org/attributes/hx-put/
   */
  ["hx-put"]?: string;
  /**
   * Issues a `DELETE` to the specified URL.
   * @see https://htmx.org/attributes/hx-delete/
   */
  ["hx-delete"]?: string;
  /**
   * Issues a `PATCH` to the specified URL.
   * @see https://htmx.org/attributes/hx-patch/
   */
  ["hx-patch"]?: string;
  /**
   * Add or remove [progressive enhancement](https://developer.mozilla.org/en-US/docs/Glossary/Progressive_Enhancement)
   * for links and forms.
   *
   * @see https://htmx.org/attributes/hx-boost/
   * @category Core
   */
  ["hx-boost"]?: BoolStr;
  /**
   * Handle any event with a script inline.
   * @see https://htmx.org/attributes/hx-on/
   * @category Core
   * @remarks Event listeners on htmx-specific events need to be specified with a spread attribute, and
   * 			 		are otherwise not supported in vanilla JSX.
   *          Alternatively, use the `hx-on-` all-dash syntax. (since 1.9.10)
   * ```jsx
   * <div {...{'hx-on::before-request': '...'}} />
   * ```
   * @since 1.9.3
   */
  ["hx-on:"]?: string;
  /**
   * Alternative syntax for `hx-on:`.
   *
   * All colons in event handlers can be replaced with a dash, i.e.
   * `hx-on:click` becomes `hx-on-click`, `hx-on::before-request` becomes `hx-on--before-request` and so on.
   * @see https://htmx.org/attributes/hx-on/
   * @category Core
   * @since 1.9.10
   */
  ["hx-on-"]?: string;
  /**
   * Handle any event with a script inline. Each listener is specified on a separate line.
   * @see https://htmx.org/attributes/hx-on/
   * @remarks Superseded by `hx-on:$event`, unless IE11 support is required.
   * @since 1.9.0
   */
  ["hx-on"]?: HxTriggers | AnyStr;
  /**
   * Pushes the URL into the browser location bar, creating a new history entry.
   * @see https://htmx.org/attributes/hx-push-url/
   * @category Core
   */
  ["hx-push-url"]?: BoolStr | AnyStr;
  /**
   * CSS selector for content to swap in from a response.
   * @see https://htmx.org/attributes/hx-select/
   * @category Core
   */
  ["hx-select"]?: string;
  /**
   * CSS selector for content to swap in from a response, out of band (somewhere other than the target).
   * @see https://htmx.org/attributes/hx-select-oob/
   * @category Core
   */
  ["hx-select-oob"]?: string;
  /**
   * Controls how content is swapped in (`outerHTML`, `beforeend`, `afterend`, …).
   * @default htmx.config.defaultSwapStyle // 'innerHTML'
   * @see https://htmx.org/attributes/hx-swap/
   * @see [`InsertPosition`](https://developer.mozilla.org/en-US/docs/Web/API/Element/insertAdjacentHTML#position) which is used in `Element.insertAdjacentHTML`.
   * @category Core
   * @remarks
   * - `morph` is observed by the {@linkcode HtmxBuiltinExtensions.idiomorph idiomorph} extension.
   *   Also see {@linkcode HtmxBuiltinExtensions.alpineMorph alpine-morph}.
   * - `morphdom` swaps are observed by the {@linkcode HtmxBuiltinExtensions.morphdomSwap morphdom-swap} extension.
   * - `multi:` swaps are observed by the {@linkcode HtmxBuiltinExtensions.multiSwap multi-swap} extension.
   * @since 1.9.6: `hx-swap` can be specified without any swap style.
   */
  ["hx-swap"]?: true | HxSwap | AnyStr;
  /**
   * Marks content in a response to be out of band (should swap in somewhere other than the target).
   * @see https://htmx.org/attributes/hx-swap-oob/
   */
  ["hx-swap-oob"]?: "true" | HxSwap | AnyStr;
  /**
   * Specifies the target element to be swapped.
   *
   * Accepts a CSS selector, optionally preceded by a {@link HxTarget modifier}.
   * @see https://htmx.org/attributes/hx-target/
   * @category Core
   */
  ["hx-target"]?: HxTarget | AnyStr;
  /**
   * Specifies the target element to be swapped, when a specific error code is encountered.
   *
   * Error codes may also be specified as wildcards, e.g. `hx-target-5*` or `hx-target-5x`.
   * @see https://htmx.org/extensions/response-targets/
   * @category Extensions
   */
  ["hx-target-"]?: HxTarget | AnyStr;
  /**
   * Specifies a catch-all target element to be swapped when a 4xx or 5xx response is encountered.
   * @see https://htmx.org/extensions/response-targets/
   * @category Extensions
   */
  ["hx-target-error"]?: HxTarget | AnyStr;
  /**
   * Specifies the event that triggers the request.
   *
   * Accepts {@link HxTriggers names} of standard DOM events, or htmx-specific events.
   * Optionally followed by a {@link HxTriggerModifier modifier}.
   * @see https://htmx.org/attributes/hx-trigger/
   * @category Core
   * @remarks
   * - `sse:` is observed by the {@linkcode HtmxBuiltinExtensions.serverSentEvents server-sent-events} extension.
   * - `path-deps` is observed by the {@linkcode HtmxBuiltinExtensions.pathDeps path-deps} extension.
   * - `restored` is observed by the {@linkcode HtmxBuiltinExtensions.restored restored} extension.
   */
  ["hx-trigger"]?: "every " | HxTriggerModifier | HxTriggers | "sse:" | "path-deps" | "restored" | AnyStr;
  /**
   * Adds values to the parameters to submit with the request (JSON-formatted).
   *
   * Objects may be passed only if supported by the JSX renderer.
   * @see https://htmx.org/attributes/hx-params/
   * @category Core
   */
  ["hx-vals"]?: AnyStr | "javascript:" | "js:" | Record<PropertyKey, unknown>;
  /**
   * Shows a `confirm()` dialog before issuing a request.
   * @see https://htmx.org/attributes/hx-confirm/
   */
  ["hx-confirm"]?: string;
  /**
   * Disables htmx processing for the given node and any children nodes.
   * Useful for escaping user-generated content.
   * @see https://htmx.org/attributes/hx-disable/
   */
  ["hx-disable"]?: true;
  /**
   * Marks the element to be disabled during a request.
   * Multiple elements are separated by commas.
   * @see https://htmx.org/attributes/hx-disabled-elt/
   * @since 1.9.6
   */
  ["hx-disabled-elt"]?: "this" | "closest " | AnyStr;
  /**
   * Control and disable automatic attribute inheritance for child nodes.
   * @see https://htmx.org/attributes/hx-disinherit/
   */
  ["hx-disinherit"]?: "*" | AnyStr;
  /**
   * Changes the request encoding type.
   * @see https://htmx.org/attributes/hx-encoding/
   */
  ["hx-encoding"]?: "multipart/form-data";
  /**
   * Extensions to apply to this element and its descendants.
   * @see https://htmx.org/attributes/hx-ext/
   * @see {@linkcode HtmxBuiltinExtensions} for extension details, and how to declare extensions in JSX.
   */
  ["hx-ext"]?: JSX.HtmxExtensions[keyof JSX.HtmxExtensions] | "ignore:" | AnyStr;
  /**
   * Adds to the headers that will be submitted with the request.
   *
   * Objects may be passed only if supported by the JSX renderer.
   * @see https://htmx.org/attributes/hx-headers/
   */
  ["hx-headers"]?: AnyStr | "javascript:" | "js:" | Record<PropertyKey, unknown>;
  /**
   * Prevent sensitive data being saved to the history cache.
   * @see https://htmx.org/attributes/hx-history/
   */
  ["hx-history"]?: "false";
  /**
   * Mark the element to snapshot and restore during history navigation.
   * @see https://htmx.org/attributes/hx-history-elt/
   */
  ["hx-history-elt"]?: true;
  /**
   * Include additional data in requests.
   * Accepts CSS selectors.
   * @see https://htmx.org/attributes/hx-include/
   */
  ["hx-include"]?: "this" | "closest " | "find " | "next " | "previous " | AnyStr;
  /**
   * The element to put the `htmx-request` class on during the request.
   * Accepts CSS selectors.
   * @see https://htmx.org/attributes/hx-indicator/
   */
  ["hx-indicator"]?: "closest " | AnyStr;
  /**
   * Filters the parameters that will be submitted with a request.
   * @see https://htmx.org/attributes/hx-params/
   */
  ["hx-params"]?: "*" | "none" | "not " | AnyStr;
  /**
   * Specifies elements to keep unchanged between requests.
   * An ID on the element is also required, and is the only criterion for preservation.
   * @see https://htmx.org/attributes/hx-preserve/
   * @remarks This attribute is observed by the [`head-support`] extension,
   *          where it prevents an element from being removed from `<head>`.
   *
   * [`head-support`]: https://htmx.org/extensions/head-support/
   */
  ["hx-preserve"]?: "true";
  /**
   * Shows a `prompt()` before submitting a request.
   * @see https://htmx.org/attributes/hx-prompt/
   */
  ["hx-prompt"]?: string;
  /**
   * Replace the URL in the browser location bar.
   * @see https://htmx.org/attributes/hx-replace-url/
   */
  ["hx-replace-url"]?: BoolStr | AnyStr;
  /**
   * Configures various aspects of the request.
   * @see https://htmx.org/attributes/hx-request/
   */
  ["hx-request"]?: '"timeout":' | '"credentials":' | '"noHeaders":' | "javascript:" | "js:" | AnyStr;
  /**
   * Control how requests made by different elements are synchronized.
   *
   * Accepts a CSS selector, optionally followed by a colon and a {@link HxSync sync strategy}.
   * @see https://htmx.org/attributes/hx-sync/
   */
  ["hx-sync"]?: HxSync | "this" | "closest " | AnyStr;
  /**
   * Force elements to validate themselves before a request.
   * @see https://htmx.org/attributes/hx-validate/
   */
  ["hx-validate"]?: "true";
  /**
   * Adds values dynamically to the parameters to submit with the request.
   * @deprecated superseded by `hx-vals`
   */
  ["hx-vars"]?: AnyStr;
  /**
   * The URL of the SSE server.
   * @see https://htmx.org/extensions/server-sent-events/
   * @category Extensions
   */
  ["sse-connect"]?: string;
  /**
   * The name of the message to swap into the DOM.
   * @see https://htmx.org/extensions/server-sent-events/
   * @category Extensions
   */
  ["sse-swap"]?: string;
  /**
   * A URL to establish a WebSocket connection against.
   * @see https://htmx.org/extensions/web-sockets/
   * @category Extensions
   */
  ["ws-connect"]?: string;
  /**
   * Sends a message to the nearest websocket based on the trigger value for the element.
   * @see https://htmx.org/extensions/web-sockets/
   * @category Extensions
   */
  ["ws-send"]?: boolean;
  /**
   * Apply class transitions on this element.
   * @see https://htmx.org/extensions/class-tools/
   * @category Extensions
   */
  ["classes"]?: "add " | "remove " | "toggle " | AnyStr;
  /**
   * The element or elements to disable during requests.
   * Accepts CSS selectors.
   * @see https://htmx.org/extensions/disable-element1.9.6: /
   * @deprecated 1.9.6: superseded by [`hx-disabled-elt`]
   * @category Extensions
   *
   * [`hx-disabled-elt`]: https://htmx.org/attributes/hx-disabled-elt/
   */
  ["hx-disable-element"]?: "self" | AnyStr;
  /**
   * The strategy for merging new head content.
   * @see https://htmx.org/extensions/head-support/
   * @category Extensions
   */
  ["hx-head"]?: "merge" | "append" | "re-eval";
  /**
   * The ID of a Mustache `<template>` to render the response with.
   * @see https://htmx.org/extensions/client-side-templates/#full-mustache-html-example
   * @category Extensions
   */
  ["mustache-template"]?: string;
  /**
   * The ID of a Mustache `<template>` to render the response with.
   * Selected when the response is an array.
   * @see https://htmx.org/extensions/client-side-templates/#full-mustache-html-example
   * @category Extensions
   */
  ["mustache-array-template"]?: string;
  /**
   * The ID of a Handlebars `<template>` to render the response with.
   * @see https://htmx.org/extensions/client-side-templates/
   * @category Extensions
   */
  ["handlebars-template"]?: string;
  /**
   * The ID of a Handlebars `<template>` to render the response with.
   * Selected when the response is an array.
   * @see https://htmx.org/extensions/client-side-templates/
   * @category Extensions
   */
  ["handlebars-array-template"]?: string;
  /**
   * The ID of a Nunjucks `<template>` to render the response with.
   * @see https://htmx.org/extensions/client-side-templates/
   * @see https://mozilla.github.io/nunjucks/
   * @category Extensions
   */
  ["nunjucks-template"]?: string;
  /**
   * The ID of a Nunjucks `<template>` to render the response with.
   * Selected when the response is an array.
   * @see https://htmx.org/extensions/client-side-templates/
   * @category Extensions
   */
  ["nunjucks-array-template"]?: string;
  /**
   * The ID of a {@link XSLTProcessor XSLT} `<template>` to render the response with.
   *
   * @see https://htmx.org/extensions/client-side-templates/#full-xslt-html-example
   * @see https://developer.mozilla.org/en-US/docs/Web/XSLT
   * @category Extensions
   */
  ["xslt-template"]?: string;
  /**
   * Include additional data in requests.
   * @see https://htmx.org/extensions/include-vals/
   * @category Extensions
   */
  ["include-vals"]?: string;
  /**
   * Shows this element during a pending request.
   * @see https://htmx.org/extensions/loading-states/
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/display for all possible values
   * @category Extensions
   */
  ["data-loading"]?: true | string;
  /**
   * Adds these classes to this element during a pending request,
   * and removes them when the request is complete.
   * @see https://htmx.org/extensions/loading-states/
   * @category Extensions
   */
  ["data-loading-class"]?: string;
  /**
   * Disables this element for the duration of a pending request.
   * @see https://htmx.org/extensions/loading-states/
   * @category Extensions
   */
  ["data-loading-disable"]?: true;
  /**
   * Removes these classes from this element during a pending request,
   * and adds them back when the request is complete.
   * @see https://htmx.org/extensions/loading-states/
   * @category Extensions
   */
  ["data-loading-class-remove"]?: string;
  /**
   * Adds `aria-busy="true"` to this element for the duration of a pending request.
   * @see https://htmx.org/extensions/loading-states/
   * @category Extensions
   */
  ["data-loading-aria-busy"]?: true;
  /**
   * Only applies loading states after this many milliseconds.
   * @default 200
   * @see https://htmx.org/extensions/loading-states/
   * @category Extensions
   */
  ["data-loading-delay"]?: string;
  /**
   * Specify a different target to apply loading states.
   * Accepts a CSS selector.
   * @see https://htmx.org/extensions/loading-states/
   * @category Extensions
   */
  ["data-loading-target"]?: string;
  /**
   * Only applies loading states for this request.
   * @see https://htmx.org/extensions/loading-states/
   * @category Extensions
   */
  ["data-loading-path"]?: string;
  /**
   * Define a scope for loading states, so only descendants are processed.
   * @see https://htmx.org/extensions/loading-states/
   * @category Extensions
   */
  ["data-loading-states"]?: true;
  /**
   * When any other mutating requests are made to this path (or its subpaths),
   * a request for this element should also be triggered.
   * @see https://htmx.org/extensions/path-deps/
   * @category Extensions
   */
  ["path-deps"]?: string;
  /**
   * Opt into HTML fragment preloading.
   *
   * Only GET requests are preloaded. Note that this attribute is inherited.
   *
   * ###### Image preloading
   * ```html
   * <a href="/.." preload="mouseover" preload-images="true">...</a>
   * ```
   * @default 'mousedown'
   * @see https://htmx.org/extensions/preload/
   * @category Extensions
   */
  ["preload"]?: true | "mousedown" | "mouseover" | AnyStr;
  /**
   * Opt into image preloading.
   * @see https://htmx.org/extensions/preload/
   * @category Extensions
   */
  ["preload-images"]?: "true";
  /**
   * Specify the duration after which this element should be removed.
   * @see https://htmx.org/extensions/remove-me/
   * @category Extensions
   */
  ["remove-me"]?: string;
  /**
   * Attach [hyperscript](https://hyperscript.org/docs) behavior to this element.
   * Available separately from htmx.
   *
   * CDN: https://unpkg.com/hyperscript.org
   */
  _?: AnyStr;
}

/** @ignore */
declare namespace JSX {
  interface HtmxExtensions extends HtmxBuiltinExtensions {}
  interface CustomAttributes extends HtmxAttributes {}
}
