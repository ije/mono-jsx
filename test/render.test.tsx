// deno-lint-ignore-file jsx-key jsx-curly-braces
import { assert, assertEquals } from "jsr:@std/assert";
import { SIGNALS_JS, SUSPENSE_JS, UTILS_JS } from "../runtime/index.ts";
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

Deno.test("[ssr] stringify `style` prop", async () => {
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
});

Deno.test("[ssr] style to css", async () => {
  const hashCode = (s: string) => [...s].reduce((hash, c) => (Math.imul(31, hash) + c.charCodeAt(0)) | 0, 0);

  "pseudo class";
  {
    const id = hashCode(":hover{background-color:#eee}").toString(36);
    assertEquals(
      await renderToString(
        <button type="button" role="button" style={{ backgroundColor: "#fff", ":hover": { backgroundColor: "#eee" } }}>Click me</button>,
      ),
      [
        `<!DOCTYPE html>`,
        `<html lang="en"><body>`,
        `<style id="css-${id}">[data-css-${id}]:hover{background-color:#eee}</style>`,
        `<button type="button" role="button" style="background-color:#fff" data-css-${id}>Click me</button>`,
        `</body></html>`,
      ].join(""),
    );
  }

  "pseudo element";
  {
    const id = hashCode('::after{content:"↩"}').toString(36);
    assertEquals(
      await renderToString(
        <a class="link" style={{ color: "blue", "::after": { content: "↩" } }}>Link</a>,
      ),
      [
        `<!DOCTYPE html>`,
        `<html lang="en"><body>`,
        `<style id="css-${id}">[data-css-${id}]::after{content:"↩"}</style>`,
        `<a class="link" style="color:blue" data-css-${id}>Link</a>`,
        `</body></html>`,
      ].join(""),
    );
  }

  "@media query";
  {
    const id = hashCode("@media (prefers-color-scheme: dark){{color:white}}").toString(36);
    assertEquals(
      await renderToString(
        <h1 class="title" style={{ color: "black", "@media (prefers-color-scheme: dark)": { color: "white" } }}>
          Hello World!
        </h1>,
      ),
      [
        `<!DOCTYPE html>`,
        `<html lang="en"><body>`,
        `<style id="css-${id}">@media (prefers-color-scheme: dark){[data-css-${id}]{color:white}}</style>`,
        `<h1 class="title" style="color:black" data-css-${id}>Hello World!</h1>`,
        `</body></html>`,
      ].join(""),
    );
  }

  "nesting style";
  {
    const id = hashCode(".title{font-size:20px} strong{color:grey}").toString(36);
    assertEquals(
      await renderToString(
        <h1 class="title" style={{ color: "black", "&.title": { fontSize: 20 }, "& strong": { color: "grey" } }}>
          <strong>Hello</strong> World!
        </h1>,
      ),
      [
        `<!DOCTYPE html>`,
        `<html lang="en"><body>`,
        `<style id="css-${id}">[data-css-${id}].title{font-size:20px}[data-css-${id}] strong{color:grey}</style>`,
        `<h1 class="title" style="color:black" data-css-${id}><strong>Hello</strong> World!</h1>`,
        `</body></html>`,
      ].join(""),
    );
  }
});

Deno.test("[ssr] serialize event handler", async () => {
  assertEquals(
    await renderToString(<button type="button" onClick={() => console.log("🔥" as string)}>Click me</button>),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<button type="button" onclick="$emit(event,$MF_0)">Click me</button>`,
      `</body></html>`,
      `<script>`,
      `/* runtime.js (generated by mono-jsx) */`,
      `(()=>{`,
      UTILS_JS.event,
      `})()</script>`,
      `<script>/* app.js (generated by mono-jsx) */`,
      `function $MF_0(){(()=>console.log("🔥")).apply(this,arguments)};`,
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
      `<form onsubmit="$onsubmit(event,$MF_0)">`,
      `<input name="foo">`,
      `</form>`,
      `</body></html>`,
      `<script>`,
      `/* runtime.js (generated by mono-jsx) */`,
      `(()=>{`,
      UTILS_JS.event,
      `})()</script>`,
      `<script>`,
      `/* app.js (generated by mono-jsx) */`,
      `function $MF_0(){((data)=>console.log(data)).apply(this,arguments)};`,
      `</script>`,
    ].join(""),
  );

  assertEquals(
    await renderToString(<div ref={(el) => console.log("onmount", el)}>Using HTML</div>),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<div onmount="$emit(event,$MF_0)">Using HTML</div>`,
      `</body></html>`,
      `<script>`,
      `/* runtime.js (generated by mono-jsx) */`,
      `(()=>{`,
      UTILS_JS.event,
      `})()</script>`,
      `<script>/* app.js (generated by mono-jsx) */`,
      `function $MF_0(){((el)=>console.log("onmount", el)).apply(this,arguments)};`,
      `$onstage();`,
      `</script>`,
    ].join(""),
  );
});

