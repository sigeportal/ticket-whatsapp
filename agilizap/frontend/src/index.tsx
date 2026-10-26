import React from "react";
import { createRoot } from "react-dom/client";
import CssBaseline from "@material-ui/core/CssBaseline";
import * as serviceworker from "./serviceWorker";
import "./index.css";

import App from "./App";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Elemento raiz #root não foi encontrado no DOM.");
}

const root = createRoot(container);

root.render(
  <CssBaseline>
    <App />
  </CssBaseline>
);

if (typeof window.finishProgress === "function") {
  window.finishProgress();
}

serviceworker.register();
