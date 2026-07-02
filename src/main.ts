import { AtEaseApp } from "./app";
import "./styles.css";

const root = document.querySelector<HTMLElement>("#app");

if (!root) {
  throw new Error("missing #app");
}

void new AtEaseApp(root).start();
