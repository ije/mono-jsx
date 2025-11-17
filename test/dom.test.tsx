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
  //   async function App() {
  //     await new Promise((resolve) => setTimeout(resolve, 1000));
  //     return <div>Hello, world!</div>;
  //   }
  //   <mount root={document.body}>
  //     <p>---</p>
  //     <App placeholder={<p>Loading...</p>} />
  //     <p>---</p>
  //   </mount>
  // `));
  // await new Promise(() => {});
});

Deno.test.afterAll(async () => {
  ac.abort(); // close the server
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

  await t.step("reactive attributes", async () => {
    const testUrl = addTestPage(`
      function App(this: FC<{ title: string }>) {
        this.title = "Hello, world!";
        return <div title={this.title} onClick={() => this.title = "Hello, mono-jsx!"}>{this.title}</div>;
      }
      <mount root={document.body}>
        <App />
      </mount>
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
        this.init({ count: await Promise.resolve(1) });
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

  await t.step("async signals as props", async () => {
    const testUrl = addTestPage(`
      function App(this: FC<{ input: string }>) {
        this.init({ input: '' });
        return <>
          <p>{this.input}</p>
          <input $value={this.input} />
          <button onClick={() => this.input = ''}>Reset</button>
        </>;
      }
      <mount root={document.body}>
        <App />
      </mount>
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
});

Deno.test("[dom] ref", sanitizeFalse, async () => {
  const testUrl = addTestPage(`
      function App(this: FC<{}, { h1?: HTMLHeadingElement }>) {
        this.effect(() => {
          this.refs.h1!.textContent = "Hello, world!";
        });
        return <h1 ref={this.refs.h1} />
      }
      <mount root={document.body}>
        <App />
      </mount>
    `);
  const page = await browser.newPage();
  await page.goto(testUrl);

  const h1 = await page.$("body > h1");
  assert(h1);
  assertEquals(await h1.evaluate((el) => el.textContent), "Hello, world!");

  await page.close();
});

Deno.test("[dom] `<if>` component", sanitizeFalse, async () => {
  const testUrl = addTestPage(`
    function App(this: FC<{ show: boolean }>) {
      this.init({ show: true });
      return <div>
        <if value={this.show}>
          <h1>Welcome to mono-jsx!</h1>
        </if>
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
  assertEquals(await h1.evaluate((el) => (el.nextSibling as HTMLElement).tagName), "BUTTON");

  let button = await page.$("body > div > button");
  assert(button);

  await button.click();
  h1 = await page.$("body > div > h1");
  assert(!h1);
  button = await page.$("body > div > button");
  assert(button);

  await button.click();
  h1 = await page.$("body > div > h1");
  assert(h1);
  assertEquals(await h1.evaluate((el) => el.textContent), "Welcome to mono-jsx!");
  assertEquals(await h1.evaluate((el) => (el.nextSibling as HTMLElement).tagName), "BUTTON");

  await page.close();
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

Deno.test("[dom] list rendering", sanitizeFalse, async (t) => {
  await t.step("basic", async () => {
    const testUrl = addTestPage(`
      function Todos(props: { todos: string[] }) {
        return <ul>
          {props.todos.map((todo) => <li>{todo}</li>)}
        </ul>
      }
      <mount root={document.body}>
        <Todos todos={["Buy groceries", "Walk the dog", "Do laundry"]} />
      </mount>
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
        this.init({ todos: [] });
        return <>
          <ul>
            {this.todos.map((todo) => <li>{todo}</li>)}
          </ul>
          <button onClick={() => this.todos = [...this.todos, "Todo #" + (this.todos.length + 1)]}>Add todo</button>
        </>
      }
      <mount root={document.body}>
        <Todos />
      </mount>
    `);
    const page = await browser.newPage();
    await page.goto(testUrl);

    const ul = await page.$("body > ul");
    assert(ul);

    assertEquals(await ul.evaluate(el => el.childNodes.length), 0);

    const button = await page.$("body > button");
    assert(button);

    for (let i = 0; i < 3; i++) {
      await button.click();
      assertEquals(await ul.evaluate(el => el.childNodes.length), i + 1);
      assertEquals(await ul.evaluate(el => Array.from(el.childNodes).map(node => node.textContent)), [
        ...Array.from({ length: i + 1 }).map((_, i) => `Todo #${i + 1}`),
      ]);
    }

    await page.close();
  });

  await t.step("delete item", async () => {
    const testUrl = addTestPage(`
      function Todos(this: FC<{ todos: string[] }>) {
        this.init({ todos: ["Buy groceries", "Walk the dog", "Do laundry"] });
        return <>
          <ul>
            {this.todos.map((todo, index) => <li>
              <span>{index + 1}: {todo}</span>
              <button onClick={() => this.todos = this.todos.filter(t => t !== todo)}>Delete</button>
            </li>)}
          </ul>
          <button onClick={() => this.todos = [...this.todos, "Call Sophie"]}>Add todo</button>
        </>
      }
      <mount root={document.body}>
        <Todos />
      </mount>
    `);
    const page = await browser.newPage();
    await page.goto(testUrl);

    const ul = await page.$("body > ul");
    assert(ul);

    assertEquals(await ul.evaluate(el => el.childNodes.length), 3);
    assertEquals(await ul.evaluate(el => Array.from(el.childNodes).map(node => node.childNodes[0].textContent)), [
      "1: Buy groceries",
      "2: Walk the dog",
      "3: Do laundry",
    ]);

    const button = await page.$("body > button");
    assert(button);

    await button.click();
    assertEquals(await ul.evaluate(el => el.childNodes.length), 4);
    assertEquals(await ul.evaluate(el => Array.from(el.childNodes).map(node => node.childNodes[0].textContent)), [
      "1: Buy groceries",
      "2: Walk the dog",
      "3: Do laundry",
      "4: Call Sophie",
    ]);

    await button.click();
    assertEquals(await ul.evaluate(el => el.childNodes.length), 5);
    assertEquals(await ul.evaluate(el => Array.from(el.childNodes).map(node => node.childNodes[0].textContent)), [
      "1: Buy groceries",
      "2: Walk the dog",
      "3: Do laundry",
      "4: Call Sophie",
      "5: Call Sophie",
    ]);

    const button0 = await page.$("body > ul > li:nth-child(1) > button");
    assert(button0);
    await button0.click();
    assertEquals(await ul.evaluate(el => el.childNodes.length), 4);
    assertEquals(await ul.evaluate(el => Array.from(el.childNodes).map(node => node.childNodes[0].textContent)), [
      "1: Walk the dog",
      "2: Do laundry",
      "3: Call Sophie",
      "4: Call Sophie",
    ]);

    const button2 = await page.$("body > ul > li:nth-child(2) > button");
    assert(button2);
    await button2.click();
    assertEquals(await ul.evaluate(el => el.childNodes.length), 3);
    assertEquals(await ul.evaluate(el => Array.from(el.childNodes).map(node => node.childNodes[0].textContent)), [
      "1: Walk the dog",
      "2: Call Sophie",
      "3: Call Sophie",
    ]);

    const button3 = await page.$("body > ul > li:nth-child(3) > button");
    assert(button3);
    await button3.click();
    assertEquals(await ul.evaluate(el => el.childNodes.length), 1);
    assertEquals(await ul.evaluate(el => Array.from(el.childNodes).map(node => node.childNodes[0].textContent)), [
      "1: Walk the dog",
    ]);
    await page.close();
  });
});

Deno.test("[dom] async component", sanitizeFalse, async () => {
  const testUrl = addTestPage(`
    const Blah = () => Promise.resolve(<h2>Building User Interfaces.</h2>);
    const Sleep = async ({ ms }: { ms: number }) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      return <slot />;
    };
    function App() {
      return <div>
        <Sleep ms={100} placeholder={<p>Waiting...</p>}>
          <h1>Welcome to mono-jsx!</h1>
          <Blah />
        </Sleep>
      </div>
    }
    <mount root={document.body}>
      <App />
    </mount>
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
