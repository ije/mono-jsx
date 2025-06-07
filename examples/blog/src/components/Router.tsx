import { HomePage } from "./HomePage.tsx";
import { PostsPage } from "./PostsPage.tsx";
import { AboutPage } from "./AboutPage.tsx";
import { NotFoundPage } from "./NotFoundPage.tsx";

export function Router(props: { pathname: string }) {
  switch (props.pathname) {
    case "/":
      return <HomePage />;
    case "/posts":
      return <PostsPage />;
    case "/about":
      return <AboutPage />;
    default:
      return <NotFoundPage />;
  }
}