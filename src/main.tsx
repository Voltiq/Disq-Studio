import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { loadThemePreference, resolveTheme, setPageTheme } from "./lib/theme";
import "./styles/tokens.css";
import "./styles/components.css";
import "./styles/app.css";

async function start() {
  // In a plain browser there is no Rust side; fake one so the UI can be worked on.
  if (import.meta.env.DEV && !("__TAURI_INTERNALS__" in window)) {
    (await import("./lib/mock")).installMockBackend();
  }

  // Colour the page before the first render, so it never flashes the wrong theme.
  setPageTheme(resolveTheme(loadThemePreference()));

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

start();
