import type { ComponentElement } from "../types/mono.d.ts";
import type { RenderOptions } from "../types/render.d.ts";
import { assert, assertEquals } from "jsr:@std/assert@1.0.14";
import { cache } from "../render.ts";
import { COMPONENT, FORM_JS, RENDER_ATTR, ROUTER, SIGNALS } from "../runtime/index.ts";
import { COMPONENT_JS, CX_JS, EVENT_JS, ROUTER_JS, SIGNALS_JS, STYLE_JS, SUSPENSE_JS } from "../runtime/index.ts";
import { RENDER_ATTR_JS, RENDER_SWITCH_JS, RENDER_TOGGLE_JS } from "../runtime/index.ts";
import { VERSION } from "../version.ts";

const renderToString = (node: JSX.Element, renderOptions?: RenderOptions) => {
  const res = (
    <html lang="en" headers={{ setCookie: "foo=bar" }} {...renderOptions}>
      <body>{node}</body>
    </html>
  );
  const reqHeaders = renderOptions?.request?.headers;
  assert(res instanceof Response, "Response is not a Response object");
  if (reqHeaders?.has("x-component")) {
    assertEquals(res.headers.get("content-type"), "application/json; charset=utf-8");
  } else if (reqHeaders?.has("x-route")) {
    if (res.status === 200) {
      assertEquals(res.headers.get("content-type"), "application/json; charset=utf-8");
    } else {
      // the `content-type` header set by `Response.json()`
      assertEquals(res.headers.get("content-type"), "application/json");
    }
  } else {
    assertEquals(res.headers.get("content-type"), "text/html; charset=utf-8");
  }
  assertEquals(res.headers.get("set-cookie"), "foo=bar");
  return res.text();
};

Deno.test("[ssr] condition&loop", async () => {
  const If = ({ true: ok }: { true: boolean }) => {
    if (ok) {
      return <slot />;
    }
    return null;
  };
  function* For({ items }: { items: (string | JSX.Element)[] }) {
    for (const i of items) {
      yield <>{i}</>;
    }
  }
  const App = () => (
    <>
      <h1>{"<"}html{">"} as a Response.</h1>
      <If true>
        <p>
          <For items={["Building", " ", <b>U</b>, "ser", " ", <b>I</b>, "nterfaces", "."]} />
        </p>
      </If>
    </>
  );
  assertEquals(
    await renderToString(<App />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<h1>&lt;html&gt; as a Response.</h1>`,
      `<p>Building <b>U</b>ser <b>I</b>nterfaces.</p>`,
      `</body></html>`,
    ].join(""),
  );
});

Deno.test("[ssr] merge class names", async () => {
  assertEquals(
    await renderToString(<div class={["box", "large", { border: false, rounded: true }]} />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<div class="box large rounded"></div>`,
      `</body></html>`,
    ].join(""),
  );
  assertEquals(
    await renderToString(<div class={["box", false && "large", null, undefined, {}]} />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<div class="box"></div>`,
      `</body></html>`,
    ].join(""),
  );
});

Deno.test("[ssr] style to css(inline)", async () => {
  assertEquals(
    await renderToString(<div style="display:flex" />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<div style="display:flex"></div>`,
      `</body></html>`,
    ].join(""),
  );

  assertEquals(
    await renderToString(<div style={{ display: "flex", fontSize: 1, lineHeight: 1 }} />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<div style="display:flex;font-size:1px;line-height:1"></div>`,
      `</body></html>`,
    ].join(""),
  );
});

Deno.test("[ssr] style to css(as style element)", async () => {
  const hashCode = (s: string) => [...s].reduce((hash, c) => (Math.imul(31, hash) + c.charCodeAt(0)) | 0, 0);

  "pseudo class";
  {
    const id = hashCode("background-color:#fff:hover{background-color:#eee}").toString(36);
    assertEquals(
      await renderToString(
        <button type="button" role="button" style={{ backgroundColor: "#fff", ":hover": { backgroundColor: "#eee" } }}>Click me</button>,
      ),
      [
        `<!DOCTYPE html>`,
        `<html lang="en"><body>`,
        `<style data-mono-jsx-css="${id}">[data-css-${id}]{background-color:#fff}[data-css-${id}]:hover{background-color:#eee}</style>`,
        `<button type="button" role="button" data-css-${id}>Click me</button>`,
        `</body></html>`,
      ].join(""),
    );
  }

  "pseudo element";
  {
    const id = hashCode('color:blue::after{content:"↩"}').toString(36);
    assertEquals(
      await renderToString(
        <a class="link" style={{ color: "blue", "::after": { content: "↩" } }}>Link</a>,
      ),
      [
        `<!DOCTYPE html>`,
        `<html lang="en"><body>`,
        `<style data-mono-jsx-css="${id}">[data-css-${id}]{color:blue}[data-css-${id}]::after{content:"↩"}</style>`,
        `<a class="link" data-css-${id}>Link</a>`,
        `</body></html>`,
      ].join(""),
    );
  }

  "@media query";
  {
    const id = hashCode("color:black@media (prefers-color-scheme: dark){{color:white}}").toString(36);
    assertEquals(
      await renderToString(
        <h1 class="title" style={{ color: "black", "@media (prefers-color-scheme: dark)": { color: "white" } }}>
          Hello World!
        </h1>,
      ),
      [
        `<!DOCTYPE html>`,
        `<html lang="en"><body>`,
        `<style data-mono-jsx-css="${id}">[data-css-${id}]{color:black}@media (prefers-color-scheme: dark){[data-css-${id}]{color:white}}</style>`,
        `<h1 class="title" data-css-${id}>Hello World!</h1>`,
        `</body></html>`,
      ].join(""),
    );
  }

  "nesting style";
  {
    const id = hashCode("color:black.title{font-size:20px} strong{color:grey}").toString(36);
    assertEquals(
      await renderToString(
        <h1 class="title" style={{ color: "black", "&.title": { fontSize: 20 }, "& strong": { color: "grey" } }}>
          <strong>Hello</strong> World!
        </h1>,
      ),
      [
        `<!DOCTYPE html>`,
        `<html lang="en"><body>`,
        `<style data-mono-jsx-css="${id}">[data-css-${id}]{color:black}[data-css-${id}].title{font-size:20px}[data-css-${id}] strong{color:grey}</style>`,
        `<h1 class="title" data-css-${id}><strong>Hello</strong> World!</h1>`,
        `</body></html>`,
      ].join(""),
    );
  }
});

