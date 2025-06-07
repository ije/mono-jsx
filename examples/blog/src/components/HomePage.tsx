export function HomePage() {
  return (
    <>
      <h1>Welcome to Mono-JSX + HTMX</h1>
      <p>
        This demo showcases server-side rendering with Mono-JSX enhanced with HTMX 
        for modern web interactions without complex JavaScript frameworks.
      </p>
      <article>
        <h2>Features Demonstrated</h2>
        <ul>
          <li>HTMX-enhanced forms with async submission</li>
          <li>Lazy loading content with loading indicators</li>
          <li>SPA-like navigation without page reloads</li>
          <li>Progressive enhancement (works without JS)</li>
          <li>Theme switching with HTMX attributes</li>
          <li>Result type for error handling</li>
          <li>Functional programming patterns</li>
          <li>Type-safe server-side rendering</li>
        </ul>
      </article>
      <article>
        <h2>Try the Demo</h2>
        <p>Navigate to different pages to see HTMX in action:</p>
        <ul>
          <li><strong>Posts</strong> - See lazy loading with HTMX</li>
          <li><strong>About</strong> - Try the enhanced contact form</li>
          <li><strong>Theme Toggle</strong> - Click the moon/sun button</li>
        </ul>
      </article>
    </>
  );
}