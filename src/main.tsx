/**
 * Application bootstrap.
 *
 * Mounts the `App` component into `#root` via `createRoot` (React 18
 * concurrent root). `StrictMode` is on in dev to surface state-mutation
 * and effect-cleanup bugs early; it has no effect in production.
 *
 * Global stylesheet `index.css` is imported here so it sits at the top
 * of the bundle's CSS import graph and other component CSS files
 * inherit the token cascade.
 */
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { recordDiagnosticError } from "./utils/diagnostics";
import { initWebVitals } from "./utils/web-vitals";
import "./index.css";

window.addEventListener("error", (event) => {
  recordDiagnosticError(event.message || event.error?.message);
});

window.addEventListener("unhandledrejection", (event) => {
  recordDiagnosticError(event.reason);
});

async function enableMocking() {
  if (!import.meta.env.DEV || import.meta.env.VITE_ENABLE_MOCKS === "false") {
    return;
  }

  const { worker } = await import("./mocks/browser");
  await worker.start({ onUnhandledRequest: "bypass" });
}

enableMocking().then(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});

// Initialise Core Web Vitals collection after first render
setTimeout(() => {
  initWebVitals();
}, 0);
