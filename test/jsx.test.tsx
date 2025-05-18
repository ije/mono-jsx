import { assert, assertEquals } from "jsr:@std/assert";
import { $fragment, $html, $vnode } from "../symbols.ts";
import type { VNode } from "../types/jsx.d.ts";

Deno.test("[jsx] jsx transform", () => {
  // basic html element
  assertEquals(
    <h1>Welcome to mono-jsx!</h1> as VNode,
    [
      "h1",
      { children: "Welcome to mono-jsx!" },
      $vnode,
    ],
  );

  // attributes
  assertEquals(
    (
      <h1 class={["title", "h1"]} style={{ fontSize: 24, fontFamily: "serif", ":hover": { color: "purple" } }}>
        Welcome to mono-jsx!
      </h1>
    ) as VNode,
    [
      "h1",
      {
        class: ["title", "h1"],
        style: { fontSize: 24, fontFamily: "serif", ":hover": { color: "purple" } },
        children: "Welcome to mono-jsx!",
      },
      $vnode,
    ],
  );

  // conditional rendering
  assertEquals(
    (
      <div>
        {true && <span>True</span>}
        {false && <span>False</span>}
      </div>
    ) as VNode,
    [
      "div",
      {
        children: [
          ["span", { children: "True" }, $vnode],
          false,
        ],
      },
      $vnode,
    ],
  );

  // list rendering
  assertEquals(
    // deno-lint-ignore jsx-key
    <span>{1}/{false}{[1, 2].map((i) => <i>{i}</i>)}</span> as VNode,
    [
      "span",
      {
        children: [
          1,
          "/",
          false,
          [["i", { children: 1 }, $vnode], ["i", { children: 2 }, $vnode]],
        ],
      },
      $vnode,
    ],
  );

  // fragments
  assertEquals(
    (
      <>
        <span>Hello</span>
        <span>world!</span>
      </>
    ) as VNode,
    [
      $fragment,
      {
        children: [
          ["span", { children: "Hello" }, $vnode],
          ["span", { children: "world!" }, $vnode],
        ],
      },
      $vnode,
    ],
  );

  // custom html element
  assertEquals(
    <foo-bar id="0" /> as VNode,
    ["foo-bar", { id: "0" }, $vnode],
  );

  // function component
  const App = (_props: { foo: "bar" }) => null;
  assertEquals(
    <App foo="bar" /> as VNode,
    [App, { foo: "bar" }, $vnode],
  );

  // XSS
  assertEquals(
    (
      <div>
        {html`<h1>Welcome to mono-jsx!</h1>`}
      </div>
    ) as VNode,
    [
      "div",
      {
        children: [
          $html,
          { innerHTML: "<h1>Welcome to mono-jsx!</h1>" },
          $vnode,
        ],
      },
      $vnode,
    ],
  );
});

Deno.test("[jsx] <html> as a `Response`", async () => {
  const res: Response = (
    <html lang="en" headers={{ cacheControl: "public" }}>
      <head />
      <body />
    </html>
  );
  assert(res instanceof Response);
  assertEquals(res.headers.get("cache-control"), "public");
  assertEquals(await res.text(), '<!DOCTYPE html><html lang="en"><head></head><body></body></html>');
});
