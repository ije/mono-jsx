import type { RenderOptions } from "../types/render.d.ts";
import { assert, assertEquals, assertThrows } from "jsr:@std/assert@1.0.19";
import puppeteer from "npm:puppeteer-core@24.37.5";
import chrome from "npm:puppeteer-chromium-resolver@24.0.3";
import { RPC_JS } from "../runtime/index.ts";
import { createRPC } from "../index.ts";
import { VERSION } from "../version.ts";

const cookieSecret = "this-is-a-test-cookie-secret";
const rpcSymbol = Symbol.for("mono.rpc");
const sanitizeFalse = { sanitizeResources: false, sanitizeOps: false };

async function createSignedSessionCookieValue(
  sessionStore: Record<string, unknown>,
  secret: string,
  expUnixSeconds: number = Math.floor(Date.now() / 1000) + 1800,
) {
  const data = JSON.stringify([sessionStore, expUnixSeconds]);
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    { name: "HMAC", hash: "SHA-256" },
    await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]),
    encoder.encode(data),
  );
  return btoa(data) + "." + btoa(String.fromCharCode(...new Uint8Array(signature)));
}

async function render(node: JSX.Element, renderOptions: RenderOptions = {}) {
  const res = await ((
    <html lang="en" {...renderOptions}>
      <body>{node}</body>
    </html>
  ) as Response | Promise<Response>);
  assert(res instanceof Response, "Response is not a Response object");
  return res;
}

Deno.test("[rpc] createRPC validates and tags rpc objects", () => {
  const rpc = createRPC({
    ping: () => "pong",
  });
  const rpcId = Reflect.get(rpc, rpcSymbol);
  assertEquals(typeof rpcId, "number");
  const invalidRPC = {
    ok: () => "ok",
    bad: 1 as unknown as (...args: any[]) => unknown,
  };
  assertThrows(
    () => createRPC(invalidRPC),
    Error,
    "createRPC: bad is not a function",
  );
  assertEquals(Reflect.has(invalidRPC, rpcSymbol), false);
});

Deno.test("[rpc] injects the client proxy into rendered html", async () => {
  const rpc = createRPC({
    greet: (name: string) => ({ message: `Hello, ${name}!` }),
    ping: () => "pong",
  });
  const rpcId = Reflect.get(rpc, rpcSymbol);
  const res = await render(<h1>RPC</h1>, { expose: { rpc } });
  const html = await res.text();

  assertEquals(res.headers.get("content-type"), "text/html; charset=utf-8");
  assert(html.includes(`<script data-mono-jsx="${VERSION}">`));
  assert(html.includes(RPC_JS));
  assert(html.includes(`window.rpc=$RPC(${rpcId},["greet","ping"]);`));
});

Deno.test("[rpc] handles rpc requests with context and session", async () => {
  const rpc = createRPC({
    whoami: function(this: RPC<{ greeting: string }>) {
      const user = this.session.get<{ name: string }>("user");
      return `${this.context.greeting}${user?.name ?? "guest"}`;
    },
  });
  const rpcId = Reflect.get(rpc, rpcSymbol);
  const session = await createSignedSessionCookieValue({ user: { name: "@ije" } }, cookieSecret);
  const res = await render(<div />, {
    context: { greeting: "Hello, " },
    expose: { rpc },
    request: new Request("https://example.com", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cookie": `session=${session}`,
        "x-rpc": "true",
        "x-rpc-id": String(rpcId),
      },
      body: JSON.stringify({ fn: "whoami", args: [] }),
    }),
    session: { cookie: { secret: cookieSecret } },
  });

  assertEquals(res.status, 200);
  assertEquals(res.headers.get("content-type"), "application/json");
  assertEquals(await res.json(), { result: "Hello, @ije" });
});

Deno.test("[rpc] session.isExpired when cookie TTL has passed", async () => {
  const rpc = createRPC({
    expired: function(this: RPC) {
      return this.session.isExpired;
    },
  });
  const rpcId = Reflect.get(rpc, rpcSymbol);
  const expiredSession = await createSignedSessionCookieValue(
    { user: { name: "@ije" } },
    cookieSecret,
    Math.floor(Date.now() / 1000) - 60,
  );
  const res = await render(<div />, {
    expose: { rpc },
    request: new Request("https://example.com", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cookie": `session=${expiredSession}`,
        "x-rpc": "true",
        "x-rpc-id": String(rpcId),
      },
      body: JSON.stringify({ fn: "expired", args: [] }),
    }),
    session: { cookie: { secret: cookieSecret } },
  });
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { result: true });
});