Deno.test("[ssr] view transition", async () => {
  const cssId = "-lod2f4";
  function App(this: FC<{ show: boolean }>, props: { viewTransition?: boolean | string }) {
    return (
      <div
        style={{
          "@keyframes toggle-in": { from: { opacity: 0 }, to: { opacity: 1 } },
          "@keyframes toggle-out": { from: { opacity: 1 }, to: { opacity: 0 } },
          "::view-transition-group(toggle)": { animationDuration: "0.5s" },
          "::view-transition-old(toggle)": { animation: "0.5s ease-in both toggle-out" },
          "::view-transition-new(toggle)": { animation: "0.5s ease-in both toggle-in" },
        }}
      >
        <toggle show={this.show} viewTransition={props.viewTransition}>
          <h1>Hello world!</h1>
        </toggle>
        <button type="button" onClick={() => this.show = !this.show}>Toggle</button>
      </div>
    );
  }
  assertEquals(
    await renderToString(<App viewTransition />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<style data-mono-jsx-css="${cssId}">@keyframes toggle-in{from{opacity:0}to{opacity:1}}@keyframes toggle-out{from{opacity:1}to{opacity:0}}::view-transition-group(toggle){animation-duration:0.5s}::view-transition-old(toggle){animation:0.5s ease-in both toggle-out}::view-transition-new(toggle){animation:0.5s ease-in both toggle-in}</style>`,
      `<div data-css-${cssId}>`,
      `<m-signal mode="toggle" scope="1" key="show" vt>`,
      `<template m-slot><h1>Hello world!</h1></template>`,
      `</m-signal>`,
      `<button type="button" onclick="$emit(event,$MF_1_0,1)">Toggle</button>`,
      `</div>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      EVENT_JS,
      RENDER_TOGGLE_JS,
      SIGNALS_JS,
      `})();`,
      `/* --- */`,
      `function $MF_1_0(){(()=>this.show = !this.show).apply(this,arguments)};`,
      `$MS("1:show");`,
      `</script>`,
    ].join(""),
  );
  assertEquals(
    await renderToString(<App viewTransition="toggle" />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<style data-mono-jsx-css="${cssId}">@keyframes toggle-in{from{opacity:0}to{opacity:1}}@keyframes toggle-out{from{opacity:1}to{opacity:0}}::view-transition-group(toggle){animation-duration:0.5s}::view-transition-old(toggle){animation:0.5s ease-in both toggle-out}::view-transition-new(toggle){animation:0.5s ease-in both toggle-in}</style>`,
      `<div data-css-${cssId}>`,
      `<m-signal mode="toggle" scope="1" key="show" style="view-transition-name:toggle" vt>`,
      `<template m-slot><h1>Hello world!</h1></template>`,
      `</m-signal>`,
      `<button type="button" onclick="$emit(event,$MF_1_0,1)">Toggle</button>`,
      `</div>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      EVENT_JS,
      RENDER_TOGGLE_JS,
      SIGNALS_JS,
      `})();`,
      `/* --- */`,
      `function $MF_1_0(){(()=>this.show = !this.show).apply(this,arguments)};`,
      `$MS("1:show");`,
      `</script>`,
    ].join(""),
  );
});

Deno.test("[ssr] serialize event handler", async () => {
  assertEquals(
    await renderToString(<button type="button" onClick={() => console.log("🔥" as string)}>Click me</button>),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<button type="button" onclick="$emit(event,$MF_0_0)">Click me</button>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      EVENT_JS,
      `})();`,
      `/* --- */`,
      `function $MF_0_0(){(()=>console.log("🔥")).apply(this,arguments)};`,
      `</script>`,
    ].join(""),
  );

  assertEquals(
    await renderToString(
      <form action={(data) => console.log(data)}>
        <input name="foo" />
      </form>,
    ),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<form onsubmit="$onsubmit(event,$MF_0_0)">`,
      `<input name="foo">`,
      `</form>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      EVENT_JS,
      `})();`,
      `/* --- */`,
      `function $MF_0_0(){((data)=>console.log(data)).apply(this,arguments)};`,
      `</script>`,
    ].join(""),
  );
});

Deno.test("[ssr] <slot>", async () => {
  const Container = () => (
    <div id="container">
      <header>
        <slot name="logo" />
      </header>
      <slot name="poster">
        <img src="/poster.png" />
      </slot>
      <slot />
      <footer>
        <slot name="copyright" />
      </footer>
    </div>
  );
  const Logo = () => <img src="/logo.png" />;
  const App = () => (
    <Container>
      <Logo slot="logo" />
      <p slot="copyright">(c) 2025 All rights reserved.</p>
      <h1>Welcome to mono-jsx!</h1>
      <p>Building user interfaces.</p>
    </Container>
  );
  assertEquals(
    await renderToString(<App />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<div id="container">`,
      `<header><img src="/logo.png"></header>`,
      `<img src="/poster.png">`,
      `<h1>Welcome to mono-jsx!</h1>`,
      `<p>Building user interfaces.</p>`,
      `<footer><p>(c) 2025 All rights reserved.</p></footer>`,
      `</div>`,
      `</body></html>`,
    ].join(""),
  );
});

Deno.test("[ssr] async component", async () => {
  const words = ["Welcome", "to", "mono-jsx", "!"];

  async function List({ delay = 0 }: { delay?: number }) {
    await new Promise((resolve) => setTimeout(resolve, 50 + delay));
    return <ul>{words.map((word) => <li>{word}</li>)}</ul>;
  }

  function Layout() {
    return (
      <div class="layout">
        <slot />
      </div>
    );
  }

  async function AsyncLayout() {
    await new Promise((resolve) => setTimeout(resolve, 50));
    return (
      <div class="layout">
        <slot />
      </div>
    );
  }

  "without placeholder";
  {
    assertEquals(
      await renderToString(<List />),
      [
        `<!DOCTYPE html>`,
        `<html lang="en"><body>`,
        `<m-portal chunk-id="0"></m-portal>`,
        `</body></html>`,
        `<script data-mono-jsx="${VERSION}">`,
        `(()=>{`,
        SUSPENSE_JS,
        `})();`,
        `/* --- */`,
        `</script>`,
        `<m-chunk chunk-id="0"><template>`,
        `<ul>`,
        ...words.map((word) => `<li>${word}</li>`),
        `</ul>`,
        `</template></m-chunk>`,
      ].join(""),
    );
  }

  "with placeholder";
  {
    assertEquals(
      await renderToString(<List placeholder={<p>loading...</p>} />),
      [
        `<!DOCTYPE html>`,
        `<html lang="en"><body>`,
        `<m-portal chunk-id="0">`,
        `<p>loading...</p>`,
        `</m-portal>`,
        `</body></html>`,
        `<script data-mono-jsx="${VERSION}">`,
        `(()=>{`,
        SUSPENSE_JS,
        `})();`,
        `/* --- */`,
        `</script>`,
        `<m-chunk chunk-id="0"><template>`,
        `<ul>`,
        ...words.map((word) => `<li>${word}</li>`),
        `</ul>`,
        `</template></m-chunk>`,
      ].join(""),
    );
  }

  "eager rendering";
  {
    assertEquals(
      await renderToString(<List rendering="eager" />),
      [
        `<!DOCTYPE html>`,
        `<html lang="en"><body>`,
        `<ul>`,
        ...words.map((word) => `<li>${word}</li>`),
        `</ul>`,
        `</body></html>`,
      ].join(""),
    );
  }

  "as solt";
  {
    assertEquals(
      await renderToString(
        <Layout>
          <List />
        </Layout>,
      ),
      [
        `<!DOCTYPE html>`,
        `<html lang="en"><body><div class="layout">`,
        `<m-portal chunk-id="0"></m-portal>`,
        `</div></body></html>`,
        `<script data-mono-jsx="${VERSION}">`,
        `(()=>{`,
        SUSPENSE_JS,
        `})();`,
        `/* --- */`,
        `</script>`,
        `<m-chunk chunk-id="0"><template>`,
        `<ul>`,
        ...words.map((word) => `<li>${word}</li>`),
        `</ul>`,
        `</template></m-chunk>`,
      ].join(""),
    );
  }

  "as solt in async component";
  {
    assertEquals(
      await renderToString(
        <AsyncLayout>
          <List />
        </AsyncLayout>,
      ),
      [
        `<!DOCTYPE html>`,
        `<html lang="en"><body>`,
        `<m-portal chunk-id="0"></m-portal>`,
        `</body></html>`,
        `<script data-mono-jsx="${VERSION}">`,
        `(()=>{`,
        SUSPENSE_JS,
        `})();`,
        `/* --- */`,
        `</script>`,
        `<m-chunk chunk-id="0"><template><div class="layout"><m-portal chunk-id="1"></m-portal></div></template></m-chunk>`,
        `<m-chunk chunk-id="1"><template>`,
        `<ul>`,
        ...words.map((word) => `<li>${word}</li>`),
        `</ul>`,
        `</template></m-chunk>`,
      ].join(""),
    );
  }

  "nesting";
  {
    const App = async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return (
        <AsyncLayout>
          <List />
        </AsyncLayout>
      );
    };
    assertEquals(
      await renderToString(<App placeholder={<p>Loading...</p>} />),
      [
        `<!DOCTYPE html>`,
        `<html lang="en"><body>`,
        `<m-portal chunk-id="0">`,
        `<p>Loading...</p>`,
        `</m-portal>`,
        `</body></html>`,
        `<script data-mono-jsx="${VERSION}">`,
        `(()=>{`,
        SUSPENSE_JS,
        `})();`,
        `/* --- */`,
        `</script>`,
        `<m-chunk chunk-id="0"><template><m-portal chunk-id="1"></m-portal></template></m-chunk>`,
        `<m-chunk chunk-id="1"><template><div class="layout"><m-portal chunk-id="2"></m-portal></div></template></m-chunk>`,
        `<m-chunk chunk-id="2"><template>`,
        `<ul>`,
        ...words.map((word) => `<li>${word}</li>`),
        `</ul>`,
        `</template></m-chunk>`,
      ].join(""),
    );
  }

  "multiple async components";
  {
    const indexes = [0, 1, 2];
    assertEquals(
      await renderToString(
        <>
          {indexes.map((i) => <List delay={i * 50} />)}
        </>,
      ),
      [
        `<!DOCTYPE html>`,
        `<html lang="en"><body>`,
        indexes.map((i) => `<m-portal chunk-id="${i}"></m-portal>`),
        `</body></html>`,
        `<script data-mono-jsx="${VERSION}">`,
        `(()=>{`,
        SUSPENSE_JS,
        `})();`,
        `/* --- */`,
        `</script>`,
        indexes.map((i) => [
          `<m-chunk chunk-id="${i}"><template>`,
          `<ul>`,
          ...words.map((word) => `<li>${word}</li>`),
          `</ul>`,
          `</template></m-chunk>`,
        ]),
      ].flat(2).join(""),
    );
  }
});

Deno.test("[ssr] async generator component", async () => {
  const words = ["Welcome", "to", "mono-jsx", "!"];

  async function* Words() {
    for (const word of words) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      yield <span>{word}</span>;
    }
  }

  "without placeholder";
  {
    assertEquals(
      await renderToString(
        <h1>
          <Words />
        </h1>,
      ),
      [
        `<!DOCTYPE html>`,
        `<html lang="en"><body>`,
        `<h1>`,
        `<m-portal chunk-id="0"></m-portal>`,
        `</h1>`,
        `</body></html>`,
        `<script data-mono-jsx="${VERSION}">`,
        `(()=>{`,
        SUSPENSE_JS,
        `})();`,
        `/* --- */`,
        `</script>`,
        ...words.map((word) => `<m-chunk chunk-id="0" next><template><span>${word}</span></template></m-chunk>`),
        `<m-chunk chunk-id="0" done></m-chunk>`,
      ].join(""),
    );
  }

  "with placeholder";
  {
    assertEquals(
      await renderToString(
        <h1>
          <Words placeholder={<span>...</span>} />
        </h1>,
      ),
      [
        `<!DOCTYPE html>`,
        `<html lang="en"><body>`,
        `<h1>`,
        `<m-portal chunk-id="0"><span>...</span></m-portal>`,
        `</h1>`,
        `</body></html>`,
        `<script data-mono-jsx="${VERSION}">`,
        `(()=>{`,
        SUSPENSE_JS,
        `})();`,
        `/* --- */`,
        `</script>`,
        ...words.map((word) => `<m-chunk chunk-id="0" next><template><span>${word}</span></template></m-chunk>`),
        `<m-chunk chunk-id="0" done></m-chunk>`,
      ].join(""),
    );
  }

  "eager rendering";
  {
    assertEquals(
      await renderToString(
        <h1>
          <Words rendering="eager" />
        </h1>,
      ),
      [
        `<!DOCTYPE html>`,
        `<html lang="en"><body>`,
        `<h1>`,
        ...words.map((word) => `<span>${word}</span>`),
        `</h1>`,
        `</body></html>`,
      ].join(""),
    );
  }
});

Deno.test("[ssr] catch error", async () => {
  const Boom = () => {
    throw new Error("Boom!");
  };
  assertEquals(
    await renderToString(
      <Boom catch={(err: Error) => <p>error: {err.message}</p>} />,
    ),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<p>error: Boom!</p>`,
      `</body></html>`,
    ].join(""),
  );
});

