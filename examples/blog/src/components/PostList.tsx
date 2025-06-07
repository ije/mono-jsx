export function PostList() {
  return (
    <div 
      hx-get="/api/posts"
      hx-trigger="load"
      hx-indicator="#posts-loading"
    >
      <div id="posts-loading" class="htmx-indicator">
        <article>
          <div class="loading" style="display: inline-block; margin-right: 0.5rem;"></div>
          Loading posts...
        </article>
      </div>
    </div>
  );
}