import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { hardenPage } from "./platform/harden";
import "./index.css";

// Before anything is drawn: the page should never offer a context menu or a
// drag, whichever screen is up.
hardenPage();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
