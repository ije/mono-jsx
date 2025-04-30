// deno-lint-ignore-file jsx-key jsx-curly-braces
import { assert, assertEquals } from "jsr:@std/assert";
import { STATE_JS, SUSPENSE_JS, UTILS_JS } from "../runtime/index.ts";
import { RenderOptions } from "../types/render.d.ts";

const renderToString = (node: JSX.Element, renderOptions?: RenderOptions) => {
  const res = (
    <html lang="en" headers={{ setCookie: "foo=bar" }} {...renderOptions}>
      <body>{node}</body>
    </html>
  );
  assert(res instanceof Response, "Response is not a Response object");
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("content-type"), "text/html; charset=utf-8");
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
  function* For({ items }: { items: unknown[] }) {
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

Deno.test("[ssr] style", async () => {
  const hashCode = (s: string) => [...s].reduce((hash, c) => (Math.imul(31, hash) + c.charCodeAt(0)) | 0, 0);

  assertEquals(
    await renderToString(<div style="display:block" />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<div style="display:block"></div>`,
      `</body></html>`,
    ].join(""),
  );

  assertEquals(
    await renderToString(<div style={{ display: "block", border: 1, lineHeight: 1 }} />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<div style="display:block;border:1px;line-height:1"></div>`,
      `</body></html>`,
    ].join(""),
  );

  "pseudo class";
  {
    const id = hashCode("background-color:#fff|:hover>background-color:#eee").toString(36);
    assertEquals(
      await renderToString(
        <button type="button" role="button" style={{ backgroundColor: "#fff", ":hover": { backgroundColor: "#eee" } }}>Click me</button>,
      ),
      [
        `<!DOCTYPE html>`,
        `<html lang="en"><body>`,
        `<style id="css-${id}">[data-css-${id}]{background-color:#fff}[data-css-${id}]:hover{background-color:#eee}</style>`,
        `<button type="button" role="button" data-css-${id}>Click me</button>`,
        `</body></html>`,
      ].join(""),
    );
  }

  "pseudo element";
  {
    const id = hashCode('color:blue|::after>content:"↩"').toString(36);
    assertEquals(
      await renderToString(
        <a class="link" style={{ color: "blue", "::after": { content: "↩" } }}>Link</a>,
      ),
      [
        `<!DOCTYPE html>`,
        `<html lang="en"><body>`,
        `<style id="css-${id}">[data-css-${id}]{color:blue}[data-css-${id}]::after{content:"↩"}</style>`,
        `<a class="link" data-css-${id}>Link</a>`,
        `</body></html>`,
      ].join(""),
    );
  }

  "@media query";
  {
    const id = hashCode("color:black|@media (prefers-color-scheme: dark)>color:white").toString(36);
    assertEquals(
      await renderToString(
        <h1 class="title" style={{ color: "black", "@media (prefers-color-scheme: dark)": { color: "white" } }}>
          Hello World!
        </h1>,
      ),
      [
        `<!DOCTYPE html>`,
        `<html lang="en"><body>`,
        `<style id="css-${id}">[data-css-${id}]{color:black}@media (prefers-color-scheme: dark){[data-css-${id}]{color:white}}</style>`,
        `<h1 class="title" data-css-${id}>Hello World!</h1>`,
        `</body></html>`,
      ].join(""),
    );
  }

  "nesting style";
  {
    const id = hashCode("color:black|&.title>font-size:20px|& strong>color:grey").toString(36);
    assertEquals(
      await renderToString(
        <h1 class="title" style={{ color: "black", "&.title": { fontSize: 20 }, "& strong": { color: "grey" } }}>
          <strong>Hello</strong> World!
        </h1>,
      ),
      [
        `<!DOCTYPE html>`,
        `<html lang="en"><body>`,
        `<style id="css-${id}">[data-css-${id}]{color:black}[data-css-${id}].title{font-size:20px}[data-css-${id}] strong{color:grey}</style>`,
        `<h1 class="title" data-css-${id}><strong>Hello</strong> World!</h1>`,
        `</body></html>`,
      ].join(""),
    );
  }
});

Deno.test("[ssr] event handler", async () => {
  assertEquals(
    await renderToString(<button type="button" onClick={() => console.log("🔥" as string)}>Click me</button>),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<script>function $MF_0(e){(()=>console.log("🔥"))(e)}</script>`,
      `<button type="button" onclick="$emit(event,this,$MF_0)">Click me</button>`,
      `</body></html>`,
      `<script>(()=>{`,
      UTILS_JS.event,
      `})()</script>`,
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
      `<script>function $MF_0(fd){((data)=>console.log(data))(fd)}</script>`,
      `<form onsubmit="$onsubmit(event,this,$MF_0)">`,
      `<input name="foo">`,
      `</form>`,
      `</body></html>`,
      `<script>(()=>{`,
      UTILS_JS.event,
      `})()</script>`,
    ].join(""),
  );
  assertEquals(
    await renderToString(<div onMount={(e) => console.log(e.target)}>Using HTML</div>),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<div>Using HTML</div>`,
      `<script>{const target=document.currentScript.previousElementSibling;addEventListener("load",()=>$emit({type:"mount",currentTarget:target,target},target,`,
      `(e)=>console.log(e.target)`,
      `))}</script>`,
      `</body></html>`,
      `<script>(()=>{`,
      UTILS_JS.event,
      `})()</script>`,
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
  const dir = new URL("..", import.meta.url).pathname;
  const entries = [...Deno.readDirSync(dir)];

  async function ReadDir({ path }: { path: string }) {
    const entryNames = [];
    for await (const entry of Deno.readDir(path)) {
      entryNames.push(entry.name);
    }
    return <ul>{entryNames.map((name) => <li>{name}</li>)}</ul>;
  }

  "eager rendering";
  {
    const App = () => <ReadDir path={dir} rendering="eager" />;
    assertEquals(
      await renderToString(<App />),
      [
        `<!DOCTYPE html>`,
        `<html lang="en"><body>`,
        `<ul>`,
        ...entries.map((entry) => `<li>${entry.name}</li>`),
        `</ul>`,
        `</body></html>`,
      ].join(""),
    );
  }

  "without placeholder";
  {
    const App = () => <ReadDir path={dir} />;
    assertEquals(
      await renderToString(<App />),
      [
        `<!DOCTYPE html>`,
        `<html lang="en"><body>`,
        `<m-portal chunk-id="1"></m-portal>`,
        `</body></html>`,
        `<script>(()=>{`,
        SUSPENSE_JS,
        `})()</script>`,
        `<m-chunk chunk-id="1"><template>`,
        `<ul>`,
        ...entries.map((entry) => `<li>${entry.name}</li>`),
        `</ul>`,
        `</template></m-chunk>`,
      ].join(""),
    );
  }

  "with placeholder";
  {
    const App = () => <ReadDir path={dir} placeholder={<p>loading...</p>} />;
    assertEquals(
      await renderToString(<App />),
      [
        `<!DOCTYPE html>`,
        `<html lang="en"><body>`,
        `<m-portal chunk-id="1">`,
        `<p>loading...</p>`,
        `</m-portal>`,
        `</body></html>`,
        `<script>(()=>{`,
        SUSPENSE_JS,
        `})()</script>`,
        `<m-chunk chunk-id="1"><template>`,
        `<ul>`,
        ...entries.map((entry) => `<li>${entry.name}</li>`),
        `</ul>`,
        `</template></m-chunk>`,
      ].join(""),
    );
  }
});

Deno.test("[ssr] async generator component", async () => {
  const dir = new URL("..", import.meta.url).pathname;
  const entries = [...Deno.readDirSync(dir)];

  async function* ReadDir({ path }: { path: string }) {
    const entries = Deno.readDir(path);
    for await (const { name } of entries) {
      yield <li>{name}</li>;
    }
  }

  "eager rendering";
  {
    const App = () => (
      <ul>
        <ReadDir path={dir} rendering="eager" />
      </ul>
    );
    assertEquals(
      await renderToString(<App />),
      [
        `<!DOCTYPE html>`,
        `<html lang="en"><body>`,
        `<ul>`,
        ...entries.map((entry) => `<li>${entry.name}</li>`),
        `</ul>`,
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
    await renderToString(<Boom catch={(err: Error) => <p>error: {err.message}</p>} />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<p>error: Boom!</p>`,
      `</body></html>`,
    ].join(""),
  );
});

Deno.test("[ssr] use state", async () => {
  function Foo(this: FC<{ foo: string }>) {
    return <span>{this.foo}</span>;
  }

  assertEquals(
    await renderToString(<Foo />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<span>`,
      `<m-state fc="1" key="foo"></m-state>`,
      `</span>`,
      `</body></html>`,
      `<script>(()=>{`,
      STATE_JS,
      `for(let[k,v]of`,
      `[["1:foo"]]`,
      `)$defineState(k,v);})()</script>`,
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
      `<m-state mode="[title]" fc="1" key="foo"></m-state>`,
      `<m-state fc="1" key="foo">bar</m-state>`,
      `</span>`,
      `</body></html>`,
      `<script>(()=>{`,
      STATE_JS,
      `for(let[k,v]of`,
      `[["1:foo","bar"]]`,
      `)$defineState(k,v);})()</script>`,
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
      `<m-group>`,
      `<m-state mode="[value]" fc="1" key="value"></m-state>`,
      `</m-group>`,
      `</body></html>`,
      `<script>(()=>{`,
      STATE_JS,
      `for(let[k,v]of`,
      `[["1:value","Welcome to mono-jsx!"]]`,
      `)$defineState(k,v);})()</script>`,
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
          `<m-group>`,
          `<m-state mode="[value]" fc="${i}" key="value"></m-state>`,
          `</m-group>`,
        ].join("")
      ).join(""),
      `</div></body></html>`,
      `<script>(()=>{`,
      STATE_JS,
      `for(let[k,v]of`,
      JSON.stringify([1, 2, 3].map((i) => [`${i}:value`, i])),
      `)$defineState(k,v);})()</script>`,
    ].join(""),
  );
});

Deno.test("[ssr] use app state", async () => {
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
      { appState: { title: "Welcome to mono-jsx!" } },
    ),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<header><h1>`,
      `<m-state fc="0" key="title">Welcome to mono-jsx!</m-state>`,
      `</h1></header>`,
      `<main>`,
      `<script>function $MF_0(fd){((fd)=>this.app.title = fd.get("title"))(fd)}</script>`,
      `<form onsubmit="$onsubmit(event,this,$MF_0,2)">`,
      `<input name="title" value="Welcome to mono-jsx!">`,
      `<m-group><m-state mode="[value]" fc="0" key="title"></m-state></m-group>`,
      `</form>`,
      `</main>`,
      `<footer><p>`,
      `(c)2025 `,
      `<m-state fc="0" key="title">Welcome to mono-jsx!</m-state>`,
      `</p></footer>`,
      `</body></html>`,
      `<script>(()=>{`,
      UTILS_JS.event,
      STATE_JS,
      `for(let[k,v]of`,
      `[["0:title","Welcome to mono-jsx!"]]`,
      `)$defineState(k,v);`,
      `})()</script>`,
    ].join(""),
  );
});

Deno.test("[ssr] use computed", async () => {
  function FooBar(this: FC<{ foo: string; bar: string }, { tailing: string }>) {
    this.foo = "foo";
    this.bar = "bar";
    const className = this.computed(() => [this.foo, this.bar]);
    const text = this.computed(() => this.foo + this.bar + this.app.tailing);
    return <span class={className} title={text}>{text}</span>;
  }

  assertEquals(
    await renderToString(<FooBar />, { appState: { tailing: "!" } }),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<span class="foo bar" title="foobar!">`,
      `<m-state mode="[class]" fc="1" computed><script type="computed">$(${
        // @ts-ignore this
        String(() => [this.foo, this.bar])}, ["1:foo","1:bar"])</script></m-state>`,
      `<m-state mode="[title]" fc="1" computed><script type="computed">$(${
        // @ts-ignore this
        String(() => this.foo + this.bar + this.app.tailing)}, ["1:foo","1:bar","0:tailing"])</script></m-state>`,
      `<m-state fc="1" computed><script type="computed">$(${
        // @ts-ignore this
        String(() => this.foo + this.bar + this.app.tailing)}, ["1:foo","1:bar","0:tailing"])</script>foobar!</m-state>`,
      `</span>`,
      `</body></html>`,
      `<script>(()=>{`,
      UTILS_JS.cx,
      STATE_JS,
      `for(let[k,v]of`,
      `[["1:foo","foo"],["1:bar","bar"],["0:tailing","!"]]`,
      `)$defineState(k,v);`,
      `})()</script>`,
    ].join(""),
  );
});

