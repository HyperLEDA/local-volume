import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
// Bundled WOFF2 assets, hosted by LV LEDA; no third-party font CDN.
import "@fontsource-variable/source-sans-3";
import "@fontsource-variable/source-serif-4";
import "@fontsource/source-code-pro/400.css";
import "@fontsource/stix-two-math/400.css";
import "./index.css";
import "./components/scientificNavigation.css";

const root = document.getElementById("root");
if (root === null) {
  throw new Error("Root element not found");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