Deno.test("[ssr] <slot> element", async () => {
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
        `<script>`,
        `/* runtime.js (generated by mono-jsx) */`,
        `(()=>{`,
        SUSPENSE_JS,
        `})()</script>`,
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
        `<script>`,
        `/* runtime.js (generated by mono-jsx) */`,
        `(()=>{`,
        SUSPENSE_JS,
        `})()</script>`,
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
        `<script>`,
        `/* runtime.js (generated by mono-jsx) */`,
        `(()=>{`,
        SUSPENSE_JS,
        `})()</script>`,
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
        `<script>`,
        `/* runtime.js (generated by mono-jsx) */`,
        `(()=>{`,
        SUSPENSE_JS,
        `})()</script>`,
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
        `<script>`,
        `/* runtime.js (generated by mono-jsx) */`,
        `(()=>{`,
        SUSPENSE_JS,
        `})()</script>`,
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
        `<script>`,
        `/* runtime.js (generated by mono-jsx) */`,
        `(()=>{`,
        SUSPENSE_JS,
        `})()</script>`,
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
        `<script>`,
        `/* runtime.js (generated by mono-jsx) */`,
        `(()=>{`,
        SUSPENSE_JS,
        `})()</script>`,
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
        `<script>`,
        `/* runtime.js (generated by mono-jsx) */`,
        `(()=>{`,
        SUSPENSE_JS,
        `})()</script>`,
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

Deno.test("[ssr] signals", async () => {
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
      `<script>`,
      `/* runtime.js (generated by mono-jsx) */`,
      `(()=>{`,
      SIGNALS_JS,
      `})()</script>`,
      `<script>/* app.js (generated by mono-jsx) */`,
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
      `<m-signal mode="[title]" scope="1" key="foo"></m-signal>`,
      `<m-signal scope="1" key="foo">bar</m-signal>`,
      `</span>`,
      `</body></html>`,
      `<script>`,
      `/* runtime.js (generated by mono-jsx) */`,
      `(()=>{`,
      SIGNALS_JS,
      `})()</script>`,
      `<script>/* app.js (generated by mono-jsx) */`,
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
      `<m-group>`,
      `<m-signal mode="[value]" scope="1" key="value"></m-signal>`,
      `</m-group>`,
      `</body></html>`,
      `<script>`,
      `/* runtime.js (generated by mono-jsx) */`,
      `(()=>{`,
      SIGNALS_JS,
      `})()</script>`,
      `<script>/* app.js (generated by mono-jsx) */`,
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
          `<m-group>`,
          `<m-signal mode="[value]" scope="${i}" key="value"></m-signal>`,
          `</m-group>`,
        ].join("")
      ).join(""),
      `</div></body></html>`,
      `<script>`,
      `/* runtime.js (generated by mono-jsx) */`,
      `(()=>{`,
      SIGNALS_JS,
      `})()</script>`,
      `<script>/* app.js (generated by mono-jsx) */`,
      [1, 2, 3].map((i) => `$MS("${i}:value",${i});`).join(""),
      `</script>`,
    ].join(""),
  );
});

