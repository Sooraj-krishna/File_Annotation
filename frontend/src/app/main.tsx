/**
 * Application entry point.
 *
 * Mounts the root React component into the DOM inside StrictMode
 * for development warnings and best practice enforcement.
 */

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
