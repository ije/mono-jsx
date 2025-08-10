import { assert, assertEquals } from "jsr:@std/assert";
import puppeteer from "npm:puppeteer-core@23.1.1";
import chrome from "npm:puppeteer-chromium-resolver@23.0.0";

let routeSeq = 0;
let testRoutes: Map<string, JSX.Element> = new Map();
let count = 0;

function addTestPage(page: JSX.Element, query?: string) {
  let pathname = `/test_${routeSeq++}`;
  testRoutes.set(pathname, page);
  return `http://localhost:8687${pathname}${query ? `?${query}` : ""}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    <html
      request={request}
      app={{
        count: 0,
        themeColor: "",
      }}
      components={{
        greeting: async (props: { message: string }) => {
          await sleep(20);
          return <h1>{props.message}</h1>;
        },
        count: async () => {
          await sleep(20);
          return <span>{count++}</span>;
        },
        a: async (props: { name: string }) => {
          await sleep(20);
          return <strong>{props.name.toUpperCase()}</strong>;
        },
        b: async (props: { name: string }) => {
          await sleep(20);
          return <strong>{props.name.toUpperCase()}</strong>;
        },
        c: async (props: { name: string }) => {
          await sleep(20);
          return <strong>{props.name.toUpperCase()}</strong>;
        },
      }}
      routes={{
        "/": () => <h1>Home</h1>,
        "/about": () => <h1>About</h1>,
        "/post/:slug": function(this: FC) {
          return <h1>Post: {this.request.params!.slug}</h1>;
        },
      }}
      htmx={url.searchParams.get("htmx") ?? false}
    >
      <head>
        <title>Test</title>
      </head>
      <body>{testRoutes.get(url.pathname)}</body>
    </html>
  );
});

// function App(this: FC) {
//   return null;
// }
// console.log(addTestPage(<App />));
// await new Promise(() => {});

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

Deno.test("[runtime] signals(text)", sanitizeFalse, async () => {
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

Deno.test("[runtime] signals(number)", sanitizeFalse, async () => {
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

Deno.test("[runtime] signals(boolean)", sanitizeFalse, async () => {
  function App(this: FC<{ disable: boolean }>) {
    this.disable = false;
    return (
      <div>
        <input disabled={this.disable} />
        <button type="button" onClick={() => this.disable = !this.disable} />
      </div>
    );
  }

  const testPageUrl = addTestPage(<App />);
  const page = await browser.newPage();
  await page.goto(testPageUrl);

  const input = await page.$("div input");
  assert(input);
  assert(!(await input.evaluate((el: HTMLInputElement) => el.hasAttribute("disabled"))));

  const button = await page.$("div button");
  assert(button);
  await button.click();

  assert(await input.evaluate((el: HTMLInputElement) => el.hasAttribute("disabled")));

  await button.click();

  assert(!(await input.evaluate((el: HTMLInputElement) => el.hasAttribute("disabled"))));

  await page.close();
});

Deno.test("[runtime] app signals", sanitizeFalse, async () => {
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

Deno.test("[runtime] computed signals", sanitizeFalse, async () => {
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
  function App(this: FC<{ foo: string; bar: string }>) {
    this.foo = "foo";
    this.bar = "bar";
    return (
      <div>
        <h1 class={this.computed(() => [this.foo, this.bar])} />
        <button type="button" onClick={() => this.bar = "bar2000"} />
      </div>
    );
  }

  const testPageUrl = addTestPage(<App />);
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

Deno.test("[runtime] computed style", sanitizeFalse, async () => {
  function App(this: FC<{ color: string }>) {
    this.color = "blue";
    return (
      <div>
        <h1 style={{ color: this.color }} />
        <button type="button" onClick={() => this.color = "green"} />
      </div>
    );
  }

  const testPageUrl = addTestPage(<App />);
  const page = await browser.newPage();
  await page.goto(testPageUrl);

  const h1 = await page.$("div h1");
  assert(h1);
  assertEquals(await h1.evaluate((el: HTMLElement) => el.style.color), "blue");

  const button = await page.$("div button");
  assert(button);
  await button.click();

  assertEquals(await h1.evaluate((el: HTMLElement) => el.style.color), "green");

  await page.close();
});

Deno.test("[runtime] computed nesting style", sanitizeFalse, async () => {
  function App(this: FC<{ color: string }>) {
    this.color = "blue";
    return (
      <div>
        <hgroup style={{ "& h1": { color: this.color } }}>
          <h1>Welcome to mono-jsx!</h1>
        </hgroup>
        <button type="button" onClick={() => this.color = "green"} />
      </div>
    );
  }

  const testPageUrl = addTestPage(<App />);
  const page = await browser.newPage();
  await page.goto(testPageUrl);

  const h1 = await page.$("div h1");
  assert(h1);
  assertEquals(await h1.evaluate((el: HTMLElement) => el.computedStyleMap().get("color")?.toString()), "rgb(0, 0, 255)"); // blue in rgb

  const button = await page.$("div button");
  assert(button);
  await button.click();

  assertEquals(await h1.evaluate((el: HTMLElement) => el.computedStyleMap().get("color")?.toString()), "rgb(0, 128, 0)"); // green in rgb

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

    this.effect(() => {
      const console = document.querySelector("#web-console")!;
      const count = this.count;
      console.textContent += "count: " + count + "\n";
      return () => {
        console.textContent += "old count: " + count + "\n";
      };
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

  const log = ["Welcome to mono-jsx!", "0,", "count: 0"];
  const console = await page.$("#web-console");
  assert(console);
  assertEquals(await console.evaluate((el: Element) => el.textContent), log.join("\n") + "\n");

  const add = await page.$("button.add");
  assert(add);
  await add.click();
  log.push("1,");
  log.push("old count: 0");
  log.push("count: 1");
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
  log.push("old count: 1");
  log.push("count: 2");
  assertEquals(await console.evaluate((el: Element) => el.textContent), log.join("\n") + "\n");

  const toggle = await page.$("button.toggle");
  assert(toggle);
  await toggle.click();
  log.push("Bye mono-jsx!");
  log.push("old count: 2");
  assertEquals(await console.evaluate((el: Element) => el.textContent), log.join("\n") + "\n");
  await toggle.click();
  log.push("Welcome to mono-jsx!", "2,blue");
  log.push("count: 2");
  assertEquals(await console.evaluate((el: Element) => el.textContent), log.join("\n") + "\n");

  await page.close();
});

Deno.test("[runtime] $value", sanitizeFalse, async () => {
  function App(this: FC<{ value: string }>) {
    this.value = "";
    return (
      <>
        <h1>{this.value}</h1>
        <input $value={this.value} class="input1" />
        <input $value={this.value} class="input2" />
      </>
    );
  }

  const testPageUrl = addTestPage(<App />);
  const page = await browser.newPage();
  await page.goto(testPageUrl);

  const h1 = await page.$("h1");
  assert(h1);
  assertEquals(await h1.evaluate((el: HTMLElement) => el.textContent), "");

  const input1 = await page.$("input.input1");
  assert(input1);
  assertEquals(await input1.evaluate((el: HTMLInputElement) => el.value), "");

  const input2 = await page.$("input.input2");
  assert(input2);
  assertEquals(await input2.evaluate((el: HTMLInputElement) => el.value), "");

  await input1.type("Welcome to mono-jsx!", {});
  assertEquals(await h1.evaluate((el: HTMLElement) => el.textContent), "Welcome to mono-jsx!");
  assertEquals(await input2.evaluate((el: HTMLInputElement) => el.value), "Welcome to mono-jsx!");

  await input2.type(" ", {});
  assertEquals(await h1.evaluate((el: HTMLElement) => el.textContent), "Welcome to mono-jsx! ");
  assertEquals(await input1.evaluate((el: HTMLInputElement) => el.value), "Welcome to mono-jsx! ");

  await page.close();
});

Deno.test("[runtime] $checked", sanitizeFalse, async () => {
  function App(this: FC<{ checked: boolean }>) {
    this.checked = false;
    return (
      <>
        <h1>{this.$(() => this.checked ? "checked" : "unchecked")}</h1>
        <input type="checkbox" $checked={this.checked} class="input1" />
        <input type="checkbox" $checked={this.checked} class="input2" />
      </>
    );
  }

  const testPageUrl = addTestPage(<App />);
  const page = await browser.newPage();
  await page.goto(testPageUrl);

  const h1 = await page.$("h1");
  assert(h1);
  assertEquals(await h1.evaluate((el: HTMLElement) => el.textContent), "unchecked");

  const input1 = await page.$("input.input1");
  assert(input1);
  assertEquals(await input1.evaluate((el: HTMLInputElement) => el.checked), false);

  const input2 = await page.$("input.input2");
  assert(input2);
  assertEquals(await input2.evaluate((el: HTMLInputElement) => el.checked), false);

  await input1.click();
  assertEquals(await h1.evaluate((el: HTMLElement) => el.textContent), "checked");
  assertEquals(await input2.evaluate((el: HTMLInputElement) => el.checked), true);

  await input2.click();
  assertEquals(await h1.evaluate((el: HTMLElement) => el.textContent), "unchecked");
  assertEquals(await input1.evaluate((el: HTMLInputElement) => el.checked), false);

  await page.close();
});

Deno.test("[runtime] <toggle>", sanitizeFalse, async () => {
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

Deno.test("[runtime] <switch>", sanitizeFalse, async () => {
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

Deno.test("[runtime] <component>", sanitizeFalse, async () => {
  function App(this: FC<{ show: boolean }>) {
    this.show = false;
    return (
      <div>
        <toggle show={this.show}>
          <component name="greeting" props={{ message: "Hello, world" }} placeholder={<p>loading...</p>} />
        </toggle>
        <button type="button" onClick={() => this.show = !this.show}>Show</button>
      </div>
    );
  }

  const testPageUrl = addTestPage(<App />);
  const page = await browser.newPage();
  await page.goto(testPageUrl);

  const div = await page.$("h1");
  assert(!div);

  const button = await page.$("div button");
  assert(button);
  await button.click();

  await page.waitForNetworkIdle();
  const h1 = await page.$("h1");
  assert(h1);
  assertEquals(await h1.evaluate((el: HTMLElement) => el.textContent), "Hello, world");

  await page.close();
});

Deno.test("[runtime] <component> controled by <toggle>", sanitizeFalse, async () => {
  function App(this: FC<{ show: boolean }>) {
    this.show = false;
    return (
      <div>
        <toggle show={this.show}>
          <component name="greeting" props={{ message: "Hello, world" }} placeholder={<p>loading...</p>} />
        </toggle>
        <button type="button" onClick={() => this.show = !this.show}>Show</button>
      </div>
    );
  }

  const testPageUrl = addTestPage(<App />);
  const page = await browser.newPage();
  await page.goto(testPageUrl);

  let h1 = await page.$("h1");
  assert(!h1);

  const button = await page.$("div button");
  assert(button);
  await button.click();
  await page.waitForNetworkIdle();
  h1 = await page.$("h1");
  assert(h1);
  assertEquals(await h1.evaluate((el: HTMLElement) => el.textContent), "Hello, world");

  await button.click();
  h1 = await page.$("h1");
  assert(!h1);

  await page.close();
});

Deno.test("[runtime] <component> with signal name/props", sanitizeFalse, async () => {
  function App(this: FC<{ tab: "a" | "b" | "c" }>) {
    this.tab = "a";
    return (
      <div>
        <component name={this.tab} props={{ name: this.tab }} placeholder={<span>loading...</span>} />
        <select value={this.tab} onChange={(e) => this.tab = e.target.value as "c" | "b" | "a"}>
          <option value="a">A</option>
          <option value="b">B</option>
          <option value="c">C</option>
        </select>
      </div>
    );
  }

  const testPageUrl = addTestPage(<App />);
  const page = await browser.newPage();
  await page.goto(testPageUrl);

  await page.waitForNetworkIdle();
  let strong = await page.$("div strong");
  assert(strong);
  assertEquals(await strong.evaluate((el: HTMLElement) => el.textContent), "A");

  const select = await page.$("div select");
  assert(select);

  await select.select("b");
  await page.waitForNetworkIdle();
  strong = await page.$("div strong");
  assert(strong);
  assertEquals(await strong.evaluate((el: HTMLElement) => el.textContent), "B");

  await select.select("c");
  await page.waitForNetworkIdle();
  strong = await page.$("div strong");
  assert(strong);
  assertEquals(await strong.evaluate((el: HTMLElement) => el.textContent), "C");

  await select.select("a");
  await page.waitForNetworkIdle();
  strong = await page.$("div strong");
  assert(strong);
  assertEquals(await strong.evaluate((el: HTMLElement) => el.textContent), "A");

  await page.close();
});

Deno.test("[runtime] <component> ref", sanitizeFalse, async () => {
  function App(this: Refs<FC, { comp: ComponentElement }>) {
    return (
      <div>
        <component name="count" props={{}} ref={this.refs.comp} placeholder={<p>loading...</p>} />
        <button class="refresh" type="button" onClick={() => this.refs.comp.refresh()} />
        <button
          class="greet"
          type="button"
          onClick={() => {
            this.refs.comp.name = "greeting";
            this.refs.comp.props = { message: "Hello, world!" };
          }}
        />
      </div>
    );
  }

  const testPageUrl = addTestPage(<App />);
  const page = await browser.newPage();
  await page.goto(testPageUrl);

  await page.waitForNetworkIdle();
  const span = await page.$("div span");
  assert(span);
  assertEquals(await span.evaluate((el: HTMLElement) => el.textContent), "0");

  const refreshButton = await page.$("div button.refresh");
  assert(refreshButton);
  await refreshButton.click();
  await page.waitForNetworkIdle();

  const refreshedSpan = await page.$("div span");
  assert(refreshedSpan);
  assertEquals(await refreshedSpan.evaluate((el: HTMLElement) => el.textContent), "1");

  const greetButton = await page.$("div button.greet");
  assert(greetButton);
  await greetButton.click();
  await page.waitForNetworkIdle();

  const removedSpan = await page.$("div span");
  assert(!removedSpan);

  const h1 = await page.$("div h1");
  assert(h1);
  assertEquals(await h1.evaluate((el: HTMLElement) => el.textContent), "Hello, world!");

  await page.close();
});

Deno.test("[runtime] <router>", sanitizeFalse, async () => {
  function App(this: FC) {
    return (
      <>
        <header>
          <nav style={{ "& .current": { fontWeight: "bold" } }} data-active-class="current">
            <ul>
              <li>
                <a href="/">Home</a>
              </li>
              <li>
                <a href="/about">About</a>
              </li>
              <li>
                <a href="/post/hello-world">Hello World</a>
              </li>
              <li>
                <a href="/e404">E404</a>
              </li>
            </ul>
          </nav>
          <em>{this.$(() => this.app.url.href)}</em>
        </header>
        <router>
          <p>Page not found</p>
        </router>
      </>
    );
  }

  const testPageUrl = addTestPage(<App />);
  const page = await browser.newPage();
  await page.goto(testPageUrl);

  let p = await page.$("p");
  assert(p);
  assertEquals(await p.evaluate((el: HTMLElement) => el.textContent), "Page not found");

  let link = await page.$("nav a[href='/']");
  assert(link);
  await link.click();
  await page.waitForNetworkIdle();
  assert(await link.evaluate((el: HTMLAnchorElement) => el.classList.contains("current")));

  p = await page.$("p");
  assert(!p);

  let h1 = await page.$("h1");
  assert(h1);
  assertEquals(await h1.evaluate((el: HTMLElement) => el.textContent), "Home");

  let em = await page.$("em");
  assert(em);
  assertEquals(await em.evaluate((el: HTMLElement) => el.textContent), "http://localhost:8687/");

  link = await page.$("nav a[href='/about']");
  assert(link);
  await link.click();
  await page.waitForNetworkIdle();
  assert(await link.evaluate((el: HTMLAnchorElement) => el.classList.contains("current")));

  h1 = await page.$("h1");
  assert(h1);
  assertEquals(await h1.evaluate((el: HTMLElement) => el.textContent), "About");

  em = await page.$("em");
  assert(em);
  assertEquals(await em.evaluate((el: HTMLElement) => el.textContent), "http://localhost:8687/about");

  link = await page.$("nav a[href='/post/hello-world']");
  assert(link);
  await link.click();
  await page.waitForNetworkIdle();
  assert(await link.evaluate((el: HTMLAnchorElement) => el.classList.contains("current")));

  h1 = await page.$("h1");
  assert(h1);
  assertEquals(await h1.evaluate((el: HTMLElement) => el.textContent), "Post: hello-world");

  em = await page.$("em");
  assert(em);
  assertEquals(await em.evaluate((el: HTMLElement) => el.textContent), "http://localhost:8687/post/hello-world");

  link = await page.$("nav a[href='/e404']");
  assert(link);
  await link.click();
  await page.waitForNetworkIdle();
  assert(await link.evaluate((el: HTMLAnchorElement) => el.classList.contains("current")));

  h1 = await page.$("h1");
  assert(!h1);

  p = await page.$("p");
  assert(p);
  assertEquals(await p.evaluate((el: HTMLElement) => el.textContent), "Page not found");

  em = await page.$("em");
  assert(em);
  assertEquals(await em.evaluate((el: HTMLElement) => el.textContent), "http://localhost:8687/e404");

  await page.close();
});

Deno.test("[runtime] <form> action callback", sanitizeFalse, async () => {
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
  function App(this: Refs<FC, { h2: HTMLElement }, { h1: HTMLElement }>) {
    this.effect(() => {
      this.app.refs.h1.textContent = "Welcome to mono-jsx!";
      this.refs.h2.textContent = "Building User Interfaces.";
    });
    return (
      <hgroup>
        <h1 ref={this.app.refs.h1} />;
        <h2 ref={this.refs.h2} />;
      </hgroup>
    );
  }
  const testPageUrl = addTestPage(
    <App />,
  );

  const page = await browser.newPage();
  await page.goto(testPageUrl);

  const h1 = await page.$("h1");
  assert(h1);
  assertEquals(await h1.evaluate((el: HTMLElement) => el.textContent), "Welcome to mono-jsx!");

  const h2 = await page.$("h2");
  assert(h2);
  assertEquals(await h2.evaluate((el: HTMLElement) => el.textContent), "Building User Interfaces.");

  await page.close();
});

Deno.test("[runtime] ref callback", sanitizeFalse, async () => {
  function App(this: FC) {
    return (
      <div
        ref={(el) => {
          el.innerHTML = "<h1>Welcome to mono-jsx!</h1>";
        }}
      />
    );
  }
  const testPageUrl = addTestPage(<App />);

  const page = await browser.newPage();
  await page.goto(testPageUrl);

  const div = await page.$("div");
  assert(div);
  assertEquals(await div.evaluate((el: HTMLElement) => el.innerHTML), "<h1>Welcome to mono-jsx!</h1>");

  await page.close();
});

Deno.test("[runtime] htmx integration", { ...sanitizeFalse, ignore: false }, async () => {
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
