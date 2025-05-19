import { assert, assertEquals } from "jsr:@std/assert";
import puppeteer from "npm:puppeteer-core@23.1.1";
import chrome from "npm:puppeteer-chromium-resolver@23.0.0";

let routeIndex = 0;
let testRoutes: Map<string, JSX.Element> = new Map();

function addTestPage(page: JSX.Element, query?: string) {
  let pathname = `/test_${routeIndex++}`;
  testRoutes.set(pathname, page);
  return `http://localhost:8687${pathname}${query ? `?${query}` : ""}`;
}

Deno.serve({ port: 8687, onListen: () => {} }, (request) => {
  const url = new URL(request.url);
  if (url.pathname === "/favicon.ico") {
    return new Response(null, { status: 404 });
  }
  if (url.pathname === "/clicked") {
    return (
      <html>
        <h1>Clicked!</h1>
      </html>
    );
  }
  return (
    <html request={request} app={{ count: 0, themeColor: "" }} htmx={url.searchParams.get("htmx") ?? false}>
      <head>
        <title>Test</title>
      </head>
      <body>{testRoutes.get(url.pathname)}</body>
    </html>
  );
});

const browser = await puppeteer.launch({
  executablePath: (await chrome()).executablePath,
  args: ["--no-sandbox", "--disable-gpu", "--disable-extensions", "--disable-sync", "--disable-background-networking"],
});
const sanitizeFalse = { sanitizeResources: false, sanitizeOps: false };

Deno.test("[runtime] async component", sanitizeFalse, async () => {
  const Blah = () => Promise.resolve(<h2>Building User Interfaces.</h2>);
  const Sleep = async ({ ms }: { ms: number }) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
    return <slot />;
  };
  const testPageUrl = addTestPage(
    <div>
      <Sleep ms={100} placeholder={<p>Loading...</p>}>
        <h1>Welcome to mono-jsx!</h1>
        <Blah />
      </Sleep>
    </div>,
  );

  const page = await browser.newPage();
  await page.goto(testPageUrl);

  const div = await page.$("div");
  assert(div);
  assertEquals(await div.evaluate((el: HTMLElement) => el.childElementCount), 2);

  const p = await page.$("div > p");
  assert(!p);

  const h1 = await page.$("div > h1");
  assert(h1);
  assertEquals(await h1.evaluate((el: HTMLElement) => el.textContent), "Welcome to mono-jsx!");

  const h2 = await page.$("div > h2");
  assert(h2);
  assertEquals(await h2.evaluate((el: HTMLElement) => el.textContent), "Building User Interfaces.");

  await page.close();
});

Deno.test("[runtime] async generator component", sanitizeFalse, async () => {
  const words = ["Welcome", " ", "to", " ", "mono-jsx", "!"];

  async function* Words() {
    for (const word of words) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      yield <span>{word}</span>;
    }
  }

  const testPageUrl = addTestPage(
    <h1>
      <Words placeholder={<span>...</span>} />
    </h1>,
  );

  const page = await browser.newPage();
  await page.goto(testPageUrl);

  const h1 = await page.$("h1");
  assert(h1);
  assertEquals(await h1.evaluate((el: HTMLElement) => el.childElementCount), words.length);
  assertEquals(await h1.evaluate((el: HTMLElement) => el.textContent), "Welcome to mono-jsx!");
  assert(!(await page.$("m-portal")));

  await page.close();
});

Deno.test("[runtime] component state(text)", sanitizeFalse, async () => {
  function Hello(this: FC<{ text: string }>, props: { text: string }) {
    this.text = props.text;
    return (
      <div>
        <h1>{this.text}</h1>
        <button type="button" onClick={() => this.text = "Clicked!"}>
          Click me
        </button>
      </div>
    );
  }

  const testPageUrl = addTestPage(<Hello text="Hello, world!" />);
  const page = await browser.newPage();
  await page.goto(testPageUrl);

  const h1 = await page.$("div h1");
  assert(h1);
  assertEquals(await h1.evaluate((el: HTMLElement) => el.textContent), "Hello, world!");

  const button = await page.$("div button");
  assert(button);
  await button.click();

  assertEquals(await h1.evaluate((el: HTMLElement) => el.textContent), "Clicked!");

  await page.close();
});

