import { Header } from "./Header.tsx";

interface LayoutProps {
  children: any;
  title?: string;
  theme?: string;
  isLoading?: boolean;
}

export function DefaultLayout({ children, title = "Mono-JSX + HTMX Demo" }: LayoutProps) {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" />
        <title>{title}</title>
        <link rel="stylesheet" href="/styles.css" />
        <script src="https://unpkg.com/htmx.org@2.0.4"></script>
      </head>
      <body>
        <Header />
        <main>
          {children}
        </main>
      </body>
    </html>
  );
}

export function MinimalLayout({ children, title = "Mono-JSX + HTMX Demo" }: LayoutProps) {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" />
        <title>{title}</title>
        <link rel="stylesheet" href="/styles.css" />
        <script src="https://unpkg.com/htmx.org@2.0.4"></script>
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}