Deno.test("[ssr] signal as a prop", async () => {
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
      `<button type="button" onclick="$emit(event,$MF_0,1)">Click Me</button>`,
      `</div>`,
      `</body></html>`,
      `<script>`,
      `/* runtime.js (generated by mono-jsx) */`,
      `(()=>{`,
      UTILS_JS.event,
      SIGNALS_JS,
      `})()</script>`,
      `<script>/* app.js (generated by mono-jsx) */`,
      `function $MF_0(){(()=>this.foo = "baz").apply(this,arguments)};`,
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
      `<form onsubmit="$onsubmit(event,$MF_0,2)">`,
      `<input name="title" value="Welcome to mono-jsx!">`,
      `<m-group><m-signal mode="[value]" scope="0" key="title"></m-signal></m-group>`,
      `</form>`,
      `</main>`,
      `<footer><p>`,
      `(c)2025 `,
      `<m-signal scope="0" key="title">Welcome to mono-jsx!</m-signal>`,
      `</p></footer>`,
      `</body></html>`,
      `<script>`,
      `/* runtime.js (generated by mono-jsx) */`,
      `(()=>{`,
      UTILS_JS.event,
      SIGNALS_JS,
      `})()</script>`,
      `<script>/* app.js (generated by mono-jsx) */`,
      `function $MF_0(){((fd)=>this.app.title = fd.get("title")).apply(this,arguments)};`,
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
    const text = this.computed(() => this.foo + this.bar + this.app.tailing);
    return <span class={className} style={style} title={text}>{text}</span>;
  }

  assertEquals(
    await renderToString(<FooBar />, { app: { themeColor: "black", tailing: "!" } }),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<span class="foo bar" style="color:black" title="foobar!">`,
      `<m-signal mode="[class]" scope="1" computed="0"></m-signal>`,
      `<m-signal mode="[style]" scope="1" computed="1"></m-signal>`,
      `<m-signal mode="[title]" scope="1" computed="2"></m-signal>`,
      `<m-signal scope="1" computed="2">foobar!</m-signal>`,
      `</span>`,
      `</body></html>`,
      `<script>`,
      `/* runtime.js (generated by mono-jsx) */`,
      `(()=>{`,
      UTILS_JS.cx,
      UTILS_JS.styleToCSS,
      SIGNALS_JS,
      `})()</script>`,
      `<script>/* app.js (generated by mono-jsx) */`,
      `$MS("1:foo","foo");`,
      `$MS("1:bar","bar");`,
      `$MS("0:themeColor","black");`,
      `$MS("0:tailing","!");`,
      `$MC(0,function(){return(${
        // @ts-ignore this
        String(() => [this.foo, this.bar])}).call(this)},["1:foo","1:bar"]);`,
      `$MC(1,function(){return(${
        // @ts-ignore this
        String(() => ({ color: this.app.themeColor }))}).call(this)},["0:themeColor"]);`,
      `$MC(2,function(){return(${
        // @ts-ignore this
        String(() => this.foo + this.bar + this.app.tailing)}).call(this)},["1:foo","1:bar","0:tailing"]);`,
      `</script>`,
    ].join(""),
  );
});

Deno.test("[ssr] effect", async () => {
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
      `<button type="button" onclick="$emit(event,$MF_0,1)">Click Me</button>`,
      `</div>`,
      `<m-effect scope="1" n="1"></m-effect>`,
      `</body></html>`,
      `<script>`,
      `/* runtime.js (generated by mono-jsx) */`,
      `(()=>{`,
      UTILS_JS.event,
      SIGNALS_JS,
      `})()</script>`,
      `<script>/* app.js (generated by mono-jsx) */`,
      `function $MF_0(){(()=>this.count++).apply(this,arguments)};`,
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
      `<button type="button" onclick="$emit(event,$MF_0,2)">Click Me</button>`,
      `</div>`,
      `<m-effect scope="2" n="1"></m-effect>`,
      `</m-signal>`,
      `<button type="button" onclick="$emit(event,$MF_1,1)">Toggle</button>`,
      `<m-effect scope="1" n="1"></m-effect>`,
      `</body></html>`,
      `<script>`,
      `/* runtime.js (generated by mono-jsx) */`,
      `(()=>{`,
      UTILS_JS.event,
      SIGNALS_JS,
      `})()</script>`,
      `<script>/* app.js (generated by mono-jsx) */`,
      `function $MF_0(){(()=>this.count++).apply(this,arguments)};`,
      `function $MF_1(){(()=>this.show = !this.show).apply(this,arguments)};`,
      `function $ME_2_0(){return(()=>console.log("count changed", this.count)).call(this)};`,
      `function $ME_1_0(){return(()=>console.log("Welcome to mono-jsx!")).call(this)};`,
      `$MS("1:show",true);`,
      `$MS("2:count",0);`,
      `</script>`,
    ].join(""),
  );
});

Deno.test("[ssr] refs", async () => {
  function App(this: FC) {
    this.effect(() => console.log(this.refs.h1!.textContent));
    return <h1 ref={this.refs.h1}>Welcome to mono-jsx!</h1>;
  }

  assertEquals(
    await renderToString(<App />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<h1 data-ref="1:h1">Welcome to mono-jsx!</h1>`,
      `<m-effect scope="1" n="1"></m-effect>`,
      `</body></html>`,
      `<script>`,
      `/* runtime.js (generated by mono-jsx) */`,
      `(()=>{`,
      SIGNALS_JS,
      `})()</script>`,
      `<script>/* app.js (generated by mono-jsx) */`,
      `function $ME_1_0(){return(()=>console.log(this.refs.h1.textContent)).call(this)};`,
      `</script>`,
    ].join(""),
  );
});