Deno.test("[rpc] validates rpc request metadata and serializes failures", async () => {
  const rpc = createRPC({
    fail: () => {
      throw new Error("boom");
    },
  });
  const rpcId = Reflect.get(rpc, rpcSymbol);

  const missingId = await render(<div />, {
    expose: { rpc },
    request: new Request("https://example.com", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-rpc": "true",
      },
      body: JSON.stringify({ fn: "fail", args: [] }),
    }),
  });
  assertEquals(missingId.status, 400);
  assertEquals(await missingId.json(), { error: "RPC ID is required" });

  const invalidId = await render(<div />, {
    expose: { rpc },
    request: new Request("https://example.com", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-rpc": "true",
        "x-rpc-id": "NaN",
      },
      body: JSON.stringify({ fn: "fail", args: [] }),
    }),
  });
  assertEquals(invalidId.status, 400);
  assertEquals(await invalidId.json(), { error: "RPC ID is invalid" });

  const wrongMethod = await render(<div />, {
    expose: { rpc },
    request: new Request("https://example.com", {
      headers: {
        "x-rpc": "true",
        "x-rpc-id": String(rpcId),
      },
    }),
  });
  assertEquals(wrongMethod.status, 405);
  assertEquals(await wrongMethod.text(), "");

  const missingRPC = await render(<div />, {
    expose: { rpc },
    request: new Request("https://example.com", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-rpc": "true",
        "x-rpc-id": String(rpcId + 1),
      },
      body: JSON.stringify({ fn: "fail", args: [] }),
    }),
  });
  assertEquals(missingRPC.status, 404);
  assertEquals(await missingRPC.json(), { error: "RPC target not found" });

  const invalidPayload = await render(<div />, {
    expose: { rpc },
    request: new Request("https://example.com", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-rpc": "true",
        "x-rpc-id": String(rpcId),
      },
      body: JSON.stringify({ fn: "fail", args: "oops" }),
    }),
  });
  assertEquals(invalidPayload.status, 400);
  assertEquals(await invalidPayload.json(), { error: "RPC payload is invalid" });

  const missingFunction = await render(<div />, {
    expose: { rpc },
    request: new Request("https://example.com", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-rpc": "true",
        "x-rpc-id": String(rpcId),
      },
      body: JSON.stringify({ fn: "missing", args: [] }),
    }),
  });
  assertEquals(missingFunction.status, 404);
  assertEquals(await missingFunction.json(), { error: "RPC function not found: missing" });

  const failure = await render(<div />, {
    expose: { rpc },
    request: new Request("https://example.com", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-rpc": "true",
        "x-rpc-id": String(rpcId),
      },
      body: JSON.stringify({ fn: "fail", args: [] }),
    }),
  });
  assertEquals(failure.status, 500);
  assertEquals(await failure.json(), { error: "boom" });
});

Deno.test("[rpc-runtime] calls the exposed rpc api from the browser", sanitizeFalse, async () => {
  const testPort = 8688;
  const testPageUrl = `http://localhost:${testPort}`;
  const ac = new AbortController();
  const browser = await puppeteer.launch({
    executablePath: (await chrome()).executablePath,
    args: ["--no-sandbox", "--disable-gpu", "--disable-extensions", "--disable-sync", "--disable-background-networking"],
  });
  const rpc = createRPC({
    greet: (name: string) => ({ message: `Hello, ${name}!` }),
    whoami: function(this: RPC<{ greeting: string }>) {
      const user = this.session.get<{ name: string }>("user");
      return `${this.context.greeting}${user?.name ?? "guest"}`;
    },
    fail: () => {
      throw new Error("RPC failed");
    },
  });

  function RPCApp(this: FC<{ message?: string; error?: string }>) {
    return (
      <div>
        <button
          id="greet"
          type="button"
          onClick={async () => {
            this.message = (await rpc.greet("World")).message;
          }}
        >
          Greet
        </button>
        <button
          id="whoami"
          type="button"
          onClick={async () => {
            this.message = await rpc.whoami();
          }}
        >
          Who am I?
        </button>
        <button
          id="fail"
          type="button"
          onClick={async () => {
            try {
              await rpc.fail();
            } catch (err) {
              this.error = (err as Error).message;
            }
          }}
        >
          Fail
        </button>
        <p id="message">{this.$(() => this.message ?? "idle")}</p>
        <p id="error">{this.$(() => this.error ?? "")}</p>
      </div>
    );
  }

  try {
    await new Promise((resolve) => {
      Deno.serve({ port: testPort, onListen: resolve, signal: ac.signal }, (request) => {
        const url = new URL(request.url);
        if (url.pathname === "/favicon.ico") {
          return new Response(null, { status: 404 });
        }
        return (
          <html
            request={request}
            context={{ greeting: "Hello, " }}
            session={{ cookie: { secret: cookieSecret } }}
            expose={{ rpc }}
          >
            <body>
              <RPCApp />
            </body>
          </html>
        );
      });
    });

    const rpcId = String(Reflect.get(rpc, rpcSymbol));
    const sessionValue = await createSignedSessionCookieValue({ user: { name: "@ije" } }, cookieSecret);
    const rpcRequests: Array<{ headers: Record<string, string>; body: string | undefined }> = [];
    const page = await browser.newPage();

    try {
      page.on("request", async (request) => {
        if (request.headers()["x-rpc"] === "true") {
          rpcRequests.push({
            headers: request.headers(),
            body: await request.fetchPostData(),
          });
        }
      });

      await page.browserContext().setCookie({
        name: "session",
        value: sessionValue,
        domain: "localhost",
        path: "/",
      });
      await page.goto(testPageUrl);

      assertEquals(await page.evaluate(() => typeof (window as any).rpc?.greet), "function");
      assertEquals(await page.evaluate(() => typeof (window as any).rpc?.missing), "undefined");

      await page.click("#greet");
      await page.waitForFunction(() => document.querySelector("#message")?.textContent === "Hello, World!");

      await page.click("#whoami");
      await page.waitForFunction(() => document.querySelector("#message")?.textContent === "Hello, @ije");

      await page.click("#fail");
      await page.waitForFunction(() => document.querySelector("#error")?.textContent === "RPC failed");

      assertEquals(rpcRequests.length, 3);
      assertEquals(rpcRequests[0].headers["x-rpc-id"], rpcId);
      assertEquals(rpcRequests[0].body, JSON.stringify({ fn: "greet", args: ["World"] }));
      assertEquals(rpcRequests[1].body, JSON.stringify({ fn: "whoami", args: [] }));
      assertEquals(rpcRequests[2].body, JSON.stringify({ fn: "fail", args: [] }));
    } finally {
      await page.close();
    }
  } finally {
    ac.abort();
    await browser.close();
  }
});
