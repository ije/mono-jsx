import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";

export async function setup() {
  if (globalThis.Deno && existsSync("deno.jsonc")) {
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
  const compilerOptions = tsConfig.compilerOptions ?? (tsConfig.compilerOptions = {});
  if (compilerOptions.jsx === "react-jsx" && compilerOptions.jsxImportSource === "mono-jsx") {
    console.log("%cmono-jsx already setup.", "color:grey");
    return;
  }
  if (!globalThis.Deno) {
    compilerOptions.lib ??= ["dom", "es2022"];
    compilerOptions.module ??= "es2022";
    compilerOptions.moduleResolution ??= "bundler";
    compilerOptions.allowImportingTsExtensions ??= true;
    compilerOptions.noEmit ??= true;
  }
  compilerOptions.jsx = "react-jsx";
  compilerOptions.jsxImportSource = "mono-jsx";
  await writeFile(tsConfigFilename, JSON.stringify(tsConfig, null, 2));
  console.log("✅ mono-jsx setup complete.");
}
