declare global {
  var $onrfs: (event: SubmitEvent) => Promise<void>;
}

customElements.define(
  "m-invalid",
  class extends HTMLElement {
    connectedCallback() {
      const forAttr = this.getAttribute("for");
      const formEl = this.closest("form");
      const message = this.textContent;
      if (forAttr && formEl && message) {
        for (const name of forAttr.split(",")) {
          const inputEl = formEl.elements.namedItem(name.trim()) as HTMLInputElement | null;
          if (inputEl) {
            const delCustomValidity = () => {
              inputEl.removeEventListener("input", delCustomValidity);
              inputEl.setCustomValidity("");
            };
            inputEl.addEventListener("input", delCustomValidity);
            inputEl.setCustomValidity(message);
            inputEl.focus();
          }
        }
      }
      this.remove();
    }
  },
);

window.$onrfs = async (evt) => {
  evt.preventDefault();
  const formEl = evt.target as HTMLFormElement;
  formEl.querySelectorAll("m-formslot").forEach(el => {
    el.innerHTML = "";
  });
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
  const tpl = document.createElement("template");
  const formslots = new Map<HTMLElement, HTMLElement>();
  tpl.innerHTML = html;
  for (const inputEl of inputEls) {
    inputEl.disabled = inputEl._disabled!;
    delete inputEl._disabled;
  }
  for (const child of tpl.content.childNodes) {
    if (child.nodeType === 1) {
      const el = child as HTMLElement;
      const slot = el.getAttribute("formslot");
      const selector = slot ? 'm-formslot[name="' + slot + '"]' : "m-formslot";
      const formslot = slot
        ? formEl.querySelector(selector) ?? document.querySelector(selector)
        : formEl.querySelector(selector);
      if (formslot) {
        formslot.innerHTML = "";
        formslots.set(el, formslot as HTMLElement);
        continue;
      }
    }
    formEl.appendChild(child);
  }
  for (const [child, formslot] of formslots) {
    switch (formslot.getAttribute("mode")) {
      case "insertbefore":
        formslot.before(child);
        break;
      case "insertafter":
        formslot.after(child);
        break;
      default:
        formslot.appendChild(child);
    }
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
