import { fetchPostsByUser } from "./data.ts";

export function ContactFormStatus(props: { status: string; message?: string }) {
  if (props.status === "sent") {
    return (
      <article class="success-message">
        ✓ Message sent successfully!
      </article>
    );
  }
  if (props.status === "error") {
    return (
      <article class="error-message">{props.message || "Please fill in all fields"}</article>
    );
  }
  if (props.status === "sending") {
    return (
      <article>
        <div class="loading" style="display: inline-block; margin-right: 0.5rem;"></div>
        Sending your message...
      </article>
    );
  }
  return null;
}

export async function handleContactSubmit(req: Request): Promise<Response> {
  const formData = await req.formData();
  const email = formData.get("email") as string;
  const message = formData.get("message") as string;

  await new Promise(resolve => setTimeout(resolve, 1000));

  if (!email || !message) {
    return <html><body><ContactFormStatus status="error" message="Please fill in all fields" /></body></html>;
  }

  console.log("Form submitted:", { email, message });
  return <html><body><ContactFormStatus status="sent" /></body></html>;
}

export async function handlePostsLoad(): Promise<Response> {
  const result = await fetchPostsByUser("default");
  
  if (!result.ok) {
    return <html><body><article class="error-message">Failed to load posts: {result.error.message}</article></body></html>;
  }

  return <html><body>
    <div>
      {result.value.map(post => (
        <article data-id={post.id}>
          <h3>{post.title}</h3>
          <p>{post.content}</p>
          <small>
            Posted on {post.createdAt.toLocaleDateString()}
          </small>
        </article>
      ))}
    </div>
  </body></html>;
}