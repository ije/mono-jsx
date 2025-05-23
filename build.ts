import { build, stop } from "https://deno.land/x/esbuild@v0.25.4/mod.js";

async function buildRuntime(name: string): Promise<string> {
  const ret = await build({
    entryPoints: [`./runtime/${name}.ts`],
    format: "esm",
    target: "es2022",
    write: false,
    minify: true,
  });
  if (ret.errors.length > 0) {
    throw new Error(ret.errors[0].text);
  }
  return ret.outputFiles[0].text.trim();
}

async function buildRuntimeUtils(name: string): Promise<string> {
  const ret = await build({
    stdin: {
      contents: `export { ${name} } from "./runtime/utils.ts";`,
      resolveDir: "./",
    },
    format: "esm",
    target: "es2022",
    write: false,
    bundle: true,
    minify: true,
  });
  if (ret.errors.length > 0) {
    throw new Error(ret.errors[0].text);
  }
  return ret.outputFiles[0].text.trim().replace(/export\{(\w+) as (\w+)\};$/, "window.$" + name + "=$1;");
}

async function buildPackageModule(name: string, format: "esm" | "cjs" = "esm") {
  const entryPointPath = `./${name}.ts`;
  const outfile = `./${name}.` + (format === "esm" ? "mjs" : "cjs");
  await build({
    entryPoints: [entryPointPath],
    outfile,
    format,
    target: "esnext",
    minify: false,
    bundle: true,
    external: ["node:*"],
  });
  return await Deno.lstat(outfile);
}

function stringLit(str: string): string {
  return "`{" + str + "}`";
}

function formatBytes(bytes: number): string {
  return bytes.toLocaleString() + " bytes";
}

if (import.meta.main) {
  const start = performance.now();
  const signals_js = await buildRuntime("signals");
  const suspense_js = await buildRuntime("suspense");
  const cx_js = await buildRuntimeUtils("cx");
  const styleToCSS_js = await buildRuntimeUtils("styleToCSS");
  const event_js = [
    `var w=window;`,
    `w.$emit=(e,f,s)=>f.call(w.$signals?.(s)??e.target,e.type==="mount"?e.target:e);`,
    `w.$onsubmit=(e,f,s)=>{e.preventDefault();f.call(w.$signals?.(s)??e.target,new FormData(e.target),e)};`,
    `w.$onstage=()=>document.querySelectorAll("[onmount]").forEach(t=>{const k="onmount",j=t.getAttribute(k);t.removeAttribute(k);new Function("event",j)({type:"mount",target:t})});`,
  ].join("");
  const bin_js = [
    `#!/usr/bin/env node`,
    ``,
    `import process from "node:process";`,
    `import { setup } from "../setup.mjs";`,
    ``,
    `switch (process.argv[2]) {`,
    `  case "setup":`,
    `    setup()`,
    `    break;`,
    `  default:`,
    `    process.exit(0);`,
    `}`,
    ``,
  ].join("\n");

  await Deno.writeTextFile(
    "./runtime/index.ts",
    [
      `// generated by build.ts, do not edit`,
      ``,
      `/** signals.js (${formatBytes(signals_js.length)}) */`,
      `export const SIGNALS_JS = ${stringLit(signals_js)};`,
      ``,
      `/** suspense.js (${formatBytes(suspense_js.length)}) */`,
      `export const SUSPENSE_JS = ${stringLit(suspense_js)};`,
      ``,
      `/** utils */`,
      `/** cx.js (${formatBytes(cx_js.length)}) */`,
      `/** styleToCSS.js (${formatBytes(styleToCSS_js.length)}) */`,
      `/** event.js (${formatBytes(event_js.length)}) */`,
      `export const UTILS_JS = {`,
      `  cx: ${stringLit(cx_js)},`,
      `  styleToCSS: ${stringLit(styleToCSS_js)},`,
      `  event: ${stringLit(event_js)}`,
      `};`,
      ``,
    ].join("\n"),
  );
  console.log(`· *signals.js %c(${formatBytes(signals_js.length)})`, "color:grey");
  console.log(`· *suspense.js %c(${formatBytes(suspense_js.length)})`, "color:grey");
  console.log(`· *utils/cx.js %c(${formatBytes(cx_js.length)})`, "color:grey");
  console.log(`· *utils/styleToCSS.js %c(${formatBytes(styleToCSS_js.length)})`, "color:grey");
  console.log(`· *utils/event.js %c(${formatBytes(event_js.length)})`, "color:grey");

  for (const moduleName of ["index", "jsx-runtime", "setup"]) {
    const { size } = await buildPackageModule(moduleName, "esm");
    console.log(`· ${moduleName}.mjs %c(${formatBytes(size)})`, "color:grey");
  }

  await Deno.mkdir("./bin", { recursive: true });
  Deno.writeTextFile("./bin/mono-jsx", bin_js, { mode: 0o755 });

  console.log("%cBuild complete! (%d ms)", "color:grey", performance.now() - start);
  stop();
}
