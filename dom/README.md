# mono-jsx/dom

> [!WARNING]
> This project is currently under active development. The API may change at any time. Use at your own risk. Please report any issues or feature requests on the issues page.

`mono-jsx/dom` is the **Client-Side Rendering** mode of `mono-jsx`. It uses browser-specific APIs to render the UI.

## Installation

```bash
npm install mono-jsx
```

## Setup JSX Runtime

To use mono-jsx as your JSX runtime, add the following configuration to your `tsconfig.json` (or `deno.json` for Deno):

```jsonc
{
  "compilerOptions": {
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "jsxImportSource": "mono-jsx/dom"
  }
}
```

You can also run `mono-jsx setup --csr` to automatically add the configuration to your project:

```bash
npx mono-jsx setup --csr
```

You can also use the `@jsxImportSource` pragma directive to use `mono-jsx/dom` as your JSX runtime:

```tsx
/** @jsxImportSource mono-jsx/dom */

function App() {
  return <div>Hello, world!</div>;
}

document.body.mount(<App />);
```

## Usage

mono-jsx/dom adds a `mount` method to the `HTMLElement` prototype to allow you to mount the UI to the DOM.

```tsx
function App() {
  return <div>Hello, world!</div>;
}

document.body.mount(<App />);
```
