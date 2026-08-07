import { InputAction, input } from "../../../shared/js/inputController.js";

const CONTEXT = "FOOTER_CONTEXT";

const settingsOptions = document.querySelector(".settings-options");
const footerBar = document.querySelector("footer > ul:first-of-type");
const root = document.documentElement;

function measureFooter() {
  if (settingsOptions) {
    root.style.setProperty(
      "--settings-options-height",
      `${settingsOptions.offsetHeight}px`,
    );
  }
  if (footerBar) {
    root.style.setProperty(
      "--footer-bar-height",
      `${footerBar.parentElement.offsetHeight - settingsOptions.offsetHeight}px`,
    );
  }
}

if (settingsOptions) settingsOptions.removeAttribute("hidden");

measureFooter();
window.addEventListener("resize", measureFooter);

const items = document.querySelectorAll(".settings-option img");
let focusIndex = Math.max(
  0,
  Array.from(items).findIndex((img) => img.hasAttribute("active")),
);

function setFocus(newIndex) {
  items[focusIndex].removeAttribute("active");
  focusIndex = (newIndex + items.length) % items.length;
  items[focusIndex].setAttribute("active", "");
}

input.on(InputAction.UP, () => {
  input.pushContext(CONTEXT);
  document.body.classList.add("footer-expanded");

  input.on(InputAction.LEFT, () => setFocus(focusIndex - 1), CONTEXT);
  input.on(InputAction.RIGHT, () => setFocus(focusIndex + 1), CONTEXT);

  input.on(InputAction.CONFIRM, () => {
    const app = items[focusIndex];
    const optionType = app.getAttribute("data-option");
    console.log(optionType);
    
  }, CONTEXT);

  function hideFooter() {
    input.popContext();
    document.body.classList.remove("footer-expanded");
  }

  input.on(InputAction.DOWN, hideFooter, CONTEXT,);
  input.on(InputAction.BACK, hideFooter, CONTEXT,);
});