declare global {
  var $onRFS: (event: SubmitEvent) => Promise<void>;
}

const { document } = window;
const getAttr = (el: Element, name: string) => el.getAttribute(name);

customElements.define(
  "m-invalid",
  class extends HTMLElement {
    connectedCallback() {
      const forAttr = getAttr(this, "for");
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

window.$onRFS = async (e) => {
  e.preventDefault();
  const formEl = e.target as HTMLFormElement;
  if (!formEl.checkValidity()) {
    return;
  }
  const submittingClassName = getAttr(formEl, "data-submitting-class") ?? "submitting";
  const formData = new FormData(formEl);
  const inputEls = [...formEl.elements] as (HTMLInputElement & { _disabled?: boolean })[];
  for (const inputEl of inputEls) {
    inputEl._disabled = inputEl.disabled;
    inputEl.disabled = true;
  }
  formEl.querySelectorAll("formslot").forEach(el => el.innerHTML = "");
  formEl.classList.add(submittingClassName);
  try {
    const res = await fetch(location.href, {
      method: "POST",
      headers: { "x-route-form": "true", "x-flags": $FLAGS },
      body: formData,
    });
    if (res.ok) {
      const [html, js] = await res.json();
      const slots = new Map<Element | DocumentFragment, Element>();
      const tpl = document.createElement("template");
      tpl.innerHTML = html;
      const { content } = tpl;
      content.querySelectorAll("[formslot]").forEach(el => {
        const slotName = getAttr(el, "formslot");
        if (slotName) {
          const selector = 'm-formslot[name="' + slotName + '"]';
          const formslotEl = formEl.querySelector(selector) ?? document.querySelector(selector);
          if (formslotEl) {
            el.remove();
            slots.set(el, formslotEl);
          }
        }
      });
      const formslotEl = formEl.querySelector("m-formslot:not([name])");
      if (formslotEl) {
        slots.set(content, formslotEl);
      } else {
        formEl.append(content);
      }
      for (const [el, formslotEl] of slots) {
        const scope = getAttr(formslotEl, "scope");
        const mode = getAttr(formslotEl, "mode");
        const onupdateFid = getAttr(formslotEl, "onupdate");
        if (mode === "insertbefore") {
          formslotEl.before(el);
        } else if (mode === "insertafter") {
          formslotEl.after(el);
        } else {
          formslotEl.replaceChildren(el);
        }
        if (onupdateFid) {
          $fmap.get(Number(onupdateFid))?.call(
            $signals?.(Number(scope)) ?? formslotEl,
            { type: "update", target: formslotEl },
          );
        }
      }
      setTimeout(() => formEl.checkValidity() && formEl.reset());
      if (js) {
        document.body.appendChild(document.createElement("script")).textContent = js + ";document.currentScript.remove();";
      }
    }
  } finally {
    formEl.classList.remove(submittingClassName);
    for (const inputEl of inputEls) {
      inputEl.disabled = inputEl._disabled!;
      delete inputEl._disabled;
    }
  }
};