Deno.test("[ssr] use signals", async () => {
  function Foo(this: FC<{ foo: string }>) {
    return <span>{this.foo}</span>;
  }

  assertEquals(
    await renderToString(<Foo />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<span>`,
      `<m-signal scope="1" key="foo"></m-signal>`,
      `</span>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      SIGNALS_JS,
      `})();`,
      `/* --- */`,
      `$MS("1:foo");`,
      `</script>`,
    ].join(""),
  );

  function FooBar(this: FC<{ foo: string }>) {
    this.foo = "bar";
    return <span title={this.foo}>{this.foo}</span>;
  }
  assertEquals(
    await renderToString(<FooBar />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<span title="bar">`,
      `<m-signal mode="[title]" scope="1" key="foo" hidden></m-signal>`,
      `<m-signal scope="1" key="foo">bar</m-signal>`,
      `</span>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      RENDER_ATTR_JS,
      SIGNALS_JS,
      `})();`,
      `/* --- */`,
      `$MS("1:foo","bar");`,
      `</script>`,
    ].join(""),
  );

  function Input(this: FC<{ value: string }>) {
    this.value = "Welcome to mono-jsx!";
    return <input value={this.value} />;
  }
  assertEquals(
    await renderToString(<Input />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<input value="Welcome to mono-jsx!">`,
      `<m-group hidden>`,
      `<m-signal mode="[value]" scope="1" key="value" hidden></m-signal>`,
      `</m-group>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      RENDER_ATTR_JS,
      SIGNALS_JS,
      `})();`,
      `/* --- */`,
      `$MS("1:value","Welcome to mono-jsx!");`,
      `</script>`,
    ].join(""),
  );

  function InputNumber(this: FC<{ value: number }>, props: { initialValue?: number }) {
    this.value = props.initialValue ?? 0;
    return <input type="number" value={this.value} />;
  }
  assertEquals(
    await renderToString(<div>{[1, 2, 3].map((i) => <InputNumber initialValue={i} />)}</div>),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body><div>`,
      [1, 2, 3].map((i) =>
        [
          `<input type="number" value="${i}">`,
          `<m-group hidden>`,
          `<m-signal mode="[value]" scope="${i}" key="value" hidden></m-signal>`,
          `</m-group>`,
        ].join("")
      ).join(""),
      `</div></body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      RENDER_ATTR_JS,
      SIGNALS_JS,
      `})();`,
      `/* --- */`,
      [1, 2, 3].map((i) => `$MS("${i}:value",${i});`).join(""),
      `</script>`,
    ].join(""),
  );
});

Deno.test("[ssr] pass signal via prop", async () => {
  function Foo(props: { foo: string }) {
    return <span>{props.foo}</span>;
  }

  function App(this: FC<{ foo: string }>) {
    this.foo = "bar";
    return (
      <div>
        <Foo foo={this.foo} />
        <button type="button" onClick={() => this.foo = "baz"}>Click Me</button>
      </div>
    );
  }

  assertEquals(
    await renderToString(<App />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<div>`,
      `<span>`,
      `<m-signal scope="1" key="foo">bar</m-signal>`,
      `</span>`,
      `<button type="button" onclick="$emit(event,$MF_1_0,1)">Click Me</button>`,
      `</div>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      EVENT_JS,
      SIGNALS_JS,
      `})();`,
      `/* --- */`,
      `function $MF_1_0(){(()=>this.foo = "baz").apply(this,arguments)};`,
      `$MS("1:foo","bar");`,
      `</script>`,
    ].join(""),
  );
});

