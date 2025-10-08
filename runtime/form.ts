declare global {
  var $onrfs: (event: SubmitEvent) => Promise<void>;
}

const setCustomValidity = (inputEl: HTMLInputElement, message: string) => inputEl.setCustomValidity(message);
const insertAdjacentHTML = (el: Element, position: InsertPosition, html: string) => el.insertAdjacentHTML(position, html);

customElements.define(
  "m-invalid",
  class extends HTMLElement {
    connectedCallback() {
      const forAttr = this.getAttribute("for");
      const formEl = this.closest("form");
      const message = this.textContent;
      if (forAttr && formEl && message) {
        const inputEl = formEl.elements.namedItem(forAttr) as HTMLInputElement | null;
        if (inputEl) {
          const delCustomValidity = () => {
            inputEl.removeEventListener("input", delCustomValidity);
            setCustomValidity(inputEl, "");
          };
          inputEl.addEventListener("input", delCustomValidity);
          setCustomValidity(inputEl, message);
          inputEl.focus();
        }
      }
      this.remove();
    }
  },
);

window.$onrfs = async (evt) => {
  evt.preventDefault();
  const formEl = evt.target as HTMLFormElement;
  if (!formEl.checkValidity()) {
    return;
  }
  const data = new FormData(formEl);
  const inputEls = [...formEl.elements] as (HTMLInputElement & { _disabled?: boolean })[];
  for (const inputEl of inputEls) {
    inputEl._disabled = inputEl.disabled;
    inputEl.disabled = true;
  }
  const res = await fetch(location.href, {
    method: "POST",
    headers: { "x-route-form": "true", "x-flags": $FLAGS },
    body: data,
  });
  const [html, js] = await res.json();
  const formslot = formEl.querySelector("m-formslot");
  for (const inputEl of inputEls) {
    inputEl.disabled = inputEl._disabled!;
    delete inputEl._disabled;
  }
  if (formslot) {
    switch (formslot.getAttribute("mode")) {
      case "insertbefore":
        insertAdjacentHTML(formslot, "beforebegin", html);
        break;
      case "insertafter":
        insertAdjacentHTML(formslot, "afterend", html);
        break;
      default:
        formslot.innerHTML = html;
    }
  } else {
    insertAdjacentHTML(formEl, "beforeend", html);
  }
  setTimeout(() => {
    if (!inputEls.some(el => !el.validity.valid)) {
      formEl.reset();
    }
  }, 0);
  if (js) {
    document.body.appendChild(document.createElement("script")).textContent = js;
  }
};
