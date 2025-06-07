import { DefaultLayout } from "./components/Layout.tsx";
import { Router } from "./components/Router.tsx";
import { 
  handleContactSubmit,
  handlePostsLoad
} from "./handlers.tsx";

export default {
  fetch: async (req: Request) => {
    try {
      const url = new URL(req.url);
      
      if (req.method === "GET" && url.pathname === "/styles.css") {
        const css = await Deno.readTextFile("./public/styles.css");
        return new Response(css, {
          headers: { "Content-Type": "text/css" }
        });
      }
      
      if (req.method === "POST" && url.pathname === "/api/contact") {
        return await handleContactSubmit(req);
      }
      if (req.method === "GET" && url.pathname === "/api/posts") {
        return await handlePostsLoad();
      }
      
      const isHTMXRequest = req.headers.get("HX-Request");
      if (isHTMXRequest) {
        return <html><body><div><Router pathname={url.pathname} /></div></body></html>;
      }
      
      return DefaultLayout({ 
        children: <Router pathname={url.pathname} />
      });
    } catch (err) {
      console.error("SSR error:", err);
      return <html><body><h1>Internal Server Error</h1></body></html>;
    }
  }
};