Deno.test("[ssr] app signals", async () => {
  function Header(this: FC<{}, { title: string }>) {
    return (
      <header>
        <h1>{this.app.title}</h1>
      </header>
    );
  }
  function Main(this: FC<{}, { title: string }>) {
    return (
      <main>
        <form
          action={(fd) => this.app.title = fd.get("title") as string}
        >
          <input name="title" value={this.app.title} />
        </form>
      </main>
    );
  }
  function Footer(this: FC<{}, { title: string }>) {
    return (
      <footer>
        <p>(c)2025 {this.app.title}</p>
      </footer>
    );
  }
  assertEquals(
    await renderToString(
      <>
        <Header />
        <Main />
        <Footer />
      </>,
      { app: { title: "Welcome to mono-jsx!" } },
    ),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<header><h1>`,
      `<m-signal scope="0" key="title">Welcome to mono-jsx!</m-signal>`,
      `</h1></header>`,
      `<main>`,
      `<form onsubmit="$onsubmit(event,$MF_2_0,2)">`,
      `<input name="title" value="Welcome to mono-jsx!">`,
      `<m-group hidden><m-signal mode="[value]" scope="0" key="title" hidden></m-signal></m-group>`,
      `</form>`,
      `</main>`,
      `<footer><p>`,
      `(c)2025 `,
      `<m-signal scope="0" key="title">Welcome to mono-jsx!</m-signal>`,
      `</p></footer>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      EVENT_JS,
      RENDER_ATTR_JS,
      SIGNALS_JS,
      `})();`,
      `/* --- */`,
      `function $MF_2_0(){((fd)=>this.app.title = fd.get("title")).apply(this,arguments)};`,
      `$MS("0:title","Welcome to mono-jsx!");`,
      `</script>`,
    ].join(""),
  );
});

Deno.test("[ssr] computed signals", async () => {
  function FooBar(this: FC<{ foo: string; bar: string }, { themeColor: string; tailing: string }>) {
    this.foo = "foo";
    this.bar = "bar";
    const className = this.computed(() => [this.foo, this.bar]);
    const style = this.computed(() => ({ color: this.app.themeColor }));
    const text = this.$(() => this.foo + this.bar + this.app.tailing);
    return <span class={className} style={style} title={text}>{text}</span>;
  }

  assertEquals(
    await renderToString(<FooBar />, { app: { themeColor: "black", tailing: "!" } }),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<span class="foo bar" style="color:black" title="foobar!">`,
      `<m-signal mode="[class]" scope="1" computed="0" hidden></m-signal>`,
      `<m-signal mode="[style]" scope="1" computed="1" hidden></m-signal>`,
      `<m-signal mode="[title]" scope="1" computed="2" hidden></m-signal>`,
      `<m-signal scope="1" computed="2">foobar!</m-signal>`,
      `</span>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      CX_JS,
      STYLE_JS,
      RENDER_ATTR_JS,
      SIGNALS_JS,
      `})();`,
      `/* --- */`,
      `$MS("1:foo","foo");`,
      `$MS("1:bar","bar");`,
      `$MS("0:themeColor","black");`,
      `$MS("0:tailing","!");`,
      `$MC(1,0,function(){return(${
        // @ts-ignore this
        String(() => [this.foo, this.bar])}).call(this)},["1:foo","1:bar"]);`,
      `$MC(1,1,function(){return(${
        // @ts-ignore this
        String(() => ({ color: this.app.themeColor }))}).call(this)},["0:themeColor"]);`,
      `$MC(1,2,function(){return(${
        // @ts-ignore this
        String(() => this.foo + this.bar + this.app.tailing)}).call(this)},["1:foo","1:bar","0:tailing"]);`,
      `</script>`,
    ].join(""),
  );

  function ComputedClassName(this: FC<{ color: string }, { themeColor: string }>) {
    this.color = "blue";
    return (
      <div
        class={[this.color, this.app.themeColor]}
      />
    );
  }

  assertEquals(
    await renderToString(<ComputedClassName />, { app: { themeColor: "black" } }),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<div class="blue black">`,
      `<m-signal mode="[class]" scope="1" computed="0" hidden></m-signal>`,
      `</div>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      CX_JS,
      RENDER_ATTR_JS,
      SIGNALS_JS,
      `})();`,
      `/* --- */`,
      `$MS("1:color","blue");`,
      `$MS("0:themeColor","black");`,
      `$MC(1,0,function(){return(()=>$patch(["blue","black"],[this["color"],0],[$signals(0)["themeColor"],1])).call(this)},["1:color","0:themeColor"]);`,
      `</script>`,
    ].join(""),
  );

  function ComputedStyle(this: FC<{ color: string }, { themeColor: string }>) {
    this.color = "blue";
    return (
      <div
        style={{
          color: this.color,
          backgroundColor: this.app.themeColor,
        }}
      />
    );
  }

  assertEquals(
    await renderToString(<ComputedStyle />, { app: { themeColor: "black" } }),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<div style="color:blue;background-color:black">`,
      `<m-signal mode="[style]" scope="1" computed="0" hidden></m-signal>`,
      `</div>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      STYLE_JS,
      RENDER_ATTR_JS,
      SIGNALS_JS,
      `})();`,
      `/* --- */`,
      `$MS("1:color","blue");`,
      `$MS("0:themeColor","black");`,
      `$MC(1,0,function(){return(()=>$patch({"color":"blue","backgroundColor":"black"},[this["color"],"color"],[$signals(0)["themeColor"],"backgroundColor"])).call(this)},["1:color","0:themeColor"]);`,
      `</script>`,
    ].join(""),
  );
});

Deno.test("[ssr] this.init", async () => {
  function Foo(this: FC<{ foo: string }>) {
    this.init({ foo: "bar" });
    return <span>{this.foo}</span>;
  }

  assertEquals(
    await renderToString(<Foo />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<span>`,
      `<m-signal scope="1" key="foo">bar</m-signal>`,
      `</span>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      SIGNALS_JS,
      `})();`,
      `/* --- */`,
      `$MS("1:foo","bar");`,
      `</script>`,
    ].join(""),
  );
});

Deno.test("[ssr] this.effect", async () => {
  function Effect(this: FC<{ count: number }>) {
    this.count = 0;
    this.effect(() => console.log("count changed", this.count));
    return (
      <div>
        <h1>{this.count}</h1>
        <button type="button" onClick={() => this.count++}>Click Me</button>
      </div>
    );
  }

  assertEquals(
    await renderToString(<Effect />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<div>`,
      `<h1>`,
      `<m-signal scope="1" key="count">0</m-signal>`,
      `</h1>`,
      `<button type="button" onclick="$emit(event,$MF_1_0,1)">Click Me</button>`,
      `</div>`,
      `<m-effect scope="1" n="1" hidden></m-effect>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      EVENT_JS,
      SIGNALS_JS,
      `})();`,
      `/* --- */`,
      `function $MF_1_0(){(()=>this.count++).apply(this,arguments)};`,
      `function $ME_1_0(){return(()=>console.log("count changed", this.count)).call(this)};`,
      `$MS("1:count",0);`,
      `</script>`,
    ].join(""),
  );

  function App(this: FC<{ show: boolean }>) {
    this.show = true;
    this.effect(() => console.log("Welcome to mono-jsx!"));
    return (
      <>
        <toggle show={this.show}>
          <Effect />
        </toggle>
        <button type="button" onClick={() => this.show = !this.show}>Toggle</button>
      </>
    );
  }

  assertEquals(
    await renderToString(<App />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<m-signal mode="toggle" scope="1" key="show">`,
      `<div>`,
      `<h1><m-signal scope="2" key="count">0</m-signal></h1>`,
      `<button type="button" onclick="$emit(event,$MF_2_0,2)">Click Me</button>`,
      `</div>`,
      `<m-effect scope="2" n="1" hidden></m-effect>`,
      `</m-signal>`,
      `<button type="button" onclick="$emit(event,$MF_1_0,1)">Toggle</button>`,
      `<m-effect scope="1" n="1" hidden></m-effect>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      EVENT_JS,
      RENDER_TOGGLE_JS,
      SIGNALS_JS,
      `})();`,
      `/* --- */`,
      `function $MF_2_0(){(()=>this.count++).apply(this,arguments)};`,
      `function $MF_1_0(){(()=>this.show = !this.show).apply(this,arguments)};`,
      `function $ME_2_0(){return(()=>console.log("count changed", this.count)).call(this)};`,
      `function $ME_1_0(){return(()=>console.log("Welcome to mono-jsx!")).call(this)};`,
      `$MS("2:count",0);`,
      `$MS("1:show",true);`,
      `</script>`,
    ].join(""),
  );
});

