import { saveData } from "./store.js";

let renderer = () => {};

export function setRenderer(fn) {
  renderer = fn;
}

export function render() {
  renderer();
}

export function saveAndRender() {
  saveData();
  renderer();
}
