export function Header() {
  return (
    <header>
      <nav>
        <ul>
          <li><a href="/" hx-get="/" hx-target="main" hx-push-url="true">Home</a></li>
          <li><a href="/posts" hx-get="/posts" hx-target="main" hx-push-url="true">Posts</a></li>
          <li><a href="/about" hx-get="/about" hx-target="main" hx-push-url="true">About</a></li>
        </ul>
      </nav>
    </header>
  );
}