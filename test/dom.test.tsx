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
    <App mount={document.body} />;
  `);
  const page = await browser.newPage();
  await page.goto(testUrl);

  const div = await page.$("body > div");
  assert(div);
  assertEquals(await div.evaluate((el) => el.textContent), "Hello, world!");

  await page.close();
});

Deno.test("[dom] signals", sanitizeFalse, async () => {
  const testUrl = addTestPage(`
    function App(this: FC<{ count: number }>) {
      this.init({ count: 1 });
      return <div>
        <button onClick={() => this.count++}>{this.$(()=>2*this.count)}</button>
      </div>;
    }
    <App mount={document.body} />;
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

Deno.test("[dom] `<toggle>` component", sanitizeFalse, async () => {
  const testUrl = addTestPage(`
    function App(this: FC<{ show: boolean }>) {
      this.init({ show: true });
      return <div>
        <toggle show={this.show}>
          <h1>Welcome to mono-jsx!</h1>
        </toggle>
        <button onClick={() => this.show = !this.show}>{this.$(()=>this.show ? "Show" : "Hide")}</button>
      </div>;
    }
    <App mount={document.body} />;
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

  await page.close();
});
