# Mono-JSX + HTMX Example

A minimal blog web application demonstrating modern web development with:

- **Mono-JSX** for server-side rendering with Deno
- **HTMX** for dynamic interactions without JavaScript frameworks
- **No-build approach** - direct TypeScript execution
- **Semantic CSS** - classless styling with mobile-first design

## Features

- Server-side rendered pages with type safety
- HTMX-enhanced forms and navigation
- Lazy loading content with loading indicators
- Progressive enhancement (works without JavaScript)
- Minimalistic black/gray/white design

## Running

```bash
deno run --allow-read --allow-net src/app.tsx
```

Visit `http://localhost:8000` to see the demo.

## Structure

- `src/app.tsx` - Main server entry point
- `src/components/` - JSX components
- `src/handlers.tsx` - HTMX endpoint handlers
- `public/styles.css` - Semantic CSS styling