import { saveData } from "./store.js";

let renderer = () => {};
let tickRenderer = () => {};

export function setRenderer(fn) {
  renderer = fn;
}

// Lightweight per-second renderer: only the running countdown / active-focus
// / clock hand. Set by main.js; used by the timer ticker instead of the full
// render so a 1s tick does not rebuild the calendar + dashboard + composer.
export function setTickRenderer(fn) {
  tickRenderer = fn;
}

export function render() {
  renderer();
}

export function renderTick() {
  tickRenderer();
}

export function saveAndRender() {
  saveData();
  renderer();
}
