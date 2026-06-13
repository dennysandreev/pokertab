import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { sendClientBootBeacon } from "./lib/client-boot";
import { SessionProvider } from "./session/session-context";

const optionalFontsHref =
  "https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;600;700;800&family=Inter:wght@400;500;600;700&family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap";

sendClientBootBeacon("module-start");

window.addEventListener("error", () => {
  sendClientBootBeacon("window-error");
});

window.addEventListener("unhandledrejection", () => {
  sendClientBootBeacon("unhandled-rejection");
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SessionProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </SessionProvider>
  </React.StrictMode>
);

sendClientBootBeacon("react-render-called");

window.setTimeout(() => {
  const link = document.createElement("link");
  link.href = optionalFontsHref;
  link.rel = "stylesheet";
  document.head.appendChild(link);
}, 0);