Deno.test("[ssr] this.refs", async () => {
  function App(this: Refs<FC, { h1: HTMLElement }>) {
    this.effect(() => console.log(this.refs.h1.textContent));
    return <h1 ref={this.refs.h1}>Welcome to mono-jsx!</h1>;
  }

  assertEquals(
    await renderToString(<App />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<h1 data-ref="1:h1">Welcome to mono-jsx!</h1>`,
      `<m-effect scope="1" n="1" hidden></m-effect>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      SIGNALS_JS,
      `})();`,
      `/* --- */`,
      `function $ME_1_0(){return(()=>console.log(this.refs.h1.textContent)).call(this)};`,
      `</script>`,
    ].join(""),
  );

  function Lazy(this: Refs<FC, { component: ComponentElement }>) {
    this.effect(() => void this.refs.component.refresh());

    return (
      <>
        <component name="Foo" ref={this.refs.component} />
      </>
    );
  }

  assertEquals(
    await renderToString(<Lazy />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<m-component name="Foo" data-ref="1:component"></m-component>`,
      `<m-effect scope="1" n="1" hidden></m-effect>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      SIGNALS_JS,
      COMPONENT_JS,
      `})();`,
      `/* --- */`,
      `window.$FLAGS="1|0|${SIGNALS | COMPONENT}";`,
      `function $ME_1_0(){return(()=>void this.refs.component.refresh()).call(this)};`,
      `</script>`,
    ].join(""),
  );
});

Deno.test("[ssr] this.app.refs", async () => {
  function App(this: Refs<FC, {}, { h1: HTMLElement }>) {
    this.effect(() => console.log(this.app.refs.h1.textContent));
    return <h1 ref={this.app.refs.h1}>Welcome to mono-jsx!</h1>;
  }

  assertEquals(
    await renderToString(<App />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<h1 data-ref="0:h1">Welcome to mono-jsx!</h1>`,
      `<m-effect scope="1" n="1" hidden></m-effect>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      SIGNALS_JS,
      `})();`,
      `/* --- */`,
      `function $ME_1_0(){return(()=>console.log(this.app.refs.h1.textContent)).call(this)};`,
      `</script>`,
    ].join(""),
  );
});

Deno.test("[ssr] ref callback", async () => {
  function App(this: FC) {
    return <h1 ref={el => console.log(el.textContent)}>Welcome to mono-jsx!</h1>;
  }

  assertEquals(
    await renderToString(<App />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<h1 data-ref="1:0">Welcome to mono-jsx!</h1>`,
      `<m-effect scope="1" n="1" hidden></m-effect>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      SIGNALS_JS,
      `})();`,
      `/* --- */`,
      `function $ME_1_0(){return(()=>((el)=>console.log(el.textContent))(this.refs["0"])).call(this)};`,
      `</script>`,
    ].join(""),
  );
});

Deno.test("[ssr] async component with signals", async () => {
  async function Dash(this: FC<{ username: string | null }>) {
    this.username = await new Promise((resolve) => setTimeout(() => resolve("me"), 50));
    return (
      <div>
        <h1>
          {this.computed(() => this.username ? "Hello, " + this.username : "Please login")}!
        </h1>
        {this.username && (
          <button type="button" onClick={() => this.username = null}>
            Logout
          </button>
        )}
      </div>
    );
  }

  assertEquals(
    await renderToString(<Dash />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<m-portal chunk-id="0">`,
      `</m-portal>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      SUSPENSE_JS,
      `})();`,
      `/* --- */`,
      `</script>`,
      `<m-chunk chunk-id="0"><template>`,
      `<div>`,
      `<h1>`,
      `<m-signal scope="1" computed="0">Hello, me</m-signal>`,
      `!</h1>`,
      `<button type="button" onclick="$emit(event,$MF_1_0,1)">Logout</button>`,
      `</div>`,
      `</template></m-chunk>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      EVENT_JS,
      SIGNALS_JS,
      `})();`,
      `/* --- */`,
      `function $MF_1_0(){(()=>this.username = null).apply(this,arguments)};`,
      `$MS("1:username","me");`,
      `$MC(1,0,function(){return(()=>this.username ? "Hello, " + this.username : "Please login").call(this)},["1:username"]);`,
      `</script>`,
    ].join(""),
  );
});

Deno.test("[ssr] $value", async () => {
  function App(this: FC<{ value: string }>) {
    this.value = "Hello, world!";
    return <input $value={this.value} />;
  }
  assertEquals(
    await renderToString(<App />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<input value="Hello, world!" oninput="$emit(event,$MF_1_0,1)">`,
      `<m-group hidden><m-signal mode="[value]" scope="1" key="value" hidden></m-signal></m-group>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      EVENT_JS,
      RENDER_ATTR_JS,
      SIGNALS_JS,
      `})();`,
      `/* --- */`,
      `function $MF_1_0(){(e=>this["value"]=e.target.value).apply(this,arguments)};`,
      `$MS("1:value","Hello, world!");`,
      `</script>`,
    ].join(""),
  );
});

Deno.test("[ssr] $checked", async () => {
  function App(this: FC<{ checked: boolean }>) {
    this.checked = false;
    return <input $checked={this.checked} />;
  }
  assertEquals(
    await renderToString(<App />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<input oninput="$emit(event,$MF_1_0,1)">`,
      `<m-group hidden><m-signal mode="[checked]" scope="1" key="checked" hidden></m-signal></m-group>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      EVENT_JS,
      RENDER_ATTR_JS,
      SIGNALS_JS,
      `})();`,
      `/* --- */`,
      `function $MF_1_0(){(e=>this["checked"]=e.target.checked).apply(this,arguments)};`,
      `$MS("1:checked",false);`,
      `</script>`,
    ].join(""),
  );
});

Deno.test("[ssr] this.request", async () => {
  function App(this: FC) {
    const { request } = this;
    return (
      <div>
        <p>{request.headers.get("x-foo")}</p>
      </div>
    );
  }
  const request = new Request("https://example.com", { headers: { "x-foo": "bar" } });
  assertEquals(
    await renderToString(<App />, { request }),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<div>`,
      `<p>bar</p>`,
      `</div>`,
      `</body></html>`,
    ].join(""),
  );
});