Deno.test("[ssr] use request object", async () => {
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

Deno.test("[ssr] use context", async () => {
  function App(this: FC<{}, {}, { foo: string }>) {
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

Deno.test("[ssr] use <toggle>", async () => {
  function Toggle(this: FC<{ show: boolean }>, props: { show?: boolean }) {
    this.show = !!props.show;
    return (
      <toggle value={this.show}>
        <h1>👋</h1>
      </toggle>
    );
  }

  assertEquals(
    await renderToString(<Toggle />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<m-state mode="toggle" fc="1" key="show">`,
      `<template m-slot><h1>👋</h1></template>`,
      `</m-state>`,
      `</body></html>`,
      `<script>(()=>{`,
      STATE_JS,
      `for(let[k,v]of`,
      `[["1:show",false]]`,
      `)$defineState(k,v);})()</script>`,
    ].join(""),
  );

  assertEquals(
    await renderToString(<Toggle show />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<m-state mode="toggle" fc="1" key="show">`,
      `<h1>👋</h1>`,
      `</m-state>`,
      `</body></html>`,
      `<script>(()=>{`,
      STATE_JS,
      `for(let[k,v]of`,
      `[["1:show",true]]`,
      `)$defineState(k,v);})()</script>`,
    ].join(""),
  );
});

Deno.test("[ssr] use <switch>", async () => {
  function Switch(this: FC<{ select?: string }>, props: { defaultValue?: string }) {
    return (
      <switch value={this.select} defaultValue={props.defaultValue}>
        <span slot="a">A</span>
        <span slot="b">B</span>
        <span>C</span>
        <span>D</span>
      </switch>
    );
  }

  assertEquals(
    await renderToString(<Switch defaultValue="a" />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<m-state mode="switch" fc="1" key="select" match="a">`,
      `<span>A</span>`,
      `<template m-slot><span slot="b">B</span><span>C</span><span>D</span></template>`,
      `</m-state>`,
      `</body></html>`,
      `<script>(()=>{`,
      STATE_JS,
      `for(let[k,v]of`,
      `[["1:select","a"]]`,
      `)$defineState(k,v);})()</script>`,
    ].join(""),
  );

  assertEquals(
    await renderToString(<Switch defaultValue="b" />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<m-state mode="switch" fc="1" key="select" match="b">`,
      `<span>B</span>`,
      `<template m-slot><span slot="a">A</span><span>C</span><span>D</span></template>`,
      `</m-state>`,
      `</body></html>`,
      `<script>(()=>{`,
      STATE_JS,
      `for(let[k,v]of`,
      `[["1:select","b"]]`,
      `)$defineState(k,v);})()</script>`,
    ].join(""),
  );

  assertEquals(
    await renderToString(<Switch />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<m-state mode="switch" fc="1" key="select">`,
      `<span>C</span><span>D</span>`,
      `<template m-slot><span slot="a">A</span><span slot="b">B</span></template>`,
      `</m-state>`,
      `</body></html>`,
      `<script>(()=>{`,
      STATE_JS,
      `for(let[k,v]of`,
      `[["1:select"]]`,
      `)$defineState(k,v);})()</script>`,
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
      `<h1 title="&quot;&gt;&lt;script&gt;&lt;/script&gt;" class="&quot;&gt; &lt;script&gt; &lt;/script&gt;" style="&lt;script&gt;&lt;/script&gt;:'&gt;&lt;script&gt;&lt;/script&gt;">`,
      `&lt;script&gt;&lt;/script&gt;`,
      `</h1>`,
      `</body></html>`,
    ].join(""),
  );
});

Deno.test("[ssr] Excaped XSS", async () => {
  const payload = '<script>alert("xss")</script>';
  const App = () => (
    <div>
      {safeHtml`User input: ${payload}`}
    </div>
  );
  assertEquals(
    await renderToString(<App />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<div>`,
      `User input: &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;`,
      `</div>`,
      `</body></html>`,
    ].join(""),
  );
});

Deno.test("[ssr] htmx", async () => {
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