Deno.test("[ssr] stateful async component", async () => {
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
      `<script>`,
      `/* runtime.js (generated by mono-jsx) */`,
      `(()=>{`,
      SUSPENSE_JS,
      `})()</script>`,
      `<m-chunk chunk-id="0"><template>`,
      `<div>`,
      `<h1>`,
      `<m-signal scope="1" computed="0">Hello, me</m-signal>`,
      `!</h1>`,
      `<button type="button" onclick="$emit(event,$MF_0,1)">Logout</button>`,
      `</div>`,
      `</template></m-chunk>`,
      `<script>`,
      `/* runtime.js (generated by mono-jsx) */`,
      `(()=>{`,
      UTILS_JS.event,
      SIGNALS_JS,
      `})()</script>`,
      `<script>/* app.js (generated by mono-jsx) */`,
      `function $MF_0(){(()=>this.username = null).apply(this,arguments)};`,
      `$MS("1:username","me");`,
      `$MC(0,function(){return(()=>this.username ? "Hello, " + this.username : "Please login").call(this)},["1:username"]);`,
      `</script>`,
    ].join(""),
  );
});

Deno.test("[ssr] use `this.request`", async () => {
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

Deno.test("[ssr] use `this.context`", async () => {
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

Deno.test("[ssr] <toggle> element", async () => {
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

  assertEquals(
    await renderToString(<Toggle />),
    [
      `<!DOCTYPE html>`,
      `<html lang="en"><body>`,
      `<m-signal mode="toggle" scope="1" key="show">`,
      `<template m-slot><h1>👋</h1></template>`,
      `</m-signal>`,
      `</body></html>`,
      `<script>`,
      `/* runtime.js (generated by mono-jsx) */`,
      `(()=>{`,
      SIGNALS_JS,
      `})()</script>`,
      `<script>/* app.js (generated by mono-jsx) */`,
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
      `<script>`,
      `/* runtime.js (generated by mono-jsx) */`,
      `(()=>{`,
      SIGNALS_JS,
      `})()</script>`,
      `<script>/* app.js (generated by mono-jsx) */`,
      `$MS("1:show",true);`,
      `</script>`,
    ].join(""),
  );
});

Deno.test("[ssr] <switch> element", async () => {
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
      `<script>`,
      `/* runtime.js (generated by mono-jsx) */`,
      `(()=>{`,
      SIGNALS_JS,
      `})()</script>`,
      `<script>/* app.js (generated by mono-jsx) */`,
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
      `<script>`,
      `/* runtime.js (generated by mono-jsx) */`,
      `(()=>{`,
      SIGNALS_JS,
      `})()</script>`,
      `<script>/* app.js (generated by mono-jsx) */`,
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
      `<script>`,
      `/* runtime.js (generated by mono-jsx) */`,
      `(()=>{`,
      SIGNALS_JS,
      `})()</script>`,
      `<script>/* app.js (generated by mono-jsx) */`,
      `$MS("1:select");`,
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

Deno.test("[ssr] custom element", async () => {
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
