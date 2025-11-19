import { lstat, readFile, writeFile } from "node:fs/promises";
import { argv } from "node:process";

const serverTSX = `// mono-jsx SSR example
// Documentation: https://ije.github.io/mono-jsx/docs/ssr

function App(this: FC<{ a: number; b: number }>) {
  this.init({
    a: 1,
    b: 2,
  })

  this.effect(() => {
    // effect is called when the component is mounted or when the dependencies(calc.a & calc.b) change
    console.log("sum", this.a * this.b);
    return () => {
      console.log("cleanup");
    };
  });

  return (
    <>
      <h1>Welcome to mono-jsx!</h1>
      <div
        style={{
          display: "inline-block",
          padding: "6px 12px",
          borderRadius: 6,
          backgroundColor: "#f4f4f6",
          fontFamily: "monospace",
          ":hover": {
            backgroundColor: "#eeeeef",
          },
          "& input": {
            fieldSizing: "content",
          },
        }}
      >
        <input type="number" $value={this.a} />
        {" * "}
        <input type="number" $value={this.b} />
        {" = "}
        {this.computed(() => this.a * this.b)}
      </div>
    </>
  );
}

export default {
  fetch: (request: Request) => (
    <html request={request}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="description" content="Building user interfaces." />
        <meta name="keywords" content="ssr,jsx" />
        <title>Welcome to mono-jsx!</title>
      </head>
      <body>
        <App />
      </body>
    </html>
  ),
};
`;

async function install() {
  if (globalThis.Deno) {
    await (new Deno.Command("deno", {
      args: ["install", "npm:mono-jsx"],
    })).spawn().status;
  } else {
    await import("node:child_process").then(module => {
      const result = module.spawnSync("bun", ["i", "mono-jsx"]);
      if (result.error) {
        if ((result.error as any).code === "ENOENT") {
          module.spawnSync("npm", ["install", "mono-jsx"]);
        } else {
          throw result.error;
        }
      }
    });
  }
}

export async function setup() {
  const csr = argv.includes("--csr");
  if (!csr && !await exists("server.tsx")) {
    await writeFile("server.tsx", serverTSX);
  }
  if (globalThis.Deno && await exists("deno.jsonc")) {
    await install();
    console.log("Please add the following options to your deno.jsonc file:");
    console.log(
      [
        `{`,
        `  "compilerOptions": {`,
        `    %c"jsx": "react-jsx",`,
        `    "jsxImportSource": "mono-jsx",%c`,
        `  }`,
        `}`,
      ].join("\n"),
      "color:green",
      "",
    );
    return;
  }
  let tsConfigFilename = globalThis.Deno ? "deno.json" : "tsconfig.json";
  let tsConfig = Object.create(null);
  try {
    const data = await readFile(tsConfigFilename, "utf8");
    tsConfig = JSON.parse(data);
  } catch {
    // ignore
  }
  const jsxImportSource = csr ? "mono-jsx/dom" : "mono-jsx";
  const compilerOptions = tsConfig.compilerOptions ?? (tsConfig.compilerOptions = {});
  if (compilerOptions.jsx === "react-jsx" && compilerOptions.jsxImportSource === jsxImportSource) {
    console.log("%cmono-jsx already setup.", "color:grey");
    return;
  }
  if (!globalThis.Deno) {
    compilerOptions.lib ??= ["dom", "esnext"];
    compilerOptions.module ??= "esnext";
    compilerOptions.moduleResolution ??= "bundler";
    compilerOptions.allowImportingTsExtensions ??= true;
    compilerOptions.noEmit ??= true;
  }
  compilerOptions.jsx = "react-jsx";
  compilerOptions.jsxImportSource = jsxImportSource;
  await writeFile(tsConfigFilename, JSON.stringify(tsConfig, null, 2));
  await install();
  console.log("✅ mono-jsx setup complete.");
}

async function exists(path: string) {
  try {
    return await lstat(path);
  } catch {
    return false;
  }
}
