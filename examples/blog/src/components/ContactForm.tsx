export function ContactForm() {
  return (
    <section>
      <div id="form-status"></div>
      <form 
        action="/api/contact"
        method="POST"
        hx-post="/api/contact"
        hx-target="#form-status"
        hx-indicator="#loading-indicator"
        hx-swap="innerHTML"
        hx-on--before-request="this.querySelector('button').disabled = true"
        hx-on--after-request="this.querySelector('button').disabled = false"
      >
        <div id="loading-indicator" class="htmx-indicator">
          <article>
            <div class="loading" style="display: inline-block; margin-right: 0.5rem;"></div>
            Sending your message...
          </article>
        </div>

        <fieldset>
          <label for="email">
            Email Address
            <input
              type="email"
              id="email"
              name="email"
              placeholder="your.email@example.com"
              required
              autocomplete="email"
            />
          </label>

          <label for="message">
            Message
            <textarea
              id="message"
              name="message"
              placeholder="Tell us what's on your mind..."
              rows={5}
              required
            />
          </label>

          <button type="submit">
            Send Message
          </button>
        </fieldset>
      </form>
    </section>
  );
}