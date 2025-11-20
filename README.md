# mono-jsx

![`<html>` as a `Response`](./.github/og-image.png)

mono-jsx is a JSX runtime that renders the `<html>` element to a `Response` object.

- 🚀 No build step needed
- 🦋 Lightweight (12KB gzipped), zero dependencies
- 🚦 Signals as reactive primitives
- ⚡️ Use web components, no virtual DOM
- 💡 Complete Web API TypeScript definitions
- ⏳ Streaming rendering
- 🗂️ Built-in router (SPA mode)
- 🔑 Session storage
- 🥷 [htmx](#using-htmx) integration
- 🌎 Universal, works in Node.js, Deno, Bun, Cloudflare Workers, etc.

Playground: https://val.town/x/ije/mono-jsx

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

### Setup JSX Runtime

To use mono-jsx as your JSX runtime, add the following configuration to your `tsconfig.json` (or `deno.json` for Deno):

```jsonc
{
  "compilerOptions": {
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "jsxImportSource": "mono-jsx"
  }
}
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

### Zero Configuration

Alternatively, you can use the `@jsxImportSource` pragma directive without installing mono-jsx (no package.json/tsconfig/node_modules). The runtime (Deno/Bun) automatically installs mono-jsx to your computer:

```js
// Deno, Valtown
/** @jsxImportSource https://esm.sh/mono-jsx */

// Bun
/** @jsxImportSource mono-jsx */
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
bun app.tsx
```

If you're building a web app with [Cloudflare Workers](https://developers.cloudflare.com/workers/wrangler/commands/#dev), use `wrangler dev` to start your app in development mode:

```bash
npx wrangler dev app.tsx
```

**Node.js doesn't support JSX syntax or declarative fetch servers**, we recommend using mono-jsx with [srvx](https://srvx.h3.dev) and [tsx](https://tsx.is) (as JSX loader) to start your app:

```bash
# npm i srvx tsx
npx srvx --import tsx app.tsx
```

> [!NOTE]
> Only the root `<html>` element will be rendered as a `Response` object. You cannot return a `<div>` or any other element directly from the `fetch` handler. This is a limitation of mono-jsx.

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
    display: "inline-flex",
    gap: "0.5em",
    color: "black",
    "::after": { content: "↩️" },
    ":hover": { textDecoration: "underline" },
    "@media (prefers-color-scheme: dark)": { color: "white" },
    "& .icon": { width: "1em", height: "1em" },
  }}
>
  <img class="icon" src="link.png" />
  Link
</a>;
```

### Using View Transition

mono-jsx supports [View Transition](https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API) to create smooth transitions between views. To use view transitions, add the `viewTransition` attribute to the following components:

 - `<toggle viewTransition="view-transition-name">`
 - `<switch viewTransition="view-transition-name">`
 - `<component viewTransition="view-transition-name">`
 - `<router viewTransition="view-transition-name">`

You can set custom transition animations by adding [`::view-transition-group`](https://developer.mozilla.org/en-US/docs/Web/CSS/::view-transition-group), [`::view-transition-old`](https://developer.mozilla.org/en-US/docs/Web/CSS/::view-transition-old), and [`::view-transition-new`](https://developer.mozilla.org/en-US/docs/Web/CSS/::view-transition-new) pseudo-elements with your own CSS animations. For example:

```tsx
function App(this: FC<{ show: boolean }>) {
  return (
    <div
      style={{
        "@keyframes fade-in": { from: { opacity: 0 }, to: { opacity: 1 } },
        "@keyframes fade-out": { from: { opacity: 1 }, to: { opacity: 0 } },
        "::view-transition-group(fade)": { animationDuration: "0.3s" },
        "::view-transition-old(fade)": { animation: "0.3s ease-in both fade-out" },
        "::view-transition-new(fade)": { animation: "0.3s ease-in both fade-in" },
      }}
    >
      <toggle show={this.show} viewTransition="fade">
        <h1>Hello world!</h1>
      </toggle>
      <button onClick={() => this.show = !this.show}>Toggle</button>
    </div>
  )
}
```

You can also set the `viewTransition` attribute a html element which contains signal children.

```tsx
function App(this: FC<{ message: string }>) {
  this.message = "Hello world!";
  return (
    <h1 viewTransition="fade">{this.message}</h1>
  )
}
```

You can also set the view transition name in the style property with the `viewTransition` attribute set to `true`.

```tsx
function App(this: FC<{ message: string }>) {
  this.message = "Hello world!";
  return (
    <h1 viewTransition style={{ viewTransitionName: "fade" }}>{this.message}</h1>
  )
}
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

mono-jsx provides an `html` tag function to render raw HTML, which is similar to React's `dangerouslySetInnerHTML`.

```tsx
function App() {
  return <div>{html`<h1>Hello world!</h1>`}</div>;
}
```

Variables in the `html` template literal are escaped. To render raw HTML without escaping, call the `html` function with a string literal.

```tsx
function App() {
  return <div>{html(`${<h1>Hello world!</h1>}`)}</div>;
}
```

The `html` function is globally available without importing. You can also use `css` and `js` functions for CSS and JavaScript:

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

Event handlers are never called on the server-side. They're serialized to strings and sent to the client. **This means you should NOT use server-side variables or functions in event handlers.**

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

mono-jsx allows you to use a function as the value of the `action` attribute of the `<form>` element. The function will be called on form submission, and the `FormData` object will contain the form data.

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

mono-jsx supports async components that return a `Promise` or an async function. With streaming rendering, async components are rendered asynchronously, allowing you to fetch data or perform other async operations before rendering the component.

```tsx
async function Loader(props: { url: string }) {
  const data = await fetch(props.url).then((res) => res.json());
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

You can use `placeholder` to display a loading state while waiting for async components to render:

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

mono-jsx renders HTML on the server side and sends no hydration JavaScript to the client. To render a component dynamically on the client, you can use the `<component>` element to ask the server to render a component:

To render a component by name, you can use the `<component>` element with the `name` prop, and ensure the component is registered in the `components` prop of root `<html>` element.

```tsx
function Foo(props: { bar: string }) {
  return <h1>{props.bar}</h1>;
}

export default {
  fetch: (req) => (
    <html request={req} components={{ Foo }}>
      <component name="Foo" props={{ bar: "baz" }} placeholder={<p>Loading...</p>} />
    </html>
  )
}
```

You can use the `<component>` element with the `is` prop to render a component by function reference without registering the component in the `components` prop of root `<html>` element.

```tsx
export default {
  fetch: (req) => (
    <html request={req}>
      <component is={Foo} props={{ bar: "baz" }} placeholder={<p>Loading...</p>} />
    </html>
  )
}
```

Or you can use the `<component>` element with the `as` prop to render a component by JSX element.

```tsx
export default {
  fetch: (req) => (
    <html request={req}>
      <component as={<Foo bar="baz" />} placeholder={<p>Loading...</p>} />
    </html>
  )
}
```

You can also use [signals](#using-signals) for `name` or `props` attributes of a component. Changing the signal value will trigger the component to re-render with the new name or props:

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
    <html request={req} components={{ Profile, Projects, Settings }}>
      <Dash />
    </html>
  )
}
```

You can use the `<toggle>` element to control when to render a component:

```tsx
async function Lazy(this: FC<{ show: boolean }>, props: { url: string }) {
  this.show = false;
  return (
    <div>
      <toggle show={this.show}>
        <component name="Foo" props={{ bar: "baz" }} placeholder={<p>Loading...</p>} />
      </toggle>
     <button onClick={() => this.show = true }>Load `Foo` Component</button>
    </div>
  )
}

export default {
  fetch: (req) => (
    <html request={req} components={{ Foo }}>
      <Lazy />
    </html>
  )
}
```

## Using Signals

mono-jsx uses signals for updating the view when a signal changes. Signals are similar to React's state, but they are more lightweight and efficient. You can use signals to manage state in your components.

### Using Component Signals

You can use the `this` keyword in your components to manage signals. Signals are bound to the component instance, can be updated directly, and the view will automatically re-render when a signal changes:

```tsx
function Counter(
  this: FC<{ count: number }>,
  props: { initialCount?: number },
) {
  // Initialize a signal
  this.count = props.initialCount ?? 0;

  return (
    <div>
      {/* render signal */}
      <span>{this.count}</span>

      {/* Update signal to trigger re-render */}
      <button onClick={() => this.count--}>-</button>
      <button onClick={() => this.count++}>+</button>
    </div>
  )
}
```

### Using App Signals

You can define app signals by adding the `app` prop to the root `<html>` element. The app signals are available in all components via `this.app.<SignalName>`. Changes to the app signals will trigger re-renders in all components that use them:

```tsx
interface AppSignals {
  themeColor: string;
}

function Header(this: App<FC, AppSignals>) {
  return (
    <header>
      <h1 style={{ color: this.app.themeColor }}>Welcome to mono-jsx!</h1>
    </header>
  )
}

function Footer(this: App<FC, AppSignals>) {
  return (
    <footer>
      <p style={{ color: this.app.themeColor }}>(c) 2025 mono-jsx.</p>
    </footer>
  )
}

function Main(this: App<FC, AppSignals>) {
  return (
    <main>
      <p>
        <label>Theme Color: </label>
        <input type="color" $value={this.app.themeColor} />
      </p>
    </main>
  )
}

export default {
  fetch: (req) => (
    <html app={{ themeColor: "#232323" } satisfies AppSignals}>
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
      <input type="text" $value={this.input} />
    </div>
  )
}
```

> [!TIP]
> You can use `this.$` as a shorthand for `this.computed` to create computed signals.

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

The callback function of `this.effect` can return a cleanup function that gets run once the component element has been removed via `<toggle>` or `<switch>` conditional rendering:

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

The `<toggle>` element conditionally renders content based on the `show` prop. You can use signals to control the visibility of the content on the client side.

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

The `<switch>` element renders different content based on the `value` prop. Elements with matching `slot` attributes are displayed when their value matches, otherwise default slots are shown. Like `<toggle>`, you can use signals to control the value on the client side.

```tsx
function App(this: FC<{ lang: "en" | "zh" | "🙂" }>) {
  this.lang = "en";

  return (
    <div>
      <switch value={this.lang}>
        <h1 slot="en">Hello, world!</h1>
        <h1 slot="zh">你好，世界！</h1>
        <h1 slot="🙂">✋🌎❗️</h1>
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

### Form Input Bindings with `$value` Attribute

You can use the `$value` attribute to bind a signal to the value of a form input element. The `$value` attribute is a two-way data binding, which means that when the input value changes, the signal will be updated, and when the signal changes, the input value will be updated.

```tsx
function App(this: FC<{ value: string }>) {
  this.value = "Welcome to mono-jsx";
  this.effect(() => {
    console.log("value changed:", this.value);
  });
  // return <input value={this.value} oninput={e => this.value = e.target.value} />;
  return <input $value={this.value} />;
}
```

You can also use the `$checked` attribute to bind a signal to the checked state of a checkbox or radio input element.

```tsx
function App(this: FC<{ checked: boolean }>) {
  this.checked = false;
  return <input type="checkbox" $checked={this.checked} />;
}
```

### Limitations of Signals

1\. Arrow functions are non-stateful components.

```tsx
// ❌ Won't work - uses `this` in a non-stateful component
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

3\. The callback function of `this.computed` must be a pure function. This means it should not create side effects or access any non-stateful variables. For example, you cannot use `Deno` or `document` in the callback function:

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

- `app`: The app global signals.
- `context`: The context object defined on the root `<html>` element.
- `request`: The request object from the `fetch` handler.
- `session`: The session storage.
- `form`: The route form data.
- `refs`: A map of refs defined in the component.
- `computed`: A method to create a computed signal.
- `effect`: A method to create side effects.

```ts
type FC<Signals = {}, Refs = {}, AppSignals = {}, AppRefs = {}, Context = {}> = {
  readonly app: AppSignals & { refs: AppRefs; url: WithParams<URL> }
  readonly context: Context;
  readonly request: WithParams<Request>;
  readonly session: Session;
  readonly form?: FormData;
  readonly refs: Refs;
  readonly computed: <T = unknown>(fn: () => T) => T;
  readonly $: FC["computed"];
  readonly effect: (fn: () => void | (() => void)) => void;
} & Signals;
```

### Using Signals

See the [Using Signals](#using-signals) section for more details on how to use signals in your components.

### Using Refs

You can use `this.refs` to access refs in your components. Refs are defined using the `ref` attribute in JSX, and they allow you to access DOM elements directly. The `refs` object is a map of ref names to DOM elements.

```tsx
function App(this: Refs<FC, { input?: HTMLInputElement }>) {
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

You can also use `this.app.refs` to access app-level refs:

```tsx
function Layout(this: FC) {
  return (
    <>
    <header>
      <h1 ref={this.refs.h1}>Welcome to mono-jsx!</h1>
    </header>
    <main>
      <slot />
    </main>
    </>
  )
}
```

The `<component>` element also supports the `ref` attribute, which allows you to control the component rendering manually. The `ref` will be a `ComponentElement` that has the `name`, `props`, and `refresh` properties:

- `name`: The name of the component to render.
- `props`: The props to pass to the component.
- `refresh`: A method to re-render the component with the current name and props.

```tsx
import type { ComponentElement } from "mono-jsx";

function App(this: Refs<FC, { component: ComponentElement }>) {
  this.effect(() => {
    // updating the component name and props will trigger a re-render of the component
    this.refs.component.name = "Foo";
    this.refs.component.props = {};

    const timer = setInterval(() => {
      // re-render the component
      this.refs.component.refresh();
    }, 1000);
    return () => clearInterval(timer); // cleanup
  });
  return (
    <div>
      <component ref={this.refs.component} />
    </div>
  )
}
```

### Using Context

You can use the `context` property in `this` to access context values in your components. The context is defined on the root `<html>` element:

```tsx
function Dash(this: Context<FC, { auth: { uuid: string; name: string } }>) {
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

## Using Router (SPA mode)

mono-jsx provides a built-in `<router>` element that allows your app to render components based on the current URL. On the client side, it listens to all `click` events on `<a>` elements and asynchronously fetches the route component without reloading the entire page.

To use the router, you need to define your routes as a mapping of URL patterns to components and pass it to the `<html>` element as the `routes` prop. The `request` prop is also required to match the current URL against the defined routes.

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
      <nav>
        <a href="/">Home</a>
        <a href="/about">About</a>
        <a href="/blog">Blog</a>
      </nav>
      <router />
    </html>
  )
}
```

The mono-jsx router requires [URLPattern](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern) to match routes:

- ✅ Deno
- ✅ Cloudflare Workers
- ✅ Node.js (>= 24)

For Bun users, mono-jsx provides a `buildRoutes` function that uses Bun's built-in server routing:

```tsx
import { buildRoutes } from "mono-jsx"

const routes = {
  "/": Home,
  "/about": About,
  "/blog": Blog,
  "/post/:id": Post,
}

Bun.serve({
  routes: buildRoutes((req) => (
    <html request={req} routes={routes}>
      <nav>
        <a href="/">Home</a>
        <a href="/about">About</a>
        <a href="/blog">Blog</a>
      </nav>
      <router />
    </html>
  ))
})
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

### Using Route Form

When a form is submitted with the `route` attribute in a route component, the form data will be available in the `form` property of the component's `this` context during the form POST request.

mono-jsx provides two built-in elements to allow you to control the post-submit behavior:

- `<invalid for="...">{message}</invalid>` to set custom validation state for the form elements.
- `<redirect to="..." />` to redirect to a new route/URL.

```tsx
async function Login(this: FC) {
  if (this.form) {
    const user = await auth(this.form)
    if (!user) {
      return <invalid for="username,password">Invalid Username/Password</invalid>
    }
    this.session.set("user", user)
    return <redirect to="/dash" />
  }
  return (
    <form route style={{ "& input:invalid": { borderColor: "red" } }}>
      <input type="text" name="username" placeholder="Username" />
      <input type="password" name="password" placeholder="Password" />
      <button type="submit">Login</button>
    </form>
  )
}
```

> [!NOTE]
> You can use `:invalid` CSS selector to style the form elements with invalid state.

You can also return regular HTML elements from the route form post response. The `formslot` element is used to
mark the position where the returned HTML elements will be inserted.

- `<formslot mode="insertbefore" />`: Insert HTML before the `formslot` element.
- `<formslot mode="insertafter" />`: Insert HTML after the `formslot` element.
- `<formslot mode="replace" />`: Replace the `formslot` children. This is the default mode.

```tsx
function FormSlot(this: FC) {
  if (this.form) {
    const message = this.form.get("message") as string | null;
    if (!message) {
      return <invalid for="message">Message is required</invalid>
    }
    return <p>{message}</p>
  }
  return (
   <form route>
    {/* <- new message will be inserted here */}
    <formslot mode="insertbefore" />
    <input type="text" name="message" placeholder="Type Message..." style={{ ":invalid": { borderColor: "red" } }} />
    <button type="submit">Send</button>
   </form>
  )
}
```

### Using `this.app.url` Signal

`this.app.url` is an app-level signal that contains the current route URL and parameters. The `this.app.url` signal is automatically updated when the route changes, so you can use it to display the current URL in your components or control the view with `<toggle>` or `<switch>` elements:

```tsx
function App(this: FC) {
  return (
    <div>
      <h1>Current Pathname: {this.$(() => this.app.url.pathname)}</h1>
    </div>
  )
}
```

### Navigation between Pages

To navigate between pages, you can use `<a>` elements with `href` attributes that match the defined routes. The router will intercept the click events of these links and fetch the corresponding route component without reloading the page:

```tsx
export default {
  fetch: (req) => (
    <html request={req} routes={routes}>
      <nav>
        <a href="/">Home</a>
        <a href="/about">About</a>
        <a href="/blog">Blog</a>
      </nav>
      <router />
    </html>
  )
}
```

### Nav Links

Links under the `<nav>` element will be treated as navigation links by the router. When the `href` of a nav link matches a route, an active class will be added to the link element. By default, the active class is `active`, but you can customize it by setting the `data-active-class` attribute on the `<nav>` element. You can add styles for the active link using nested CSS selectors in the `style` attribute of the `<nav>` element.

```tsx
export default {
  fetch: (req) => (
    <html request={req} routes={routes}>
      <nav style={{ "& a.active": { fontWeight: "bold" } }} data-active-class="active">
        <a href="/">Home</a>
        <a href="/about">About</a>
        <a href="/blog">Blog</a>
      </nav>
      <router />
    </html>
  )
}
```

### Fallback (404)

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

## Using Session

mono-jsx provides a built-in session storage that allows you to manage user sessions. To use the session storage, you need to set the `session` prop on the root `<html>` element with the `cookie.secret` option.

```tsx
function Index(this: FC) {
  const user = this.session.get<{ name: string }>("user")
  if (!user) {
    return <p>Please <a href="/login">Login</a></p>
  }
  return <p>Welcome, {user.name}!</p>
}

async function Login(this: FC) {
  if (this.form) {
    const user = await auth(this.form)
    if (!user) {
      return <invalid for="username,password">Invalid Username/Password</invalid>
    }
    this.session.set("user", user)
    return <redirect to="/" />
  }
  return (
    <form route>
      <input type="text" name="username" placeholder="Username" />
      <input type="password" name="password" placeholder="Password" />
      <button type="submit">Login</button>
    </form>
  )
}

const routes = {
  "/": Index,
  "/login": Login,
}

export default {
  fetch: (req) => (
    <html request={req} routes={routes} session={{ cookie: { secret: "..." } }}>
      <router />
    </html>
  )
}
```

### Session Storage API

```ts
function Component(this: FC) {
  // set a value in the session
  this.session.set("user", { name: "John" })
  // get a value from the session
  this.session.get<{ name: string }>("user") // { name: "John" }
  // get all entries from the session
  this.session.entries() // [["user", { name: "John" }]]
  // delete a value from the session
  this.session.delete("user")
  // destroy the session
  this.session.destroy()
}
```

## Caching

mono-jsx renders HTML dynamically per request; large apps may tax your CPU resources. To improve rendering performance, mono-jsx introduces two built-in elements that can cache the rendered HTML of the children:

- `<cache>` with specified `key` and `ttl`
- `<static>` for elements that rarely change, such as `<svg>`

```tsx
function BlogPage() {
  return (
    <cache key="blog" ttl={86400}>
      <Blog />
    </cache>
  )
}

function Icon() {
  return (
    <static>
      <svg>...</svg>
    </static>
  )
}
```

## Customizing HTML Response

You can add `status` or `headers` attributes to the root `<html>` element to customize the HTTP response:

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

#### Setting Up htmx Manually

By default, mono-jsx imports htmx from the [esm.sh](https://esm.sh/) CDN when you set the `htmx` attribute. You can also set up htmx manually with your own CDN or local copy:

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
