import { assert, assertEquals } from "jsr:@std/assert@1.0.14";
import puppeteer from "npm:puppeteer-core@23.1.1";
import chrome from "npm:puppeteer-chromium-resolver@23.0.0";
import { stop, transform } from "https://deno.land/x/esbuild@v0.25.11/mod.js";

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
              "mono-jsx/dom/jsx-runtime": "/mono-jsx/dom/jsx-runtime"
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

Deno.test.beforeAll(() => {
  Deno.serve({ port: 8688, onListen: () => {}, signal: ac.signal }, async (request) => {
    const url = new URL(request.url);
    if (url.pathname === "/mono-jsx/dom/jsx-runtime") {
      const f = await Deno.open("./dom/jsx-runtime.mjs");
      return new Response(f.readable, { headers: { "Content-Type": "application/javascript; charset=utf-8" } });
    }
    if (url.pathname.startsWith("/test_")) {
      const code = await testRoutes.get(url.pathname);
      return new Response(code, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    return new Response("Not Found", { status: 404 });
  });

  // console.log(addTestPage(`
  //   function App() {
  //     return <div>Hello, world!</div>;
  //   }
  //   <App mount={document.body} />;
  // `));
  // await new Promise(() => {});
});

Deno.test.afterAll(async () => {
  ac.abort();
  await browser.close();
  await stop();
});

Deno.test("[dom] mount", sanitizeFalse, async () => {
  const testUrl = addTestPage(`
    function App() {
      return <div>Hello, world!</div>;
    }

    const ac = new AbortController();

    <mount root={document.body} abortSignal={ac.signal}>
      <App />
      <button onClick={() => ac.abort()}>Unmount</button>
    </mount>
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

Deno.test("[dom] signals", sanitizeFalse, async (t) => {
  await t.step("signals reactive", async () => {
    const testUrl = addTestPage(`
      function App(this: FC<{ count: number }>) {
        this.init({ count: 1 });
        return <div>
          <button onClick={() => this.count++}>{this.count}</button>
        </div>;
      }
      <mount root={document.body}>
        <App />
      </mount>
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
        this.init({ count: 1 });
        return <div>
          <button onClick={() => this.count++}>{this.$(() => 2*this.count)}</button>
        </div>;
      }
      <mount root={document.body}>
        <App />
      </mount>
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
        this.init({ count: 1 });
        return <div>
          <Display count={this.count} />
          <button onClick={() => this.count++}>Click me</button>
        </div>;
      }
      <mount root={document.body}>
        <App />
      </mount>
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
});

Deno.test("[dom] `<toggle>` component", sanitizeFalse, async (t) => {
  await t.step("using `show` prop", async () => {
    const testUrl = addTestPage(`
      function App(this: FC<{ show: boolean }>) {
        this.init({ show: true });
        return <div>
          <toggle show={this.show}>
            <h1>Welcome to mono-jsx!</h1>
          </toggle>
          <button onClick={() => this.show = !this.show}>{this.$(() => this.show ? "Show" : "Hide")}</button>
        </div>;
      }
      <mount root={document.body}>
        <App />
      </mount>
    `);
    const page = await browser.newPage();
    await page.goto(testUrl);

    let h1 = await page.$("body > div > h1");
    assert(h1);
    assertEquals(await h1.evaluate((el) => el.textContent), "Welcome to mono-jsx!");

    const button = await page.$("body > div > button");
    assert(button);

    await button.click();
    h1 = await page.$("body > div > h1");
    assert(!h1);

    await button.click();
    h1 = await page.$("body > div > h1");
    assert(h1);
    assertEquals(await h1.evaluate((el) => el.textContent), "Welcome to mono-jsx!");
    assertEquals(await h1.evaluate((el) => (el.nextSibling as HTMLElement).tagName), "BUTTON");

    await page.close();
  });
  await t.step("using `hidden` prop", async () => {
    const testUrl = addTestPage(`
      function App(this: FC<{ hidden: boolean }>) {
        this.init({ hidden: true });
        return <div>
          <toggle hidden={this.hidden}>
            <h1>Welcome to mono-jsx!</h1>
          </toggle>
          <button onClick={() => this.hidden = !this.hidden}>{this.$(() => this.hidden ? "Hide" : "Show")}</button>
        </div>;
      }
      <mount root={document.body}>
        <App />
      </mount>
    `);
    const page = await browser.newPage();
    await page.goto(testUrl);

    let h1 = await page.$("body > div > h1");
    assert(!h1);

    const button = await page.$("body > div > button");
    assert(button);

    await button.click();
    h1 = await page.$("body > div > h1");
    assert(h1);
    assertEquals(await h1.evaluate((el) => el.textContent), "Welcome to mono-jsx!");
    assertEquals(await h1.evaluate((el) => (el.nextSibling as HTMLElement).tagName), "BUTTON");

    await button.click();
    h1 = await page.$("body > div > h1");
    assert(!h1);

    await page.close();
  });
});

Deno.test("[dom] `<toggle>` component", sanitizeFalse, async () => {
  const testUrl = addTestPage(`
    function App(this: FC<{ lang: 'en' | 'zh' | 'emoji' }>) {
      this.init({ lang: 'en' });
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
    <mount root={document.body}>
      <App />
    </mount>
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
