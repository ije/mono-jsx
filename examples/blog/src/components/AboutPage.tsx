import { ContactForm } from "./ContactForm.tsx";

export function AboutPage() {
  return (
    <>
      <h1>About This Demo</h1>
      <article>
        <p>
          This demonstration showcases the power of Mono-JSX for building
          server-side rendered applications with Deno.
        </p>
        <h3>Architecture Highlights</h3>
        <ul>
          <li>Zero dependencies beyond mono-jsx</li>
          <li>Type-safe functional components</li>
          <li>Immutable state management with signals</li>
          <li>Result types for explicit error handling</li>
          <li>Streaming SSR for optimal performance</li>
        </ul>
      </article>

      <h2>Contact Us</h2>
      <ContactForm />
    </>
  );
}