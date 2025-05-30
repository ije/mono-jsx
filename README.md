# mono-jsx

![`<html>` as a `Response`](./.github/og-image.png)

mono-jsx is a JSX runtime that renders `<html>` element to `Response` object in JavaScript runtimes like Node.js, Deno, Bun, Cloudflare Workers, etc.

- 🚀 No build step needed
- 🦋 Lightweight (10KB gzipped), zero dependencies
- 🚦 Signals as reactive primitives
- ⚡️ Use web components, no virtual DOM
- 💡 Complete Web API TypeScript definitions
- ⏳ Streaming rendering
- 🗂️ Built-in router(SPA mode)
- 🥷 [htmx](#using-htmx) integration
- 🌎 Universal, works in Node.js, Deno, Bun, Cloudflare Workers, etc.

## Installation

mono-jsx supports all modern JavaScript runtimes including Node.js, Deno, Bun, and Cloudflare Workers.
You can install it via `npm`, `deno`, or `bun`:

```bash
# Node.js, Cloudflare Workers, or other node-compatible runtimes
npm i mono-jsx

# Deno
deno add npm:mono-jsx

# Bun
bun add mono-jsx
```

## Setup JSX Runtime

To use mono-jsx as your JSX runtime, add the following configuration to your `tsconfig.json` (or `deno.json` for Deno):

```jsonc
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "mono-jsx"
  }
}
```

Alternatively, you can use a pragma directive in your JSX file:

```js
/** @jsxImportSource mono-jsx */
```

You can also run `mono-jsx setup` to automatically add the configuration to your project:

```bash
# Node.js, Cloudflare Workers, or other node-compatible runtimes
npx mono-jsx setup

# Deno
deno run -A npm:mono-jsx setup

# Bun
bunx mono-jsx setup
```

## Usage

mono-jsx allows you to return an `<html>` JSX element as a `Response` object in the `fetch` handler:

```tsx
// app.tsx

export default {
  fetch: (req) => (
    <html>
      <h1>Welcome to mono-jsx!</h1>
    </html>
  )
}
```

For Deno/Bun users, you can run the `app.tsx` directly:

```bash
deno serve app.tsx
bun run app.tsx
```

If you're building a web app with [Cloudflare Workers](https://developers.cloudflare.com/workers/wrangler/commands/#dev), use `wrangler dev` to start your app in development mode:

```bash
npx wrangler dev app.tsx
```

**Node.js doesn't support JSX syntax or declarative fetch servers**, we recommend using mono-jsx with [srvx](https://srvx.h3.dev/):

```tsx
// app.tsx

import { serve } from "srvx";

serve({
  port: 3000,
  fetch: (req) => (
    <html>
      <h1>Welcome to mono-jsx!</h1>
    </html>
  ),
});
```

And you'll need [tsx](https://www.npmjs.com/package/tsx) to start the app without a build step:

```bash
npx tsx app.tsx
```

> [!NOTE]
> Only root `<html>` element will be rendered as a `Response` object. You cannot return a `<div>` or any other element directly from the `fetch` handler. This is a limitation of the mono-jsx.

## Using JSX

mono-jsx uses [**JSX**](https://react.dev/learn/describing-the-ui) to describe the user interface, similar to React but with key differences.

### Using Standard HTML Property Names

mono-jsx adopts standard HTML property names, avoiding React's custom naming conventions:

- `className` → `class`
- `htmlFor` → `for`
- `onChange` → `onInput`

### Composition with `class`

mono-jsx allows you to compose the `class` property using arrays of strings, objects, or expressions:

```tsx
<div
  class={[
    "container box",
    isActive && "active",
    { hover: isHover },
  ]}
/>;
```

### Using Pseudo Classes and Media Queries in `style`

mono-jsx supports [pseudo classes](https://developer.mozilla.org/en-US/docs/Web/CSS/Pseudo-classes), [pseudo elements](https://developer.mozilla.org/en-US/docs/Web/CSS/Pseudo-elements), [media queries](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_media_queries/Using_media_queries), and [CSS nesting](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_nesting/Using_CSS_nesting) in the `style` property:

```tsx
<a
  style={{
    color: "black",
    "::after": { content: "↩️" },
    ":hover": { textDecoration: "underline" },
    "@media (prefers-color-scheme: dark)": { color: "white" },
    "& .icon": { width: "1em", height: "1em", marginRight: "0.5em" },
  }}
>
  <img class="icon" src="link.png" />
  Link
</a>;
```

### Using `<slot>` Element

mono-jsx uses [`<slot>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/slot) elements to render slotted content (equivalent to React's `children` property). You can also add the `name` attribute to define named slots:

```tsx
function Container() {
  return (
    <div class="container">
      {/* Default slot */}
      <slot />
      {/* Named slot */}
      <slot name="desc" />
    </div>
  )
}

function App() {
  return (
    <Container>
      {/* This goes to the named slot */}
      <p slot="desc">This is a description.</p>
      {/* This goes to the default slot */}
      <h1>Hello world!</h1>
    </Container>
  )
}
```

### Using `html` Tag Function

mono-jsx provides an `html` tag function to render raw HTML in JSX instead of React's `dangerouslySetInnerHTML`:

```tsx
function App() {
  return <div>{html`<h1>Hello world!</h1>`}</div>;
}
```

The `html` tag function is globally available without importing. You can also use `css` and `js` tag functions for CSS and JavaScript:

```tsx
function App() {
  return (
    <head>
      <style>{css`h1 { font-size: 3rem; }`}</style>
      <script>{js`console.log("Hello world!")`}</script>
    </head>
  )
}
```

> [!WARNING]
> The `html` tag function is **unsafe** and can cause [**XSS**](https://en.wikipedia.org/wiki/Cross-site_scripting) vulnerabilities.

### Event Handlers

mono-jsx lets you write event handlers directly in JSX, similar to React:

```tsx
function Button() {
  return (
    <button onClick={(evt) => alert("BOOM!")}>
      Click Me
    </button>
  )
}
```

> [!NOTE]
> Event handlers are never called on the server-side. They're serialized to strings and sent to the client. **This means you should NOT use server-side variables or functions in event handlers.**

```tsx
import { doSomething } from "some-library";

function Button(this: FC<{ count: 0 }>, props: { role: string }) {
  const message = "BOOM!";        // server-side variable
  this.count = 0;                 // initialize a signal
  console.log(message);           // only prints on server-side
  return (
    <button
      role={props.role}
      onClick={(evt) => {
        alert(message);           // ❌ `message` is a server-side variable
        console.log(props.role);  // ❌ `props` is a server-side variable
        doSomething();            // ❌ `doSomething` is imported on the server-side
        Deno.exit(0);             // ❌ `Deno` is unavailable in the browser
        document.title = "BOOM!"; // ✅ `document` is a browser API
        console.log(evt.target);  // ✅ `evt` is the event object
        this.count++;             // ✅ update the `count` signal
      }}
    >
      <slot />
    </button>
  )
}
```

### Using `<form>` Element

mono-jsx supports `<form>` elements with the `action` attribute. The `action` attribute can be a string URL or a function that accepts a `FormData` object. The function will be called on form submission, and the `FormData` object will contain the form data.

```tsx
function App() {
  return (
    <form action={(data: FormData) => console.log(data.get("name"))}>
      <input type="text" name="name" />
      <button type="submit">Submit</button>
    </form>
  )
}
```

## Async Components

mono-jsx supports async components that return a `Promise` or an async function. With [streaming rendering](#streaming-rendering), async components are rendered asynchronously, allowing you to fetch data or perform other async operations before rendering the component.

```tsx
async function Loader(props: { url: string }) {
  const data = await fetch(url).then((res) => res.json());
  return <JsonViewer data={data} />;
}

export default {
  fetch: (req) => (
    <html>
      <Loader url="https://api.example.com/data" placeholder={<p>Loading...</p>} />
    </html>
  )
}
```

You can also use async generators to yield multiple elements over time. This is useful for streaming rendering of LLM tokens:

```tsx
async function* Chat(props: { prompt: string }) {
  const stream = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
    stream: true,
  });

  for await (const event of stream) {
    const text = event.choices[0]?.delta.content;
    if (text) {
      yield <span>{text}</span>;
    }
  }
}

export default {
  fetch: (req) => (
    <html>
      <Chat prompt="Tell me a story" placeholder={<span style="color:grey">●</span>} />
    </html>
  )
}
```

## Using Signals

mono-jsx uses signals for updating the view when a signal changes. Signals are similar to React's state, but they are more lightweight and efficient. You can use signals to manage state in your components.

### Using Component Signals

You can use the `this` keyword in your components to manage signals. The signals is bound to the component instance and can be updated directly, and will automatically re-render the view when a signal changes:

```tsx
function Counter(
  this: FC<{ count: number }>,
  props: { initialCount?: number },
) {
  // Initialize a singal
  this.count = props.initialCount ?? 0;

  return (
    <div>
      {/* render singal */}
      <span>{this.count}</span>

      {/* Update singal to trigger re-render */}
      <button onClick={() => this.count--}>-</button>
      <button onClick={() => this.count++}>+</button>
    </div>
  )
}
```

### Using App Signals

You can define app signals by adding `app` prop to the root `<html>` element. The app signals is available in all components via `this.app.<SignalName>`. Changes to the app signals will trigger re-renders in all components that use it:

```tsx
interface AppSignals {
  themeColor: string;
}

function Header(this: FC<{}, AppSignals>) {
  return (
    <header>
      <h1 style={this.computed(() => ({ color: this.app.themeColor }))}>Welcome to mono-jsx!</h1>
    </header>
  )
}

function Footer(this: FC<{}, AppSignals>) {
  return (
    <footer>
      <p style={this.computed(() => ({ color: this.app.themeColor }))}>(c) 2025 mono-jsx.</p>
    </footer>
  )
}

function Main(this: FC<{}, AppSignals>) {
  return (
    <main>
      <p>
        <label>Theme Color: </label>
        <input type="color" onInput={({ target }) => this.app.themeColor = target.value}/>
      </p>
    </main>
  )
}

export default {
  fetch: (req) => (
    <html app={{ themeColor: "#232323" }}>
      <Header />
      <Main />
      <Footer />
    </html>
  )
}
```

### Using Computed Signals

You can use `this.computed` to create a derived signal based on other signals:

```tsx
function App(this: FC<{ input: string }>) {
  this.input = "Welcome to mono-jsx";
  return (
    <div>
      <h1>{this.computed(() => this.input + "!")}</h1>

      <form action={(fd) => this.input = fd.get("input") as string}>
        <input type="text" name="input" value={"" + this.input} />
        <button type="submit">Submit</button>
      </form>
    </div>
  )
}
```

### Using Effects

You can use `this.effect` to create side effects based on signals. The effect will run whenever the signal changes:

```tsx
function App(this: FC<{ count: number }>) {
  this.count = 0;

  this.effect(() => {
    console.log("Count changed:", this.count);
  });

  return (
    <div>
      <span>{this.count}</span>
      <button onClick={() => this.count++}>+</button>
    </div>
  )
}
```

The callback function of `this.effect` can return a cleanup function that gets run once the component element has been removed via `<toggle>` or `<switch>` condition rendering:

```tsx
function Counter(this: FC<{ count: number }>) {
  this.count = 0;

  this.effect(() => {
    const interval = setInterval(() => {
      this.count++;
    }, 1000);

    return () => clearInterval(interval);
  });

  return (
    <div>
      <span>{this.count}</span>
    </div>
  )
}

function App(this: FC<{ show: boolean }>) {
  this.show = true
  return (
    <div>
      <toggle show={this.show}>
        <Foo />
      </toggle>
      <button onClick={e => this.show = !this.show }>{this.computed(() => this.show ? 'Hide': 'Show')}</button>
    </div>
  )
}
```

### Using `<toggle>` Element with Signals

The `<toggle>` element conditionally renders content based on the `show` prop:

```tsx
function App(this: FC<{ show: boolean }>) {
  this.show = false;

  function toggle() {
    this.show = !this.show;
  }

  return (
    <div>
      <toggle show={this.show}>
        <h1>Welcome to mono-jsx!</h1>
      </toggle>

      <button onClick={toggle}>
        {this.computed(() => this.show ? "Hide" : "Show")}
      </button>
    </div>
  )
}
```

### Using `<switch>` Element with Signals

The `<switch>` element renders different content based on the value of a signal. Elements with matching `slot` attributes are displayed when their value matches, otherwise default slots are shown:

```tsx
function App(this: FC<{ lang: "en" | "zh" | "🙂" }>) {
  this.lang = "en";

  return (
    <div>
      <switch value={this.lang}>
        <h1 slot="en">Hello, world!</h1>
        <h1 slot="zh">你好，世界！</h1>
        <h1>✋🌎❗️</h1>
      </switch>
      <p>
        <button onClick={() => this.lang = "en"}>English</button>
        <button onClick={() => this.lang = "zh"}>中文</button>
        <button onClick={() => this.lang = "🙂"}>🙂</button>
      </p>
    </div>
  )
}
```

### Limitation of Signals

1\. Arrow function are non-stateful components.

```tsx
// ❌ Won't work - use `this` in a non-stateful component
const App = () => {
  this.count = 0;
  return (
    <div>
      <span>{this.count}</span>
      <button onClick={() => this.count++}>+</button>
    </div>
  )
};

// ✅ Works correctly
function App(this: FC) {
  this.count = 0;
  return (
    <div>
      <span>{this.count}</span>
      <button onClick={() => this.count++}>+</button>
    </div>
  )
}
```

2\. Signals cannot be computed outside of the `this.computed` method.

```tsx
// ❌ Won't work - updates of a signal won't refresh the view
function App(this: FC<{ message: string }>) {
  this.message = "Welcome to mono-jsx";
  return (
    <div>
      <h1 title={this.message + "!"}>{this.message + "!"}</h1>
      <button onClick={() => this.message = "Clicked"}>
        Click Me
      </button>
    </div>
  )
}

// ✅ Works correctly
function App(this: FC) {
  this.message = "Welcome to mono-jsx";
  return (
    <div>
      <h1 title={this.computed(() => this.message + "!")}>{this.computed(() => this.message + "!")}</h1>
      <button onClick={() => this.message = "Clicked"}>
        Click Me
      </button>
    </div>
  )
}
```

3\. The callback function of `this.computed` must be a pure function. That means it should not create side effects or access any non-stateful variables. For example, you cannot use `Deno` or `document` in the callback function:

```tsx
// ❌ Won't work - throws `Deno is not defined` when the button is clicked
function App(this: FC<{ message: string }>) {
  this.message = "Welcome to mono-jsx";
  return (
    <div>
      <h1>{this.computed(() => this.message + "! (Deno " + Deno.version.deno + ")")}</h1>
      <button onClick={() => this.message = "Clicked"}>
        Click Me
      </button>
    </div>
  )
}

// ✅ Works correctly
function App(this: FC<{ message: string, denoVersion: string }>) {
  this.denoVersion = Deno.version.deno;
  this.message = "Welcome to mono-jsx";
  return (
    <div>
      <h1>{this.computed(() => this.message + "! (Deno " + this.denoVersion + ")")}</h1>
      <button onClick={() => this.message = "Clicked"}>
        Click Me
      </button>
    </div>
  )
}
```

## Using `this` in Components

mono-jsx binds a scoped signals object to `this` of your component functions. This allows you to access signals, context, and request information directly in your components.

The `this` object has the following built-in properties:

- `app`: The app signals defined on the root `<html>` element.
- `context`: The context defined on the root `<html>` element.
- `request`: The request object from the `fetch` handler.
- `refs`: A map of refs defined in the component.
- `computed`: A method to create a computed signal.
- `effect`: A method to create side effects.

```ts
type FC<Signals = {}, AppSignals = {}, Context = {}> = {
  readonly app: AppSignals;
  readonly context: Context;
  readonly request: Request & { params?: Record<string, string> };
  readonly refs: Record<string, HTMLElement | null>;
  readonly computed: <T = unknown>(fn: () => T) => T;
  readonly effect: (fn: () => void | (() => void)) => void;
} & Omit<Signals, "app" | "context" | "request" | "computed" | "effect">;
```

### Using Signals

See the [Using Signals](#using-signals) section for more details on how to use signals in your components.

### Using Refs

You can use `this.refs` to access refs in your components. Define refs in your component using the `ref` attribute:

```tsx
function App(this: FC) {
  this.effect(() => {
    this.refs.input?.addEventListener("input", (evt) => {
      console.log("Input changed:", evt.target.value);
    });
  });

  return (
    <div>
      <input ref={this.refs.input} type="text" />
      <button onClick={() => this.refs.input?.focus()}>Focus</button>
    </div>
  )
}
```

### Using Context

You can use the `context` property in `this` to access context values in your components. The context is defined on the root `<html>` element:

```tsx
function Dash(this: FC<{}, {}, { auth: { uuid: string; name: string } }>) {
  const { auth } = this.context;
  return (
    <div>
      <h1>Welcome back, {auth.name}!</h1>
      <p>Your UUID is {auth.uuid}</p>
    </div>
  )
}

export default {
  fetch: async (req) => {
    const auth = await doAuth(req);
    return (
      <html context={{ auth }} request={req}>
        {!auth && <p>Please Login</p>}
        {auth && <Dash />}
      </html>
    )
  }
}
```

### Accessing Request Info

You can access request information in components via the `request` property in `this` which is set on the root `<html>` element:

```tsx
function RequestInfo(this: FC) {
  const { request } = this;
  return (
    <div>
      <h1>Request Info</h1>
      <p>{request.method}</p>
      <p>{request.url}</p>
      <p>{request.headers.get("user-agent")}</p>
    </div>
  )
}

export default {
  fetch: (req) => (
    <html request={req}>
      <RequestInfo />
    </html>
  )
}
```

## Streaming Rendering

mono-jsx renders your `<html>` as a readable stream, allowing async components to render asynchronously. You can use `placeholder` to display a loading state while waiting for async components to render:

```tsx
async function Sleep({ ms }) {
  await new Promise((resolve) => setTimeout(resolve, ms));
  return <slot />;
}

export default {
  fetch: (req) => (
    <html>
      <Sleep ms={1000} placeholder={<p>Loading...</p>}>
        <p>After 1 second</p>
      </Sleep>
    </html>
  )
}
```

You can set the `rendering` attribute to `"eager"` to force synchronous rendering (the `placeholder` will be ignored):

```tsx
export default {
  fetch: (req) => (
    <html>
      <Sleep ms={1000} rendering="eager">
        <p>After 1 second</p>
      </Sleep>
    </html>
  )
}
```

You can add the `catch` attribute to handle errors in the async component. The `catch` attribute should be a function that returns a JSX element:

```tsx
async function Hello() {
  throw new Error("Something went wrong!");
  return <p>Hello world!</p>;
}

export default {
  fetch: (req) => (
    <html>
      <Hello catch={err => <p>{err.message}</p>} />
    </html>
  )
}
```


## Lazy Rendering

Since mono-jsx renders html on server side, and no hydration JS sent to client side. To render a component dynamically on client side, you can use the `<component>` element to ask the server to render a component and send the html back to client:

```tsx
export default {
  fetch: (req) => (
    <html components={{ Foo }}>
      <component name="Foo" props={{ /* props for the component */ }} placeholder={<p>Loading...</p>} />
    </html>
  )
}
```

You can use `<toggle>` element to control when to render the component:

```tsx
async function Lazy(this: FC<{ show: boolean }>, props: { url: string }) {
  this.show = false;
  return (
    <div>
      <toggle value={this.show}>
        <component name="Foo" props={{ /* props for the component */ }} placeholder={<p>Loading...</p>} />
      </toggle>
     <button onClick={() => this.show = true }>Load `Foo` Component</button>
    </div>
  )
}

export default {
  fetch: (req) => (
    <html components={{ Foo }}>
      <Lazy />
    </html>
  )
}
```

You also can use signal `name` or `props`, change the signal value will trigger the component to re-render with new name or props:

```tsx
import { Profile, Projects, Settings } from "./pages.tsx"

function Dash(this: FC<{ page: "Profile" | "Projects" | "Settings" }>) {
  this.page = "Profile";

  return (
    <>
      <div class="tab">
        <button onClick={e => this.page = "Profile"}>Profile</button>
        <button onClick={e => this.page = "Projects"}>Projects</button>
        <button onClick={e => this.page = "Settings"}>Settings</button>
      </div>
      <div class="page">
        <component name={this.page} placeholder={<p>Loading...</p>} />
      </div>
    </>
  )
}

export default {
  fetch: (req) => (
    <html components={{ Profile, Projects, Settings }}>
      <Dash />
    </html>
  )
}
```

## Using Router(SPA)

mono-jsx provides a built-in `<router>` element that allows your app to render components based on the current URL. On client side, it listens all `click` events on `<a>` elements and asynchronously fetches the route component without reloading the entire page.

To use the router, you need to define your routes as a mapping of URL patterns to components and pass it to the `<html>` element as `routes` prop. The `request` prop is also required to match the current URL against the defined routes.

```tsx
const routes = {
  "/": Home,
  "/about": About,
  "/blog": Blog,
  "/post/:id": Post,
}

export default {
  fetch: (req) => (
    <html request={req} routes={routes}>
      <header>
        <nav>
          <a href="/">Home</a>
          <a href="/about">About</a>
          <a href="/blog">Blog</a>
        </nav>
      </header>
      <router />
    </html>
  )
}
```

mono-jsx router requires [URLPattern](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern) to match a route:

- ✅ Deno
- ✅ Cloudflare Workers
- ✅ Nodejs (>= 24)

For Bun users, mono-jsx provides a `monoRoutes` function that uses Bun's built-in routing:

```tsx
// bun app.tsx

import { monoRoutes } from "mono-jsx"

const routes = {
  "/": Home,
  "/about": About,
  "/blog": Blog,
  "/post/:id": Post,
}

export default {
  routes: monoRoutes(routes, (request) => (
    <html request={request}>
      <router />
    </html>
  ))
}
```

### Using Route `params`

When you define a route with a parameter (e.g., `/post/:id`), mono-jsx will automatically extract the parameter from the URL and make it available in the route component. The `params` object is available in the `request` property of the component's `this` context.
You can access the `params` object in your route components to get the values of the parameters defined in the route pattern:


```tsx
// router pattern: "/post/:id"
function Post(this: FC) {
  this.request.url         // "http://localhost:3000/post/123"
  this.request.params?.id  // "123"
}
```

### Using DB/Storage in Route Components

Route components are always rendered on server-side, you can use any database or storage API to fetch data in your route components.

```tsx
async function Post(this: FC) {
  const post = await sql`SELECT * FROM posts WHERE id = ${ this.request.params!.id }`
  return (
    <article>
      <h2>{post.title}<h2>
      <div>html`${post.content}`</div>
    </article>
  )
}
```

### Nav Links

Links under the `<nav>` element will be treated as navigation links by the router. When the `href` of a nav link matches a route, a active class will be added to the link element. By default, the active class is `active`, but you can customize it by setting the `data-active-class` attribute on the `<nav>` element. You can add style for the active link using nested CSS selectors in the `style` attribute of the `<nav>` element.

```tsx
export default {
  fetch: (req) => (
    <html request={req} routes={routes}>
      <header>
        <nav style={{ "& a.active": { fontWeight: "bold" } }} data-active-class="active">
          <a href="/">Home</a>
          <a href="/about">About</a>
          <a href="/blog">Blog</a>
        </nav>
      </header>
      <router />
    </html>
  )
}
```

### Fallback(404)

You can add fallback(404) content to the `<router>` element as children, which will be displayed when no route matches the current URL.

```tsx
export default {
  fetch: (req) => (
    <html request={req} routes={routes}>
      <router>
        <p>Page Not Found</p>
        <p>Back to <a href="/">Home</a></p>
      </router>
    </html>
  )
}
```

## Customizing html Response

You can add `status` or `headers` attributes to the root `<html>` element to customize the http response:

```tsx
export default {
  fetch: (req) => (
    <html
      status={404}
      headers={{
        cacheControl: "public, max-age=0, must-revalidate",
        setCookie: "name=value",
        "x-foo": "bar",
      }}
    >
      <h1>Page Not Found</h1>
    </html>
  )
}
```

### Using htmx

mono-jsx integrates with [htmx](https://htmx.org/) and [typed-htmx](https://github.com/Desdaemon/typed-htmx). To use htmx, add the `htmx` attribute to the root `<html>` element:

```tsx
export default {
  fetch: (req) => {
    const url = new URL(req.url);

    if (url.pathname === "/clicked") {
      return (
        <html>
          <span>Clicked!</span>
        </html>
      );
    }

    return (
      <html htmx>
        <button hx-get="/clicked" hx-swap="outerHTML">
          Click Me
        </button>
      </html>
    )
  }
}
```

#### Adding htmx Extensions

You can add htmx [extensions](https://htmx.org/docs/#extensions) by adding the `htmx-ext-*` attribute to the root `<html>` element:

```tsx
export default {
  fetch: (req) => (
    <html htmx htmx-ext-response-targets htmx-ext-ws>
      <button hx-get="/clicked" hx-swap="outerHTML">
        Click Me
      </button>
    </html>
  )
}
```

#### Specifying htmx Version

You can specify the htmx version by setting the `htmx` attribute to a specific version:

```tsx
export default {
  fetch: (req) => (
    <html htmx="2.0.4" htmx-ext-response-targets="2.0.2" htmx-ext-ws="2.0.2">
      <button hx-get="/clicked" hx-swap="outerHTML">
        Click Me
      </button>
    </html>
  )
}
```

#### Setup htmx Manually

By default, mono-jsx imports htmx from [esm.sh](https://esm.sh/) CDN when you set the `htmx` attribute. You can also setup htmx manually with your own CDN or local copy:

```tsx
export default {
  fetch: (req) => (
    <html>
      <head>
        <script src="https://unpkg.com/htmx.org@2.0.4" integrity="sha384-HGfztofotfshcF7+8n44JQL2oJmowVChPTg48S+jvZoztPfvwD79OC/LTtG6dMp+" crossorigin="anonymous"></script>
        <script src="https://unpkg.com/htmx-ext-ws@2.0.2" integrity="sha384-vuKxTKv5TX/b3lLzDKP2U363sOAoRo5wSvzzc3LJsbaQRSBSS+3rKKHcOx5J8doU" crossorigin="anonymous"></script>
      </head>
      <body>
        <button hx-get="/clicked" hx-swap="outerHTML">
          Click Me
        </button>
      </body>
    </html>
  )
}
```

## License

[MIT](LICENSE)