Deno.test("[runtime] component state(number)", sanitizeFalse, async () => {
  function Counter(this: FC<{ count: number }>, props: { initialValue: number }) {
    this.count = props.initialValue;
    return (
      <div>
        <button type="button" onClick={() => this.count--} />
        <span>{this.count}</span>
        <button type="button" onClick={() => this.count++} />
      </div>
    );
  }

  const testPageUrl = addTestPage(<Counter initialValue={0} />);
  const page = await browser.newPage();
  await page.goto(testPageUrl);

  const span = await page.$("div span");
  assert(span);
  assertEquals(await span.evaluate((el: HTMLElement) => el.textContent), "0");

  const buttons = await page.$$("div button");
  assertEquals(buttons.length, 2);

  // Click the increment button for 3 times
  for (let i = 0; i < 3; i++) {
    await buttons[1].click();
  }
  assertEquals(await span.evaluate((el: HTMLElement) => el.textContent), "3");

  // Click the decrement button for 5 times
  for (let i = 0; i < 5; i++) {
    await buttons[0].click();
  }
  assertEquals(await span.evaluate((el: HTMLElement) => el.textContent), "-2");

  await page.close();
});

Deno.test("[runtime] app state", sanitizeFalse, async () => {
  function Display(this: FC<{}, { count: number }>, props: { bold?: boolean }) {
    if (props.bold) {
      return <strong>{this.app.count}</strong>;
    }
    return <span>{this.app.count}</span>;
  }
  function Control(this: FC<{}, { count: number }>) {
    return (
      <>
        <button type="button" onClick={() => this.app.count--} />
        <button type="button" onClick={() => this.app.count++} />
      </>
    );
  }

  const testPageUrl = addTestPage(
    <div>
      <Display />
      <Display bold />
      <Control />
    </div>,
  );
  const page = await browser.newPage();
  await page.goto(testPageUrl);

  const span = await page.$("div span");
  const strong = await page.$("div strong");
  assert(span);
  assert(strong);
  assertEquals(await span.evaluate((el: HTMLElement) => el.textContent), "0");
  assertEquals(await strong.evaluate((el: HTMLElement) => el.textContent), "0");

  const buttons = await page.$$("div button");
  assertEquals(buttons.length, 2);

  // Click the increment button for 3 times
  for (let i = 0; i < 3; i++) {
    await buttons[1].click();
  }
  assertEquals(await span.evaluate((el: HTMLElement) => el.textContent), "3");
  assertEquals(await strong.evaluate((el: HTMLElement) => el.textContent), "3");

  // Click the decrement button for 5 times
  for (let i = 0; i < 5; i++) {
    await buttons[0].click();
  }
  assertEquals(await span.evaluate((el: HTMLElement) => el.textContent), "-2");
  assertEquals(await strong.evaluate((el: HTMLElement) => el.textContent), "-2");

  await page.close();
});

Deno.test("[runtime] computed state", sanitizeFalse, async () => {
  function FooBar(this: FC<{ count: number }, { count: number }>) {
    this.count = 0;
    return (
      <div>
        <h1>{this.computed(() => `1+2*${this.app.count}+3*${this.count}=` + (1 + 2 * this.app.count + 3 * this.count))}</h1>
        <button class="bnt1" type="button" onClick={() => this.app.count++} />
        <button class="bnt2" type="button" onClick={() => this.count++} />
      </div>
    );
  }

  const testPageUrl = addTestPage(<FooBar />);
  const page = await browser.newPage();
  await page.goto(testPageUrl);

  const h1 = await page.$("div h1");
  assert(h1);
  assertEquals(await h1.evaluate((el: HTMLElement) => el.innerText), "1+2*0+3*0=1");

  const bnt1 = await page.$("div button.bnt1");
  const bnt2 = await page.$("div button.bnt2");
  assert(bnt1);
  assert(bnt2);

  await bnt1.click();
  assertEquals(await h1.evaluate((el: HTMLElement) => el.textContent), "1+2*1+3*0=3");

  await bnt2.click();
  assertEquals(await h1.evaluate((el: HTMLElement) => el.textContent), "1+2*1+3*1=6");

  await bnt1.click();
  await bnt2.click();
  assertEquals(await h1.evaluate((el: HTMLElement) => el.textContent), "1+2*2+3*2=11");

  await page.close();
});