Deno.test("[ssr] this.context", async () => {
  function App(this: Context<FC, { foo: string }>) {
    const { context } = this;
    return (
      <div>
        <p>{context.foo}</p>
      </div>
    );
  }
  assertEquals(
    await renderToString(<App />, { context: { foo: "bar" } }),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<div>`,
      `<p>bar</p>`,
      `</div>`,
      `</body></html>`,
    ].join(""),
  );
});

Deno.test("[ssr] this.session", async () => {
  const secret = "secret";
  const data = JSON.stringify([{ "user": "@ije" }, Math.floor(Date.now() / 1000) + 1800]);
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    "HMAC",
    await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]),
    encoder.encode(data),
  );
  const sessionCookie = "session=" + btoa(data) + "." + btoa(String.fromCharCode(...new Uint8Array(signature)));
  function App(this: FC, props: { user?: string; logout?: boolean }) {
    if (props.user) {
      this.session.set("user", props.user);
    }
    if (props.logout) {
      this.session.destroy();
    }
    return <div>{this.session.get("user")}</div>;
  }
  assertEquals(
    await renderToString(<App />, {
      session: { cookie: { secret } },
      request: new Request("https://example.com"),
    }),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<div></div>`,
      `</body></html>`,
    ].join(""),
  );
  assertEquals(
    await renderToString(<App user="@ije" />, {
      session: { cookie: { secret } },
      request: new Request("https://example.com"),
    }),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<div>@ije</div>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `document.cookie="${sessionCookie}";`,
      `</script>`,
    ].join(""),
  );
  // customzied session cookie
  assertEquals(
    await renderToString(<App user="@ije" />, {
      session: { cookie: { secret, path: "/admin", domain: ".example.com", secure: true, sameSite: "strict" } },
      request: new Request("https://example.com"),
    }),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<div>@ije</div>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `document.cookie="${sessionCookie}; Domain=.example.com; Path=/admin; Secure; SameSite=strict";`,
      `</script>`,
    ].join(""),
  );
  assertEquals(
    await renderToString(<App />, {
      session: { cookie: { secret } },
      request: new Request("https://example.com", { headers: { "cookie": sessionCookie } }),
    }),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<div>@ije</div>`,
      `</body></html>`,
    ].join(""),
  );
  assertEquals(
    await renderToString(<App logout />, {
      session: { cookie: { secret } },
      request: new Request("https://example.com", { headers: { "cookie": sessionCookie } }),
    }),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<div></div>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `document.cookie="session=; Expires=Thu, 01 Jan 1970 00:00:00 GMT";`,
      `</script>`,
    ].join(""),
  );
});

Deno.test("[ssr] <cache>", async () => {
  assertEquals(
    await renderToString(
      <cache key="foo" ttl={1000}>
        <h1>👋</h1>
      </cache>,
    ),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<h1>👋</h1>`,
      `</body></html>`,
    ].join(""),
  );
  assertEquals(
    await renderToString(
      <cache key="foo" ttl={1000}>
        <h1>👋</h1>
      </cache>,
    ),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<h1>👋</h1>`,
      `</body></html>`,
    ].join(""),
  );
  assertEquals(cache.size, 1);
  assertEquals(cache.get("foo")?.html, "<h1>👋</h1>");
});

Deno.test("[ssr] <static>", async () => {
  function Icon() {
    return (
      <static>
        <svg>
          <circle cx="10" cy="10" r="10" />
        </svg>
      </static>
    );
  }
  assertEquals(
    await renderToString(<Icon />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<svg>`,
      `<circle cx="10" cy="10" r="10" />`,
      `</svg>`,
      `</body></html>`,
    ].join(""),
  );
  assertEquals(
    await renderToString(<Icon />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<svg>`,
      `<circle cx="10" cy="10" r="10" />`,
      `</svg>`,
      `</body></html>`,
    ].join(""),
  );
  assertEquals(cache.size, 2);
});

Deno.test("[ssr] <toggle>", async () => {
  assertEquals(
    await renderToString(
      <toggle>
        <h1>👋</h1>
      </toggle>,
    ),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `</body></html>`,
    ].join(""),
  );

  assertEquals(
    await renderToString(
      <toggle show>
        <h1>👋</h1>
      </toggle>,
    ),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<h1>👋</h1>`,
      `</body></html>`,
    ].join(""),
  );

  function Toggle(this: FC<{ show: boolean }>, props: { show?: boolean }) {
    this.show = !!props.show;
    return (
      <toggle show={this.show}>
        <h1>👋</h1>
      </toggle>
    );
  }

  function ToggleWithHiddenProp(this: FC<{ hidden: boolean }>, props: { hidden?: boolean }) {
    this.hidden = !!props.hidden;
    return (
      <toggle hidden={this.hidden}>
        <h1>👋</h1>
      </toggle>
    );
  }

  assertEquals(
    await renderToString(<Toggle />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<m-signal mode="toggle" scope="1" key="show">`,
      `<template m-slot><h1>👋</h1></template>`,
      `</m-signal>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      RENDER_TOGGLE_JS,
      SIGNALS_JS,
      `})();`,
      `/* --- */`,
      `$MS("1:show",false);`,
      `</script>`,
    ].join(""),
  );

  assertEquals(
    await renderToString(<Toggle show />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<m-signal mode="toggle" scope="1" key="show">`,
      `<h1>👋</h1>`,
      `</m-signal>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      RENDER_TOGGLE_JS,
      SIGNALS_JS,
      `})();`,
      `/* --- */`,
      `$MS("1:show",true);`,
      `</script>`,
    ].join(""),
  );

  assertEquals(
    await renderToString(<ToggleWithHiddenProp />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<m-signal mode="toggle" scope="1" computed="0">`,
      `<h1>👋</h1>`,
      `</m-signal>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      RENDER_TOGGLE_JS,
      SIGNALS_JS,
      `})();`,
      `/* --- */`,
      `$MS("1:hidden",false);`,
      `$MC(1,0,function(){return(()=>!this["hidden"]).call(this)},["1:hidden"]);`,
      `</script>`,
    ].join(""),
  );

  assertEquals(
    await renderToString(<ToggleWithHiddenProp hidden />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<m-signal mode="toggle" scope="1" computed="0">`,
      `<template m-slot><h1>👋</h1></template>`,
      `</m-signal>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      RENDER_TOGGLE_JS,
      SIGNALS_JS,
      `})();`,
      `/* --- */`,
      `$MS("1:hidden",true);`,
      `$MC(1,0,function(){return(()=>!this["hidden"]).call(this)},["1:hidden"]);`,
      `</script>`,
    ].join(""),
  );
});

