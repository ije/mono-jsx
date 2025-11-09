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
  return /*html*/ `
    <script type="importmap">
      {
        "imports": {
          "mono-jsx/dom": "/mono-jsx/dom",
          "mono-jsx/dom/": "/mono-jsx/dom/"
        }
      }
    </script>
    <script type="module">
      ${js}
    </script>
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

  console.log(addTestPage(`
    function App(this: { count: number }) {
      this.init({ count: 1 });
      return <button onClick={() => this.count++}>{this.$(()=>2*this.count)}</button>;
    }
    <App mount={document.body} />;
  `));
  await new Promise(() => {});
});

Deno.test.afterAll(async () => {
  ac.abort();
  await browser.close();
  await stop();
});

Deno.test("dom", sanitizeFalse, async () => {
  const testUrl = addTestPage(`
    function App() {
      return <div>Hello, world!</div>;
    }
    <App mount={document.body} />;
  `);
  const page = await browser.newPage();
  await page.goto(testUrl);

  const div = await page.$("div");
  assert(div);
  assertEquals(await div.evaluate((el: HTMLElement) => el.textContent), "Hello, world!");

  await page.close();
});
