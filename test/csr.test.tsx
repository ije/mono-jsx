/// <reference lib="dom.iterable" />

import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1.0.19";
import puppeteer from "npm:puppeteer-core@24.37.5";
import chrome from "npm:puppeteer-chromium-resolver@24.0.3";
import { stop, transform } from "npm:esbuild@0.27.3";

let routeSeq = 0;
let testRoutes: Map<string, Promise<string>> = new Map();

const createTestPage = async (code: string) => {
  const js = (await transform(code, {
    loader: "tsx",
    platform: "browser",
    format: "esm",
    target: "es2022",
    jsx: "automatic",
    jsxImportSource: "mono-jsx/dom",
  })).code;
  return /*html*/ `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Test</title>
        <script type="importmap">
          {
            "imports": {
              "mono-jsx/dom": "/mono-jsx/dom/index.mjs",
              "mono-jsx/dom/jsx-runtime": "/mono-jsx/dom/jsx-runtime.mjs"
            }
          }
        </script>
      </head>
      <body>
        <script type="module">
          ${js}
        </script>
      </body>
    </html>
  `;
};

function addTestPage(code: string) {
  const pathname = `/test_${routeSeq++}`;
  testRoutes.set(pathname, createTestPage(code));
  return "http://localhost:8688" + pathname;
}

const browser = await puppeteer.launch({
  executablePath: (await chrome()).executablePath,
  args: ["--no-sandbox", "--disable-gpu", "--disable-extensions", "--disable-sync", "--disable-background-networking"],
});
const ac = new AbortController();
const sanitizeFalse = { sanitizeResources: false, sanitizeOps: false };

