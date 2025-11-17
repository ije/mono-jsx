# mono-jsx/dom

> [!WARNING]
> This project is currently under active development. The API may change at any time. Use at your own risk. Please report any issues or feature requests on the issues page.

`mono-jsx/dom` is the **Client-Side Rendering** mode of `mono-jsx`. It uses browser-specific APIs to render the UI.

## Installation

```bash
npm install mono-jsx
```

## Usage

To use `mono-jsx/dom`, add the following configuration to your `tsconfig.json`:

```jsonc
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "mono-jsx/dom"
  }
}
```

To mount the UI to the DOM, use the `<mount>` element:

```tsx
// app.tsx

function App() {
  return <div>Hello, world!</div>;
}

<mount root={document.body}>
  <App />
</mount>
```

You can also use the `@jsxImportSource` pragma directive to use `mono-jsx/dom` as your JSX runtime:

```tsx
/** @jsxImportSource mono-jsx/dom */

function App() {
  return <div>Hello, world!</div>;
}

<mount root={document.body}>
  <App />
</mount>
```

## Build

`mono-jsx/dom` uses JSX to describe the UI which is not supported by browsers. You need to compile your app to JavaScript before serving it to the browser. We suggest using bun with mono-jsx to build your app:

```ts
// server.ts
import homepage from "./index.html";

export default {
  routes: {
    "/": homepage,
  },
  async fetch(req) {
    // ...api requests
    return new Response("hello world");
  },
}
```

In `index.html`, you need use `<script type="module">` to load the `app.tsx` file without the build step.

```html
<!-- index.html -->
<html>
  <head>
    <title>My App</title>
    <script type="module" src="./app.tsx"></script>
  </head>
  <body></body>
</html>
```

```tsx
// app.tsx
function App() {
  return <div>Hello, world!</div>;
}

<mount root={document.body}>
  <App />
</mount>
```
