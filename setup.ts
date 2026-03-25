import { lstat, readFile, writeFile } from "node:fs/promises";

const serverTSX = `// mono-jsx SSR example
// Docs: https://github.com/ije/mono-jsx

function App(this: FC<{ a: number; b: number }>) {
  this.init({ a: 1,  b: 2 })

  this.effect(() => {
    // effect is called when the component is mounted or when the dependencies(calc.a & calc.b) change
    console.log("sum", this.a * this.b);
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
      args: ["add", "npm:mono-jsx"],
      stdout: "inherit",
      stderr: "inherit",
    })).spawn().status;
  } else {
    let npm = "npm";
    if ("Bun" in globalThis || await exists("bun.lock")) {
      npm = "bun";
    } else if (await exists("pnpm-lock.yaml")) {
      npm = "pnpm";
    }
    const { spawnSync } = await import("node:child_process");
    spawnSync(npm, ["add", "mono-jsx"], { stdio: "inherit" });
  }
}

export async function setup() {
  await install();
  if (!await exists("server.tsx")) {
    await writeFile("server.tsx", serverTSX);
  }
  if (globalThis.Deno && await exists("deno.jsonc")) {
    await install();
    console.log("Please add the following options to your deno.jsonc file:");
    console.log("{");
    console.log('  "compilerOptions": {');
    console.log('    \x1b[32m"jsx": "react-jsx",\x1b[0m');
    console.log('    \x1b[32m"jsxImportSource": "mono-jsx",\x1b[0m');
    console.log("  }");
    console.log("}");
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
  const compilerOptions = tsConfig.compilerOptions ?? (tsConfig.compilerOptions = {});
  compilerOptions.lib ??= globalThis.Deno ? ["dom", "esnext", "deno.ns"] : ["dom", "esnext"];
  compilerOptions.jsx = "react-jsx";
  compilerOptions.jsxImportSource = "mono-jsx";
  if (!globalThis.Deno) {
    compilerOptions.module ??= "esnext";
    compilerOptions.moduleResolution ??= "bundler";
    compilerOptions.allowImportingTsExtensions ??= true;
    compilerOptions.noEmit ??= true;
  }
  await writeFile(tsConfigFilename, JSON.stringify(tsConfig, null, 2));
  console.log("\x1b[32m✅ mono-jsx setup complete.\x1b[0m");
}

if (import.meta.main) {
  await setup();
}

async function exists(path: string) {
  try {
    return await lstat(path);
  } catch {
    return false;
  }
}