Deno.test.beforeAll(async () => {
  Deno.serve({ port: 8688, onListen: () => {}, signal: ac.signal }, async (request) => {
    const url = new URL(request.url);
    const { pathname } = url;
    if (pathname.startsWith("/mono-jsx/dom/")) {
      const f = await Deno.open("." + pathname.slice("/mono-jsx".length));
      return new Response(f.readable, { headers: { "Content-Type": "application/javascript; charset=utf-8" } });
    }
    if (pathname.startsWith("/test_")) {
      const code = await testRoutes.get(pathname);
      return new Response(code, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    return new Response("Not Found", { status: 404 });
  });

  const DEBUG = !true;
  if (DEBUG) {
    console.log(addTestPage(`
      import { atom } from "mono-jsx/dom";
      const count = atom(1);
      function App(this: FC) {
        return (
          <div>
            <p>2 * {count} = {this.$(() => 2*count.get())}</p>
            <button onClick={() => count.set(prev => prev+1)}>Increment</button>
          </div>
        )
      }
      document.body.mount(<App />);
    `));
    await new Promise(() => {});
  }
});

Deno.test.afterAll(async () => {
  ac.abort(); // close the server
  await browser.close();
  await stop();
});

Deno.test("[csr] mount", sanitizeFalse, async () => {
  const testUrl = addTestPage(`
    function App() {
      return <div>Hello, world!</div>;
    }

    const ac = new AbortController();
    document.body.mount(<><App /><button onClick={() => ac.abort()}>Unmount</button></>, ac.signal);
  `);
  const page = await browser.newPage();
  await page.goto(testUrl);

  let div = await page.$("body > div");
  assert(div);
  assertEquals(await div.evaluate((el) => el.textContent), "Hello, world!");

  let unmountButton = await page.$("body > button");
  assert(unmountButton);

  await unmountButton.click();
  div = await page.$("div > div");
  assert(!div);
  unmountButton = await page.$("body > button");
  assert(!unmountButton);

  await page.close();
});

Deno.test("[csr] style", sanitizeFalse, async (t) => {
  await t.step("text style", async () => {
    const testUrl = addTestPage(`
      function App() {
        return <div style="font-weight:bold">Hello, world!</div>;
      }
      document.body.mount(<App />);
    `);
    const page = await browser.newPage();
    await page.goto(testUrl);

    const div = await page.$("body > div");
    assert(div);
    assertEquals(await div.evaluate((el) => el.style.fontWeight), "bold");

    const styles = await page.$$("style[id^='css-']");
    assertEquals(styles.length, 0);

    await page.close();
  });

  await t.step("inline style", async () => {
    const testUrl = addTestPage(`
      function App() {
        return <div style={{fontWeight: "bold"}}>Hello, world!</div>;
      }
      document.body.mount(<App />);
    `);
    const page = await browser.newPage();
    await page.goto(testUrl);

    const div = await page.$("body > div");
    assert(div);
    assertEquals(await div.evaluate((el) => el.style.fontWeight), "bold");

    const styles = await page.$$("style[id^='css-']");
    assertEquals(styles.length, 0);

    await page.close();
  });

  await t.step("using class name", async () => {
    const testUrl = addTestPage(`
      function App() {
        return <div style={{ color: "black", ":hover": { color: "blue" }, "@media (max-width: 600px)": { color: "red" } }}>Hello, world!</div>;
      }
      document.body.mount(<App />);
    `);
    const page = await browser.newPage();
    await page.goto(testUrl);

    const div = await page.$("body > div");
    assert(div);
    assertEquals(await div.evaluate((el) => [...el.classList.values().filter(v => v.startsWith("css-"))].length), 1);
    assertEquals(await div.evaluate((el) => el.style.color), "");

    const styles = await page.$$("style[id^='css-']");
    assertEquals(styles.length, 1);
    assertStringIncludes(await styles[0].evaluate((el) => el.textContent), "{color:black;}");
    assertStringIncludes(await styles[0].evaluate((el) => el.textContent), ":hover{color:blue;}");
    assertStringIncludes(await styles[0].evaluate((el) => el.textContent), "@media (max-width: 600px){");
    assertStringIncludes(await styles[0].evaluate((el) => el.textContent), "{color:red;}");

    await page.close();
  });

  await t.step("computed style", async () => {
    const testUrl = addTestPage(`
      function App(this: FC<{ fontWeight: string }>) {
        this.fontWeight = "normal";
        return <div class={["foo", this.fontWeight]} style={this.$(()=>({ fontWeight: this.fontWeight }))} onClick={() => this.fontWeight = "bold"}>Hello, world!</div>;
      }
      document.body.mount(<App />);
    `);
    const page = await browser.newPage();
    await page.goto(testUrl);

    const div = await page.$("body > div");
    assert(div);
    assertEquals(await div.evaluate((el) => el.computedStyleMap().get("font-weight")?.toString()), "400");
    assertEquals(await div.evaluate((el) => el.classList.toString()), "foo normal");
    assertEquals(await div.evaluate((el) => el.style.fontWeight), "normal");

    await div.click();
    assertEquals(await div.evaluate((el) => el.computedStyleMap().get("font-weight")?.toString()), "700");
    assertEquals(await div.evaluate((el) => el.classList.toString()), "foo bold");
    assertEquals(await div.evaluate((el) => el.style.fontWeight), "bold");

    await page.close();
  });

  await t.step("auto-computed style", async () => {
    const testUrl = addTestPage(`
      function App(this: FC<{ fontWeight: string }>) {
        this.fontWeight = "normal";
        return <div class={["foo", this.fontWeight]} style={ { fontWeight: this.fontWeight }} onClick={() => this.fontWeight = "bold"}>Hello, world!</div>;
      }
      document.body.mount(<App />);
    `);
    const page = await browser.newPage();
    await page.goto(testUrl);

    const div = await page.$("body > div");
    assert(div);
    assertEquals(await div.evaluate((el) => el.computedStyleMap().get("font-weight")?.toString()), "400");
    assertEquals(await div.evaluate((el) => el.classList.toString()), "foo normal");
    assertEquals(await div.evaluate((el) => el.style.fontWeight), "normal");

    await div.click();
    assertEquals(await div.evaluate((el) => el.computedStyleMap().get("font-weight")?.toString()), "700");
    assertEquals(await div.evaluate((el) => el.classList.toString()), "foo bold");
    assertEquals(await div.evaluate((el) => el.style.fontWeight), "bold");

    await page.close();
  });
});

Deno.test("[csr] signals", sanitizeFalse, async (t) => {
  await t.step("signals reactive", async () => {
    const testUrl = addTestPage(`
      function App(this: FC<{ count: number }>) {
        this.count = 1;
        return <div>
          <button onClick={() => this.count++}>{this.count}</button>
        </div>;
      }
      document.body.mount(<App />);
    `);
    const page = await browser.newPage();
    await page.goto(testUrl);

    const button = await page.$("body > div > button");
    assert(button);
    assertEquals(await button.evaluate((el) => el.textContent), "1");
    await button.click();
    assertEquals(await button.evaluate((el) => el.textContent), "2");
    await button.click();

    await page.close();
  });

  await t.step("compiuted signals", async () => {
    const testUrl = addTestPage(`
      function App(this: FC<{ count: number }>) {
        this.count = 1;
        return <div>
          <button onClick={() => this.count++}>{this.computed(() => 2*this.count)}</button>
        </div>;
      }
      document.body.mount(<App />);
    `);
    const page = await browser.newPage();
    await page.goto(testUrl);

    const button = await page.$("body > div > button");
    assert(button);
    assertEquals(await button.evaluate((el) => el.textContent), "2");
    await button.click();
    assertEquals(await button.evaluate((el) => el.textContent), "4");
    await button.click();

    await page.close();
  });

  await t.step("signals as props", async () => {
    const testUrl = addTestPage(`
      function Display({ count }: { count: number }) {
        return <span>{count}</span>;
      }
      function App(this: FC<{ count: number }>) {
        this.count = 1;
        return <div>
          <Display count={this.count} />
          <button onClick={() => this.count++}>Click me</button>
        </div>;
      }
      document.body.mount(<App />);
    `);
    const page = await browser.newPage();
    await page.goto(testUrl);

    const button = await page.$("body > div > button");
    assert(button);

    const span = await page.$("body > div > span");
    assert(span);
    assertEquals(await span.evaluate((el) => el.textContent), "1");

    await button.click();
    assertEquals(await span.evaluate((el) => el.textContent), "2");

    await page.close();
  });

  await t.step("reactive attributes", async () => {
    const testUrl = addTestPage(`
      function App(this: FC<{ title: string }>) {
        this.title = "Hello, world!";
        return <div title={this.title} onClick={() => this.title = "Hello, mono-jsx!"}>{this.title}</div>;
      }
      document.body.mount(<App />);
    `);
    const page = await browser.newPage();
    await page.goto(testUrl);

    const div = await page.$("body > div");
    assert(div);
    assertEquals(await div.evaluate((el) => el.title), "Hello, world!");

    await div.click();
    assertEquals(await div.evaluate((el) => el.title), "Hello, mono-jsx!");

    await page.close();
  });

  await t.step("async signals", async () => {
    const testUrl = addTestPage(`
      async function App(this: FC<{ count: number }>) {
        this.count = await Promise.resolve(1);
        return <div>
          <button onClick={() => this.count++}>{this.count}</button>
        </div>;
      }
      document.body.mount(<App />);
    `);
    const page = await browser.newPage();
    await page.goto(testUrl);

    const button = await page.$("body > div > button");
    assert(button);
    assertEquals(await button.evaluate((el) => el.textContent), "1");
    await button.click();
    assertEquals(await button.evaluate((el) => el.textContent), "2");
    await button.click();

    await page.close();
  });

  await t.step("async signals as props", async () => {
    const testUrl = addTestPage(`
      function App(this: FC<{ input: string }>) {
        this.input = ''
        return <>
          <p>{this.input}</p>
          <input $value={this.input} />
          <button onClick={() => this.input = ''}>Reset</button>
        </>;
      }
      document.body.mount(<App />);
    `);
    const page = await browser.newPage();
    await page.goto(testUrl);

    const p = await page.$("body > p");
    assert(p);
    assertEquals(await p.evaluate((el) => el.textContent), "");

    const input = await page.$("body > input");
    assert(input);
    assertEquals(await input.evaluate((el) => el.value), "");

    const button = await page.$("body > button");
    assert(button);

    await input.type("Hello, world!", {});
    assertEquals(await p.evaluate((el) => el.textContent), "Hello, world!");

    await button.click();
    assertEquals(await p.evaluate((el) => el.textContent), "");
    assertEquals(await input.evaluate((el) => el.value), "");

    await page.close();
  });

  await t.step("getter", async () => {
    const testUrl = addTestPage(`
      function App(this: FC) {
        const count = this.extend({
          value: 1,
          get double() {
            return this.value * 2;
          },
          increment() {
            this.value++;
          }
        });
        return <button onClick={() => count.increment()}>{count.value}-{count.double}</button>
      }
      document.body.mount(<App />);
    `);
    const page = await browser.newPage();
    await page.goto(testUrl);

    const button = await page.$("body > button");
    assert(button);
    assertEquals(await button.evaluate((el) => el.textContent), "1-2");
    await button.click();
    assertEquals(await button.evaluate((el) => el.textContent), "2-4");

    await page.close();
  });

  await t.step("store", async () => {
    const testUrl = addTestPage(`
      import { store } from "mono-jsx/dom";
      const count = store({
        value: 1,
        get double() {
          return this.value * 2;
        },
        increment() {
          this.value++;
        }
      });
      function H1(this: FC) {
        return <h1>{count.value}-{count.double}</h1>
      }
      function H2(this: FC) {
        return <h2>{count.value}-{count.double}</h2>
      }
      function Button(this: FC) {
        return <button onClick={() => count.increment()}>Increment</button>
      }
      document.body.mount(<><H1 /><H2 /><Button /></>);
    `);
    const page = await browser.newPage();
    await page.goto(testUrl);

    const h1 = await page.$("body > h1");
    assert(h1);
    assertEquals(await h1.evaluate((el) => el.textContent), "1-2");

    const h2 = await page.$("body > h2");
    assert(h2);
    assertEquals(await h2.evaluate((el) => el.textContent), "1-2");

    const button = await page.$("body > button");
    assert(button);

    await button.click();
    assertEquals(await h1.evaluate((el) => el.textContent), "2-4");
    assertEquals(await h2.evaluate((el) => el.textContent), "2-4");

    await page.close();
  });

  await t.step("atom", async () => {
    const testUrl = addTestPage(`
      import { atom } from "mono-jsx/dom";
      const count = atom(1);
      function H1(this: FC) {
        return <h1>{count}</h1>
      }
      function H2(this: FC) {
        return <h2>{this.$(() => 2*count.get())}</h2>
      }
      function Button(this: FC) {
        return <button onClick={() => count.set(prev => prev+1)}>Increment</button>
      }
      document.body.mount(<><H1 /><H2 /><Button /></>);
    `);
    const page = await browser.newPage();
    await page.goto(testUrl);

    const h1 = await page.$("body > h1");
    assert(h1);
    assertEquals(await h1.evaluate((el) => el.textContent), "1");

    const h2 = await page.$("body > h2");
    assert(h2);
    assertEquals(await h2.evaluate((el) => el.textContent), "2");

    const button = await page.$("body > button");
    assert(button);

    await button.click();
    assertEquals(await h1.evaluate((el) => el.textContent), "2");
    assertEquals(await h2.evaluate((el) => el.textContent), "4");

    await page.close();
  });

  await t.step("atom value is null/undefined/boolean", async () => {
    const testUrl = addTestPage(`
      import { atom } from "mono-jsx/dom";
      const v = atom<string|null|undefined|boolean>(null);
      function App(this: FC) {
        let i = 0;
        return <h1 onClick={() => {
          switch (i++) {
            case 0:
              v.set("Hello, world!");
              break;
            case 1:
              v.set(true);
              break;
            case 2:
              v.set(false);
              break;
            case 3:
              v.set(undefined);
              break;
            case 4:
              v.set(null);
              break;
            default:
              v.set("Hello, world!");
              break;
          }
        }}>{v}</h1>
      }
      document.body.mount(<App />);
    `);
    const page = await browser.newPage();
    await page.goto(testUrl);

    const h1 = await page.$("body > h1");
    assert(h1);
    assertEquals(await h1.evaluate((el) => el.textContent), ""); // null

    await h1.evaluate((el) => el.click());
    assertEquals(await h1.evaluate((el) => el.textContent), "Hello, world!");

    await h1.evaluate((el) => el.click());
    assertEquals(await h1.evaluate((el) => el.textContent), ""); // undefined

    await h1.evaluate((el) => el.click());
    assertEquals(await h1.evaluate((el) => el.textContent), ""); // true

    await h1.evaluate((el) => el.click());
    assertEquals(await h1.evaluate((el) => el.textContent), ""); // false

    await h1.evaluate((el) => el.click());
    assertEquals(await h1.evaluate((el) => el.textContent), ""); // null

    await h1.evaluate((el) => el.click());
    assertEquals(await h1.evaluate((el) => el.textContent), "Hello, world!");

    await page.close();
  });

  await t.step("atom(JSX.Element)", async () => {
    const testUrl = addTestPage(`
      import { atom } from "mono-jsx/dom";
      const v = atom<JSX.Element>(<span>Hello, world!</span>);
      function App(this: FC) {
        return <h1 onClick={() => v.set(<strong>Hello, mono-jsx!</strong>)}>{v}</h1>
      }
      document.body.mount(<App />);
    `);
    const page = await browser.newPage();
    await page.goto(testUrl);

    const h1 = await page.$("body > h1");
    assert(h1);
    assertEquals(await h1.evaluate((el) => el.innerHTML), "<span>Hello, world!</span>");

    await h1.evaluate((el) => el.click());
    assertEquals(await h1.evaluate((el) => el.innerHTML), "<strong>Hello, mono-jsx!</strong>");

    await page.close();
  });

  await t.step("atom(array)", async () => {
    const testUrl = addTestPage(`
      import { atom } from "mono-jsx/dom";
      const list = atom([1, 2, 3]);
      function App(this: FC) {
        return <div><ul>{list.map((item) => <li>{item}</li>)}</ul><button onClick={() => list.set(prev => [...prev, prev.length+1])}>Add</button></div>
      }
      document.body.mount(<App />);
    `);
    const page = await browser.newPage();
    await page.goto(testUrl);

    const ul = await page.$("body > div > ul");
    assert(ul);
    assertEquals(await ul.evaluate((el) => Array.from(el.children).map(node => node.textContent)), ["1", "2", "3"]);

    const button = await page.$("body > div > button");
    assert(button);
    await button.click();

    assertEquals(await ul.evaluate((el) => Array.from(el.children).map(node => node.textContent)), ["1", "2", "3", "4"]);

    await button.click();
    assertEquals(await ul.evaluate((el) => Array.from(el.children).map(node => node.textContent)), ["1", "2", "3", "4", "5"]);

    await page.close();
  });

  await t.step("atom ref", async () => {
    const testUrl = addTestPage(`
      import { atom } from "mono-jsx/dom";
      const number = atom(0);
      function App(this: FC) {
        return <>
          <span>{number.ref()}</span>
          <button disabled={number.ref(n => n > 0)} onClick={() => number.set(prev => prev + 1)}>Click me</button>
        </>
      }
      document.body.mount(<App />);
    `);
    const page = await browser.newPage();
    await page.goto(testUrl);

    const span = await page.$("body > span");
    assert(span);
    assertEquals(await span.evaluate((el) => el.textContent), "0");

    const button = await page.$("body > button");
    assert(button);
    assertEquals(await button.evaluate((el) => el.disabled), false);
    await button.click();

    assertEquals(await span.evaluate((el) => el.textContent), "1");
    assertEquals(await button.evaluate((el) => el.disabled), true);

    await page.close();
  });
});

Deno.test("[csr] ref", sanitizeFalse, async () => {
  const testUrl = addTestPage(`
      function App(this: FC<{}, { h1?: HTMLHeadingElement }>) {
        this.effect(() => {
          this.refs.h1!.textContent = "Hello, world!";
        });
        return <h1 ref={this.refs.h1} />
      }
      document.body.mount(<App />);
    `);
  const page = await browser.newPage();
  await page.goto(testUrl);

  const h1 = await page.$("body > h1");
  assert(h1);
  assertEquals(await h1.evaluate((el) => el.textContent), "Hello, world!");

  await page.close();
});

Deno.test("[csr] `<show>` element", sanitizeFalse, async () => {
  const testUrl = addTestPage(`
    function App(this: FC<{ show: boolean }>) {
      this.show = true;
      return <div>
        <show when={this.show}>
          <h1>Welcome to mono-jsx!</h1>
        </show>
        <button onClick={() => this.show = !this.show}>{this.$(() => this.show ? "Show" : "Hide")}</button>
      </div>;
    }
    document.body.mount(<App />);
  `);
  const page = await browser.newPage();
  await page.goto(testUrl);

  let h1 = await page.$("body > div > h1");
  assert(h1);
  assertEquals(await h1.evaluate((el) => el.textContent), "Welcome to mono-jsx!");

  let button = await page.$("body > div > button");
  assert(button);

  await button.click();
  h1 = await page.$("body > div > h1");
  assert(!h1);

  await button.click();
  h1 = await page.$("body > div > h1");
  assert(h1);
  assertEquals(await h1.evaluate((el) => el.textContent), "Welcome to mono-jsx!");

  await page.close();
});

Deno.test("[csr] `<show>` element in fragment", sanitizeFalse, async () => {
  const testUrl = addTestPage(`
    export default async function App(this: FC<{ show: boolean }>) {
      this.show = false;

      return (
        <>
          <button onClick={() => this.show = !this.show}>{this.$(() => this.show ? "Hide" : "Show")}</button>
          <show when={this.show}>
            <p>Hello, world!</p>
          </show>
        </>
      )
    }
    document.body.mount(<App />);
  `);
  const page = await browser.newPage();
  await page.goto(testUrl);

  let p = await page.$("body > p");
  assert(!p);

  let button = await page.$("body > button");
  assert(button);
  assertEquals(await button.evaluate((el) => el.textContent), "Show");
  await button.click();

  p = await page.$("body > p");
  assert(p);
  assertEquals(await button.evaluate((el) => el.textContent), "Hide");
  assertEquals(await p.evaluate((el) => el.textContent), "Hello, world!");

  await button.click();
  p = await page.$("body > p");
  assert(!p);
  assertEquals(await button.evaluate((el) => el.textContent), "Show");

  await page.close();
});

Deno.test("[csr] `<hidden>` element", sanitizeFalse, async () => {
  const testUrl = addTestPage(`
    function App(this: FC<{ hidden: boolean }>) {
      this.hidden = false;
      return <div>
        <hidden when={this.hidden}>
          <h1>Welcome to mono-jsx!</h1>
        </hidden>
        <button onClick={() => this.hidden = !this.hidden}>{this.$(() => this.hidden ? "Show" : "Hide")}</button>
      </div>;
    }
    document.body.mount(<App />);
  `);
  const page = await browser.newPage();
  await page.goto(testUrl);

  let h1 = await page.$("body > div > h1");
  assert(h1);
  assertEquals(await h1.evaluate((el) => el.textContent), "Welcome to mono-jsx!");

  let button = await page.$("body > div > button");
  assert(button);

  await button.click();
  h1 = await page.$("body > div > h1");
  assert(!h1);

  await button.click();
  h1 = await page.$("body > div > h1");
  assert(h1);
  assertEquals(await h1.evaluate((el) => el.textContent), "Welcome to mono-jsx!");

  await page.close();
});

Deno.test("[csr] `<toggle>` element", sanitizeFalse, async () => {
  const testUrl = addTestPage(`
    function App(this: FC<{ lang: 'en' | 'zh' | 'emoji' }>) {
      this.lang = 'en';
      return <div>
        <switch value={this.lang}>
          <h1 slot="en">Welcome to mono-jsx!</h1>
          <h1 slot="zh">你好，世界！</h1>
          <h1 slot="emoji">✋🌎❗️</h1>
        </switch>
        <button id="btn1" onClick={() => this.lang = 'en'}>English</button>
        <button id="btn2" onClick={() => this.lang = 'zh'}>中文</button>
        <button id="btn3" onClick={() => this.lang = 'emoji'}>🙂</button>
        <button id="btn4" onClick={() => this.lang = '??'}>??</button>

      </div>;
    }
    document.body.mount(<App />);
  `);
  const page = await browser.newPage();
  await page.goto(testUrl);

  const btn1 = await page.$("#btn1");
  assert(btn1);
  await btn1.click();
  let h1 = await page.$("body > div > h1");
  assert(h1);
  assertEquals(await h1.evaluate((el) => el.textContent), "Welcome to mono-jsx!");

  const btn2 = await page.$("#btn2");
  assert(btn2);
  await btn2.click();
  h1 = await page.$("body > div > h1");
  assert(h1);
  assertEquals(await h1.evaluate((el) => el.textContent), "你好，世界！");

  const btn3 = await page.$("#btn3");
  assert(btn3);
  await btn3.click();
  h1 = await page.$("body > div > h1");
  assert(h1);
  assertEquals(await h1.evaluate((el) => el.textContent), "✋🌎❗️");

  const btn4 = await page.$("#btn4");
  assert(btn4);
  await btn4.click();
  h1 = await page.$("body > div > h1");
  assert(!h1);

  await page.close();
});

Deno.test("[csr] list rendering", sanitizeFalse, async (t) => {
  await t.step("basic", async () => {
    const testUrl = addTestPage(`
      function Todos(props: { todos: string[] }) {
        return <ul>
          {props.todos.map((todo) => <li>{todo}</li>)}
        </ul>
      }
      document.body.mount(<Todos todos={["Buy groceries", "Walk the dog", "Do laundry"]} />);
    `);
    const page = await browser.newPage();
    await page.goto(testUrl);

    const ul = await page.$("body > ul");
    assert(ul);

    assertEquals(await ul.evaluate(el => el.childNodes.length), 3);
    assertEquals(await ul.evaluate(el => Array.from(el.childNodes).map(node => node.textContent)), [
      "Buy groceries",
      "Walk the dog",
      "Do laundry",
    ]);

    await page.close();
  });

  await t.step("reactive list", async () => {
    const testUrl = addTestPage(`
      function Todos(this: FC<{ todos: string[] }>) {
        const todos = this.extend({
          items: ["Buy groceries", "Walk the dog", "Do laundry"],
          add(content: string) {
            this.items = [...this.items, content]
          },
          delete(todo: string) {
            this.items = this.items.filter(t => t !== todo)
          }
        });
        return <>
          <ul>
            {todos.items.map((todo, index) => <li>
              <span>{index + 1}: {todo}</span>
              <button onClick={() => todos.delete(todo)}>Delete</button>
            </li>)}
          </ul>
          <button onClick={() => todos.add("Call Mom")}>Add todo</button>
        </>
      }
      document.body.mount(<Todos />);
    `);
    const page = await browser.newPage();
    await page.goto(testUrl);

    const ul = await page.$("body > ul");
    assert(ul);

    assertEquals(await ul.evaluate(el => el.children.length), 3);
    assertEquals(await ul.evaluate(el => Array.from(el.children).map(node => node.children[0].textContent)), [
      "1: Buy groceries",
      "2: Walk the dog",
      "3: Do laundry",
    ]);

    const button = await page.$("body > button");
    assert(button);

    await button.click();
    assertEquals(await ul.evaluate(el => el.children.length), 4);
    assertEquals(await ul.evaluate(el => Array.from(el.children).map(node => node.children[0].textContent)), [
      "1: Buy groceries",
      "2: Walk the dog",
      "3: Do laundry",
      "4: Call Mom",
    ]);

    await button.click();
    assertEquals(await ul.evaluate(el => el.children.length), 5);
    assertEquals(await ul.evaluate(el => Array.from(el.children).map(node => node.children[0].textContent)), [
      "1: Buy groceries",
      "2: Walk the dog",
      "3: Do laundry",
      "4: Call Mom",
      "5: Call Mom",
    ]);

    const button0 = await page.$("body > ul > li:nth-child(1) > button");
    assert(button0);
    await button0.click();
    assertEquals(await ul.evaluate(el => el.children.length), 4);
    assertEquals(await ul.evaluate(el => Array.from(el.children).map(node => node.children[0].textContent)), [
      "1: Walk the dog",
      "2: Do laundry",
      "3: Call Mom",
      "4: Call Mom",
    ]);

    const button2 = await page.$("body > ul > li:nth-child(2) > button");
    assert(button2);
    await button2.click();
    assertEquals(await ul.evaluate(el => el.children.length), 3);
    assertEquals(await ul.evaluate(el => Array.from(el.children).map(node => node.children[0].textContent)), [
      "1: Walk the dog",
      "2: Call Mom",
      "3: Call Mom",
    ]);

    const button3 = await page.$("body > ul > li:nth-child(3) > button");
    assert(button3);
    await button3.click();
    assertEquals(await ul.evaluate(el => el.children.length), 1);
    assertEquals(await ul.evaluate(el => Array.from(el.children).map(node => node.children[0].textContent)), [
      "1: Walk the dog",
    ]);
    await page.close();
  });
});

Deno.test("[csr] async component", sanitizeFalse, async () => {
  const testUrl = addTestPage(`
    const Blah = () => Promise.resolve(<h2>Building User Interfaces.</h2>);
    const Sleep = async ({ ms }: { ms: number }) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      return <slot />;
    };
    function App() {
      return <div>
        <Sleep ms={100} pending={<p>Waiting...</p>}>
          <h1>Welcome to mono-jsx!</h1>
          <Blah />
        </Sleep>
      </div>
    }
    document.body.mount(<App />);
  `);

  const page = await browser.newPage();
  await page.goto(testUrl);

  const div = await page.$("body > div");
  assert(div);
  assertEquals(await div.evaluate((el: HTMLElement) => el.childElementCount), 1);

  let p = await page.$("body > div > p");
  assert(p);
  assertEquals(await p.evaluate((el: HTMLElement) => el.textContent), "Waiting...");

  await new Promise((resolve) => setTimeout(resolve, 100));

  p = await page.$("body > div > p");
  assert(!p);

  assertEquals(await div.evaluate((el: HTMLElement) => el.childElementCount), 2);

  const h1 = await page.$("body > div > h1");
  assert(h1);
  assertEquals(await h1.evaluate((el: HTMLElement) => el.textContent), "Welcome to mono-jsx!");

  const h2 = await page.$("body > div > h2");
  assert(h2);
  assertEquals(await h2.evaluate((el: HTMLElement) => el.textContent), "Building User Interfaces.");

  await page.close();
});

Deno.test("[csr] XSS", sanitizeFalse, async (t) => {
  await t.step("static html", async () => {
    const testUrl = addTestPage(`
    function App() {
      return <div>
        {html\`<h1>Welcome to mono-jsx!</h1>\`}
      </div>
    }
    document.body.mount(<App />);
  `);
    const page = await browser.newPage();
    await page.goto(testUrl);

    const h1 = await page.$("body > div > h1");
    assert(h1);
    assertEquals(await h1.evaluate((el: HTMLElement) => el.textContent), "Welcome to mono-jsx!");

    await page.close();
  });

  await t.step("dynamic html", async () => {
    const testUrl = addTestPage(`
      function App(this: FC<{ html: string }>) {
        this.html = "";
        return <div>
          {html(this.html)}
          <button onClick={() => {
            if (this.html === "") {
              this.html = "<h1>Welcome to mono-jsx!</h1>";
            } else {
              this.html = "";
            }
          }}>Click me</button>
        </div>
      }
      document.body.mount(<App />);
    `);
    const page = await browser.newPage();
    await page.goto(testUrl);

    const button = await page.$("body > div > button");
    assert(button);

    let h1 = await page.$("body > div > h1");
    assert(!h1);

    await button.click();
    h1 = await page.$("body > div > h1");
    assert(h1);
    assertEquals(await h1.evaluate((el: HTMLElement) => el.textContent), "Welcome to mono-jsx!");

    await button.click();
    h1 = await page.$("body > div > h1");
    assert(!h1);

    await button.click();
    h1 = await page.$("body > div > h1");
    assert(h1);
    assertEquals(await h1.evaluate((el: HTMLElement) => el.textContent), "Welcome to mono-jsx!");

    await page.close();
  });
});