Deno.test("[runtime] computed class name", sanitizeFalse, async () => {
  function FooBar(this: FC<{ foo: string; bar: string }>) {
    this.foo = "foo";
    this.bar = "bar";
    return (
      <div>
        <h1 class={this.computed(() => [this.foo, this.bar])} />
        <button type="button" onClick={() => this.bar = "bar2000"} />
      </div>
    );
  }

  const testPageUrl = addTestPage(<FooBar />);
  const page = await browser.newPage();
  await page.goto(testPageUrl);

  const h1 = await page.$("div h1");
  assert(h1);
  assertEquals(await h1.evaluate((el: HTMLElement) => el.className), "foo bar");

  const button = await page.$("div button");
  assert(button);
  await button.click();

  assertEquals(await h1.evaluate((el: HTMLElement) => el.className), "foo bar2000");

  await page.close();
});

Deno.test("[runtime] effect", sanitizeFalse, async () => {
  function Effect(this: FC<{ count: number }, { themeColor: string }>) {
    this.count = 0;

    this.effect(() => {
      const console = document.querySelector("#web-console")!;
      console.textContent += "Welcome to mono-jsx!\n";
      return () => {
        console.textContent += "Bye mono-jsx!\n";
      };
    });

    this.effect(() => {
      const console = document.querySelector("#web-console")!;
      console.textContent += this.count + "," + this.app.themeColor + "\n";
    });

    return (
      <div>
        <h1>{this.count}</h1>
        <button class="add" type="button" onClick={() => this.count++}>Click Me</button>
      </div>
    );
  }

  function App(this: FC<{ show: boolean }, { themeColor: string }>) {
    this.show = true;
    return (
      <>
        <pre id="web-console"></pre>
        <toggle show={this.show}>
          <Effect />
        </toggle>
        <div>
          <button class="toggle" type="button" onClick={() => this.show = !this.show}>Toggle</button>
        </div>
        <hr />
        <div>
          <input value={this.app.themeColor} onInput={(e) => this.app.themeColor = e.target.value} />
        </div>
      </>
    );
  }

  const testPageUrl = addTestPage(<App />);
  const page = await browser.newPage();
  await page.goto(testPageUrl);

  const log = ["Welcome to mono-jsx!", "0,"];
  const console = await page.$("#web-console");
  assert(console);
  assertEquals(await console.evaluate((el: Element) => el.textContent), log.join("\n") + "\n");

  const add = await page.$("button.add");
  assert(add);
  await add.click();
  log.push("1,");
  assertEquals(await console.evaluate((el: Element) => el.textContent), log.join("\n") + "\n");

  const input = await page.$("input");
  assert(input);
  await input.type("blue", {});
  log.push("1,b");
  log.push("1,bl");
  log.push("1,blu");
  log.push("1,blue");
  assertEquals(await console.evaluate((el: Element) => el.textContent), log.join("\n") + "\n");
  await add.click();
  log.push("2,blue");
  assertEquals(await console.evaluate((el: Element) => el.textContent), log.join("\n") + "\n");

  const toggle = await page.$("button.toggle");
  assert(toggle);
  await toggle.click();
  log.push("Bye mono-jsx!");
  assertEquals(await console.evaluate((el: Element) => el.textContent), log.join("\n") + "\n");
  await toggle.click();
  log.push("Welcome to mono-jsx!", "2,blue");
  assertEquals(await console.evaluate((el: Element) => el.textContent), log.join("\n") + "\n");

  await page.close();
});

Deno.test("[runtime] <toggle> element", sanitizeFalse, async () => {
  function Toggle(this: FC<{ show: boolean }>) {
    this.show = false;
    return (
      <div>
        <toggle show={this.show}>
          <h1>Welcome to mono-jsx!</h1>
        </toggle>
        <button type="button" onClick={() => this.show = !this.show}>
          Show
        </button>
      </div>
    );
  }

  const testPageUrl = addTestPage(<Toggle />);
  const page = await browser.newPage();
  await page.goto(testPageUrl);

  const div = await page.$("div h1");
  assert(!div);

  const button = await page.$("div button");
  assert(button);
  await button.click();

  let h1 = await page.$("div h1");
  assert(h1);
  assertEquals(await h1.evaluate((el: HTMLElement) => el.textContent), "Welcome to mono-jsx!");

  await button.click();
  h1 = await page.$("div h1");
  assert(!h1);

  await page.close();
});

