import { assertEquals } from "jsr:@std/assert@1.0.14";
import { buildRoutes } from "../index.ts";
import { ROUTER, ROUTER_JS } from "../runtime/index.ts";
import { VERSION } from "../version.ts";

Deno.test("[utils] create routes for bun server", async () => {
  const routes = {
    "/": () => "Home",
    "/about": () => "About",
    "/blog": () => "Blog",
    "/post/:id": function(this: FC) {
      return `Blog Post ${this.request.params?.id}`;
    },
  };
  const bunRoutes = buildRoutes((req: Request) => (
    <html request={req} routes={routes}>
      <router></router>
    </html>
  ));
  assertEquals(
    Object.keys(bunRoutes),
    ["/", "/about", "/blog", "/post/:id"],
  );
  assertEquals(
    await bunRoutes["/"](new Request("http://localhost/")).text(),
    [
      `<!DOCTYPE html>`,
      `<html>`,
      `<m-router status="200">`,
      `Home`,
      `</m-router>`,
      `</html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      ROUTER_JS,
      `})();`,
      `/* --- */`,
      `window.$FLAGS="1|0|${ROUTER}";`,
      `</script>`,
    ].join(""),
  );
  assertEquals(
    await bunRoutes["/about"](new Request("http://localhost/about")).text(),
    [
      `<!DOCTYPE html>`,
      `<html>`,
      `<m-router status="200">`,
      `About`,
      `</m-router>`,
      `</html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      ROUTER_JS,
      `})();`,
      `/* --- */`,
      `window.$FLAGS="1|0|${ROUTER}";`,
      `</script>`,
    ].join(""),
  );
  assertEquals(
    await bunRoutes["/blog"](new Request("http://localhost/blog")).text(),
    [
      `<!DOCTYPE html>`,
      `<html>`,
      `<m-router status="200">`,
      `Blog`,
      `</m-router>`,
      `</html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      ROUTER_JS,
      `})();`,
      `/* --- */`,
      `window.$FLAGS="1|0|${ROUTER}";`,
      `</script>`,
    ].join(""),
  );
  assertEquals(
    await bunRoutes["/post/:id"](Object.assign(new Request("http://localhost/post/123"), { params: { id: "123" } })).text(),
    [
      `<!DOCTYPE html>`,
      `<html>`,
      `<m-router status="200">`,
      `Blog Post 123`,
      `</m-router>`,
      `</html>`,
      `<script data-mono-jsx="${VERSION}">`,
      `(()=>{`,
      ROUTER_JS,
      `})();`,
      `/* --- */`,
      `window.$FLAGS="1|0|${ROUTER}";`,
      `</script>`,
    ].join(""),
  );
});