Deno.test("[ssr] <switch>", async () => {
  assertEquals(
    await renderToString(
      <switch value={"a"}>
        <span slot="a">A</span>
        <span slot="b">B</span>
        <span>C</span>
        <span>D</span>
      </switch>,
    ),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<span>A</span>`,
      `</body></html>`,
    ].join(""),
  );

  assertEquals(
    await renderToString(
      <switch value={"b"}>
        <span slot="a">A</span>
        <span slot="b">B</span>
        <span>C</span>
        <span>D</span>
      </switch>,
    ),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<span>B</span>`,
      `</body></html>`,
    ].join(""),
  );

  assertEquals(
    await renderToString(
      <switch value={"c"}>
        <span slot="a">A</span>
        <span slot="b">B</span>
        <span>C</span>
        <span>D</span>
      </switch>,
    ),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<span>C</span>`,
      `<span>D</span>`,
      `</body></html>`,
    ].join(""),
  );

  function Switch(this: FC<{ select?: string }>, props: { value?: string }) {
    this.select = props.value;
    return (
      <switch value={this.select}>
        <span slot="a">A</span>
        <span slot="b">B</span>
        <span>C</span>
        <span>D</span>
      </switch>
    );
  }

  assertEquals(
    await renderToString(<Switch value="a" />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<m-signal mode="switch" scope="1" key="select" match="a">`,
      `<span>A</span>`,
      `<template m-slot><span slot="b">B</span><span>C</span><span>D</span></template>`,
      `</m-signal>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      RENDER_SWITCH_JS,
      SIGNALS_JS,
      `})();`,
      `/* --- */`,
      `$MS("1:select","a");`,
      `</script>`,
    ].join(""),
  );

  assertEquals(
    await renderToString(<Switch value="b" />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<m-signal mode="switch" scope="1" key="select" match="b">`,
      `<span>B</span>`,
      `<template m-slot><span slot="a">A</span><span>C</span><span>D</span></template>`,
      `</m-signal>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      RENDER_SWITCH_JS,
      SIGNALS_JS,
      `})();`,
      `/* --- */`,
      `$MS("1:select","b");`,
      `</script>`,
    ].join(""),
  );

  assertEquals(
    await renderToString(<Switch />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<m-signal mode="switch" scope="1" key="select">`,
      `<span>C</span><span>D</span>`,
      `<template m-slot><span slot="a">A</span><span slot="b">B</span></template>`,
      `</m-signal>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      RENDER_SWITCH_JS,
      SIGNALS_JS,
      `})();`,
      `/* --- */`,
      `$MS("1:select");`,
      `</script>`,
    ].join(""),
  );
});

Deno.test("[ssr] <component>", async () => {
  function App(props: { foo: string }) {
    return <h1>{props.foo}</h1>;
  }

  function App2(props: { foo: string }) {
    return <h2>{props.foo}</h2>;
  }

  function LazyAppWithSingalName(this: FC<{ name: string }>) {
    this.name = "App";
    return <component name={this.name} props={{ foo: "bar" }} placeholder={<p>loading...</p>} />;
  }

  function LazyAppWithSignalProps(this: FC<{ props: { foo: string } }>) {
    this.props = { foo: "bar" };
    return <component name="App" props={this.props} placeholder={<p>loading...</p>} />;
  }

  function LazyAppWithComputedProps(this: FC<{ foo: string }>) {
    this.foo = "bar";
    const props = this.computed(() => ({ foo: this.foo }));
    return <component name="App" props={props} placeholder={<p>loading...</p>} />;
  }

  function LazyAppWithImplicitComputedProps(this: FC<{ foo: string }>) {
    this.foo = "bar";
    return <component name="App" props={{ foo: this.foo, color: "blue" }} placeholder={<p>loading...</p>} />;
  }

  function LazyAppIsProp(this: FC) {
    return <component is={App} props={{ foo: "bar" }} placeholder={<p>loading...</p>} />;
  }

  function LazyAppAsProp(this: FC) {
    return <component as={<App2 foo="bar" />} placeholder={<p>loading...</p>} />;
  }

  assertEquals(
    await renderToString(
      <component name="App" props={{ foo: "bar" }} placeholder={<p>loading...</p>} />,
    ),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<m-component name="App" props="base64,eyJmb28iOiJiYXIifQ=="><p>loading...</p></m-component>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      COMPONENT_JS,
      `})();`,
      `/* --- */`,
      `window.$FLAGS="0|0|${COMPONENT}";`,
      `</script>`,
    ].join(""),
  );

  assertEquals(
    await renderToString(<LazyAppWithSingalName />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<m-component name="App" props="base64,eyJmb28iOiJiYXIifQ=="><p>loading...</p></m-component>`,
      `<m-group hidden><m-signal mode="[name]" scope="1" key="name" hidden></m-signal></m-group>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      RENDER_ATTR_JS,
      SIGNALS_JS,
      COMPONENT_JS,
      `})();`,
      `/* --- */`,
      `window.$FLAGS="1|0|${RENDER_ATTR | SIGNALS | COMPONENT}";`,
      `$MS("1:name","App");`,
      `</script>`,
    ].join(""),
  );

  assertEquals(
    await renderToString(<LazyAppWithSignalProps />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<m-component name="App" props="base64,eyJmb28iOiJiYXIifQ=="><p>loading...</p></m-component>`,
      `<m-group hidden><m-signal mode="[props]" scope="1" key="props" hidden></m-signal></m-group>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      RENDER_ATTR_JS,
      SIGNALS_JS,
      COMPONENT_JS,
      `})();`,
      `/* --- */`,
      `window.$FLAGS="1|0|${RENDER_ATTR | SIGNALS | COMPONENT}";`,
      `$MS("1:props",{"foo":"bar"});`,
      `</script>`,
    ].join(""),
  );

  assertEquals(
    await renderToString(<LazyAppWithComputedProps />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<m-component name="App" props="base64,eyJmb28iOiJiYXIifQ=="><p>loading...</p></m-component>`,
      `<m-group hidden><m-signal mode="[props]" scope="1" computed="0" hidden></m-signal></m-group>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      RENDER_ATTR_JS,
      SIGNALS_JS,
      COMPONENT_JS,
      `})();`,
      `/* --- */`,
      `window.$FLAGS="1|0|${RENDER_ATTR | SIGNALS | COMPONENT}";`,
      `$MS("1:foo","bar");`,
      `$MC(1,0,function(){return(${
        // @ts-ignore this
        String(() => ({ foo: this.foo }))}).call(this)},["1:foo"]);`,
      `</script>`,
    ].join(""),
  );

  assertEquals(
    await renderToString(<LazyAppWithImplicitComputedProps />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<m-component name="App" props="base64,eyJmb28iOiJiYXIiLCJjb2xvciI6ImJsdWUifQ=="><p>loading...</p></m-component>`,
      `<m-group hidden><m-signal mode="[props]" scope="1" computed="0" hidden></m-signal></m-group>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      RENDER_ATTR_JS,
      SIGNALS_JS,
      COMPONENT_JS,
      `})();`,
      `/* --- */`,
      `window.$FLAGS="1|0|${RENDER_ATTR | SIGNALS | COMPONENT}";`,
      `$MS("1:foo","bar");`,
      `$MC(1,0,function(){return(()=>$patch({"foo":"bar","color":"blue"},[this["foo"],"foo"])).call(this)},["1:foo"]);`,
      `</script>`,
    ].join(""),
  );

  assertEquals(
    await renderToString(<LazyAppIsProp />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<m-component name="@comp_0" props="base64,eyJmb28iOiJiYXIifQ=="><p>loading...</p></m-component>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      COMPONENT_JS,
      `})();`,
      `/* --- */`,
      `window.$FLAGS="1|0|${COMPONENT}";`,
      `</script>`,
    ].join(""),
  );

  assertEquals(
    await renderToString(<LazyAppAsProp />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<m-component name="@comp_1" props="base64,eyJmb28iOiJiYXIifQ=="><p>loading...</p></m-component>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      COMPONENT_JS,
      `})();`,
      `/* --- */`,
      `window.$FLAGS="1|0|${COMPONENT}";`,
      `</script>`,
    ].join(""),
  );

  assertEquals(
    JSON.parse(
      await renderToString(<div />, {
        components: { App },
        request: new Request("https://example.com", {
          headers: {
            "x-component": "App",
            "x-props": JSON.stringify({ foo: "bar" }),
            "x-flags": "1|0|" + COMPONENT,
          },
        }),
      }),
    ),
    [
      `<h1>bar</h1>`,
      `window.$FLAGS="2|0|${COMPONENT}";`,
    ],
  );

  assertEquals(
    JSON.parse(
      await renderToString(<div />, {
        request: new Request("https://example.com", {
          headers: {
            "x-component": "@comp_0",
            "x-props": JSON.stringify({ foo: "bar" }),
            "x-flags": "1|0|" + COMPONENT,
          },
        }),
      }),
    ),
    [
      `<h1>bar</h1>`,
      `window.$FLAGS="2|0|${COMPONENT}";`,
    ],
  );

  assertEquals(
    JSON.parse(
      await renderToString(<div />, {
        request: new Request("https://example.com", {
          headers: {
            "x-component": "@comp_1",
            "x-props": JSON.stringify({ foo: "bar" }),
            "x-flags": "1|0|" + COMPONENT,
          },
        }),
      }),
    ),
    [
      `<h2>bar</h2>`,
      `window.$FLAGS="2|0|${COMPONENT}";`,
    ],
  );
});

Deno.test("[ssr] <router>", async () => {
  const routes = {
    "/": () => <h1>Home</h1>,
    "/about": () => <h1>About</h1>,
    "/blog": () => Promise.resolve(<h1>Blog</h1>),
  };
  function Router(this: FC) {
    return (
      <router>
        <p>Page not found</p>
      </router>
    );
  }

  assertEquals(
    await renderToString(<Router />, {
      routes,
      request: new Request("https://example.com/"),
    }),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<m-router>`,
      `<h1>Home</h1>`,
      `<template m-slot><p>Page not found</p></template>`,
      `</m-router>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      ROUTER_JS,
      `})();`,
      `/* --- */`,
      `window.$FLAGS="2|0|${ROUTER}";`,
      `</script>`,
    ].join(""),
  );

  assertEquals(
    await renderToString(<Router />, {
      routes,
      request: new Request("https://example.com/about"),
    }),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<m-router>`,
      `<h1>About</h1>`,
      `<template m-slot><p>Page not found</p></template>`,
      `</m-router>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      ROUTER_JS,
      `})();`,
      `/* --- */`,
      `window.$FLAGS="2|0|${ROUTER}";`,
      `</script>`,
    ].join(""),
  );

  assertEquals(
    await renderToString(<Router />, {
      routes,
      request: new Request("https://example.com/blog"),
    }),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<m-router>`,
      `<h1>Blog</h1>`,
      `<template m-slot><p>Page not found</p></template>`,
      `</m-router>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      ROUTER_JS,
      `})();`,
      `/* --- */`,
      `window.$FLAGS="2|0|${ROUTER}";`,
      `</script>`,
    ].join(""),
  );

  assertEquals(
    await renderToString(<Router />, {
      routes,
      request: new Request("https://example.com/404"),
    }),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<m-router fallback>`,
      `<p>Page not found</p>`,
      `</m-router>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      ROUTER_JS,
      `})();`,
      `/* --- */`,
      `window.$FLAGS="1|0|${ROUTER}";`,
      `</script>`,
    ].join(""),
  );

  assertEquals(
    JSON.parse(
      await renderToString(<div />, {
        routes,
        request: new Request("https://example.com", {
          headers: {
            "x-route": "true",
            "x-flags": "1|0|" + ROUTER,
          },
        }),
      }),
    ),
    [
      `<h1>Home</h1>`,
      'window.$FLAGS="2|0|' + ROUTER + '";',
    ],
  );

  assertEquals(
    JSON.parse(
      await renderToString(<div />, {
        routes,
        request: new Request("https://example.com/about", {
          headers: {
            "x-route": "true",
            "x-flags": "1|0|" + ROUTER,
          },
        }),
      }),
    ),
    [
      `<h1>About</h1>`,
      'window.$FLAGS="2|0|' + ROUTER + '";',
    ],
  );

  assertEquals(
    JSON.parse(
      await renderToString(<div />, {
        routes,
        request: new Request("https://example.com/404", {
          headers: {
            "x-route": "true",
            "x-flags": "1|0|" + ROUTER,
          },
        }),
      }),
    ),
    {
      error: { message: "Route not found" },
      status: 404,
    },
  );
});

Deno.test("[ssr] <redirect>", async () => {
  assertEquals(
    await renderToString(<redirect />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `</body></html>`,
    ].join(""),
  );
  assertEquals(
    await renderToString(<redirect to="/dash" />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `{let u=decodeURI("/dash");if(window.$router){$router.navigate(u)}else{location.href=u}}`,
      `</script>`,
    ].join(""),
  );
  assertEquals(
    await renderToString(<redirect to="/dash" replace />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `{let u=decodeURI("/dash");if(window.$router){$router.navigate(u,!1)}else{location.href=u}}`,
      `</script>`,
    ].join(""),
  );
  assertEquals(
    await renderToString(<redirect to={new URL("/dash", "https://example.com")} />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `{let u=decodeURI("https://example.com/dash");if(window.$router){$router.navigate(u)}else{location.href=u}}`,
      `</script>`,
    ].join(""),
  );
});

Deno.test("[ssr] <invalid>", async () => {
  assertEquals(
    await renderToString(<invalid />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `</body></html>`,
    ].join(""),
  );
  assertEquals(
    await renderToString(<invalid for="foo" />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<m-invalid for="foo" hidden></m-invalid>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      FORM_JS,
      `})();/* --- */window.$FLAGS="0|0|1024";`,
      `</script>`,
    ].join(""),
  );
  assertEquals(
    await renderToString(
      <invalid for="foo">
        invalid foo
      </invalid>,
    ),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<m-invalid for="foo" hidden>invalid foo</m-invalid>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      FORM_JS,
      `})();/* --- */window.$FLAGS="0|0|1024";`,
      `</script>`,
    ].join(""),
  );
});

Deno.test("[ssr] this.app.url", async () => {
  function Router(this: FC) {
    this.effect(() => console.log(this.app.url));
    return (
      <router>
        <p>Page not found</p>
      </router>
    );
  }

  assertEquals(
    await renderToString(<Router />, {
      routes: {
        "/": () => <h1>Home</h1>,
        "/about": () => <h1>About</h1>,
      },
      request: new Request("https://example.com/"),
    }),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<m-router>`,
      `<h1>Home</h1>`,
      `<template m-slot><p>Page not found</p></template>`,
      `</m-router>`,
      `<m-effect scope="1" n="1" hidden></m-effect>`,
      `</body></html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      SIGNALS_JS,
      ROUTER_JS,
      `})();`,
      `/* --- */`,
      `window.$FLAGS="2|0|${SIGNALS | ROUTER}";`,
      `function $ME_1_0(){return(()=>console.log(this.app.url)).call(this)};`,
      `$MS("0:url",new URL("https://example.com/"));`,
      `</script>`,
    ].join(""),
  );
});

Deno.test("[ssr] XSS", async () => {
  const App = () => (
    <>
      {html`<h1>Welcome to mono-jsx!</h1><script>console.log("Welcome to mono-jsx!")</script>`}
      <style>{css`body{font-size:"16px"}`}</style>
      <script>{js`console.log('Welcome to mono-jsx!')`}</script>
    </>
  );
  assertEquals(
    await renderToString(<App />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<h1>Welcome to mono-jsx!</h1><script>console.log("Welcome to mono-jsx!")</script>`,
      `<style>body{font-size:"16px"}</style>`,
      `<script>console.log('Welcome to mono-jsx!')</script>`,
      `</body></html>`,
    ].join(""),
  );

  assertEquals(
    await renderToString(
      // @ts-ignore
      <h1 title={'"><script></script>'} class={['">', "<script>", "</script>"]} style={{ "<script></script>": '"><script></script>' }}>
        {"<script></script>"}
      </h1>,
    ),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<h1 title="&quot;&gt;&lt;script&gt;&lt;/script&gt;" class="&quot;&gt; &lt;script&gt; &lt;/script&gt;" style="&lt;script&gt;&lt;/script&gt;:&quot;&gt;&lt;script&gt;&lt;/script&gt;">`,
      `&lt;script&gt;&lt;/script&gt;`,
      `</h1>`,
      `</body></html>`,
    ].join(""),
  );
});

declare global {
  namespace JSX {
    interface CustomElements {
      "greeting": { message: string };
    }
  }
}

Deno.test("[ssr] custom elements", async () => {
  JSX.customElements.define("greeting", ({ message }: { message: string }) => (
    <h1>
      {message}
      <slot />
    </h1>
  ));
  assertEquals(
    await renderToString(
      <greeting message={"Hello, world"}>
        <span>!</span>
      </greeting>,
    ),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<h1>Hello, world<span>!</span></h1>`,
      `</body></html>`,
    ].join(""),
  );
});

Deno.test("[ssr] htmx integration", async () => {
  assertEquals(
    await renderToString(
      <button type="button" hx-post="/clicked" hx-swap="outerHTML">
        Click Me
      </button>,
      { htmx: 2, "htmx-ext-response-targets": "2.0.2" },
    ),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<button type="button" hx-post="/clicked" hx-swap="outerHTML">Click Me</button>`,
      `</body></html>`,
      `<script src="https://raw.esm.sh/htmx.org@2/dist/htmx.min.js"></script>`,
      `<script src="https://raw.esm.sh/htmx-ext-response-targets@2.0.2"></script>`,
    ].join(""),
  );
});