Deno.test("[runtime] <switch> element", sanitizeFalse, async () => {
  function Switch(this: FC<{ lang: string }>) {
    this.lang = "emoji";
    return (
      <div>
        <switch value={this.lang}>
          <h1 slot="en">Hello, world!</h1>
          <h1 slot="zh">你好，世界！</h1>
          <h1>✋🌎❗️</h1>
        </switch>
        <button type="button" onClick={() => this.lang = "en"}>
          English
        </button>
        <button type="button" onClick={() => this.lang = "zh"}>
          中
        </button>
        <button type="button" onClick={() => this.lang = "emoji"}>
          emoji
        </button>
      </div>
    );
  }

  const testPageUrl = addTestPage(<Switch />);
  const page = await browser.newPage();
  await page.goto(testPageUrl);

  assertEquals((await page.$$("div h1")).length, 1);

  let h1 = await page.$("div h1");
  assert(h1);
  assertEquals(await h1.evaluate((el: HTMLElement) => el.textContent), "✋🌎❗️");

  const buttons = await page.$$("div button");
  assertEquals(buttons.length, 3);

  await buttons[0].click();
  h1 = await page.$("div h1");
  assert(h1);
  assertEquals(await h1.evaluate((el: HTMLElement) => el.textContent), "Hello, world!");

  await buttons[1].click();
  h1 = await page.$("div h1");
  assert(h1);
  assertEquals(await h1.evaluate((el: HTMLElement) => el.textContent), "你好，世界！");

  await buttons[2].click();
  h1 = await page.$("div h1");
  assert(h1);
  assertEquals(await h1.evaluate((el: HTMLElement) => el.textContent), "✋🌎❗️");

  await page.close();
});

Deno.test("[runtime] 'action' function prop", sanitizeFalse, async () => {
  const testPageUrl = addTestPage(
    <>
      <p></p>
      <form
        action={(data) => {
          const p = document.querySelector("p")!;
          p.textContent = data.get("name")! as string;
        }}
      >
        <input type="hidden" name="name" value="Welcome to mono-jsx!" />
        <button type="submit">Submit</button>
      </form>
    </>,
  );

  const page = await browser.newPage();
  await page.goto(testPageUrl);

  const p = await page.$("p");
  assert(p);
  assertEquals(await p.evaluate((el: HTMLElement) => el.textContent), "");

  const button = await page.$("button");
  assert(button);
  await button.click();

  assertEquals(await p.evaluate((el: HTMLElement) => el.textContent), "Welcome to mono-jsx!");

  await page.close();
});

Deno.test("[runtime] refs", sanitizeFalse, async () => {
  function App(this: FC) {
    this.effect(() => {
      this.refs.h1!.textContent = "Welcome to mono-jsx!";
    });
    return <h1 ref={this.refs.h1} />;
  }
  const testPageUrl = addTestPage(
    <App />,
  );

  const page = await browser.newPage();
  await page.goto(testPageUrl);

  const h1 = await page.$("h1");
  assert(h1);
  assertEquals(await h1.evaluate((el: HTMLElement) => el.textContent), "Welcome to mono-jsx!");

  await page.close();
});

Deno.test("[runtime] ref callback", sanitizeFalse, async () => {
  const testPageUrl = addTestPage(
    <div
      ref={(el) => {
        el.innerHTML = "<h1>Welcome to mono-jsx!</h1>";
      }}
    />,
  );

  const page = await browser.newPage();
  await page.goto(testPageUrl);

  const div = await page.$("div");
  assert(div);
  assertEquals(await div.evaluate((el: HTMLElement) => el.innerHTML), "<h1>Welcome to mono-jsx!</h1>");

  await page.close();
});

Deno.test("[runtime] htmx", { ...sanitizeFalse, ignore: false }, async () => {
  const testPageUrl = addTestPage(
    <button type="button" hx-post="/clicked" hx-swap="outerHTML">
      Click Me
    </button>,
    "htmx=2.0.4",
  );

  const page = await browser.newPage();
  await page.goto(testPageUrl);
  await page.waitForNetworkIdle();

  let button = await page.$("button");
  assert(button);
  assertEquals(await button.evaluate((el: HTMLElement) => el.textContent), "Click Me");
  await button.click();
  await page.waitForNetworkIdle();

  button = await page.$("button");
  assert(!button);
  const h1 = await page.$("h1");
  assert(h1);
  assertEquals(await h1.evaluate((el: HTMLElement) => el.textContent), "Clicked!");

  await page.close();
});
